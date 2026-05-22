// packages/core/src/policies/pr-checks/policy.js
//
// Orchestrator for PR quality checks.
// Receives a plain Octokit instance — works with both GitHub Actions and Probot.

const { checkDCO, checkGPG, parseIssueNumbers } = require('./checks');
const { buildBotComment, MARKER } = require('./comments');

/**
 * Fetches all commits for a pull request (paginated).
 */
async function fetchPRCommits(github, owner, repo, pullNumber) {
  const commits = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await github.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
      page,
    });
    commits.push(...response.data);
    if (response.data.length < perPage) break;
    page++;
  }
  return commits;
}

/**
 * Checks whether the PR has merge conflicts by polling the mergeable state.
 * GitHub sometimes takes a moment to compute mergeability, so we retry.
 */
async function checkMergeConflict(github, owner, repo, pullNumber, logger) {
  const maxAttempts = 5;
  const delayMs = 2000;
  let conflicts = false;
  let mergeableResolved = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data: pr } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    if (pr.mergeable !== null) {
      logger.info(`Merge conflict check: mergeable=${pr.mergeable}, state=${pr.mergeable_state}`);
      conflicts = !pr.mergeable;
      mergeableResolved = true;
      break;
    }

    if (attempt < maxAttempts) {
      logger.info(`Mergeable state not ready, waiting ${delayMs}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  if (!mergeableResolved) {
    logger.info('Merge conflict check: mergeable never resolved after retries, assuming no conflicts');
  }
  return { passed: !conflicts };
}

/**
 * Uses the GraphQL API to fetch closing issue references for a PR.
 */
async function fetchClosingIssueNumbers(github, owner, repo, pullNumber, logger) {
  try {
    const query = `query($owner:String!,$repo:String!,$number:Int!){
      repository(owner:$owner,name:$repo){
        pullRequest(number:$number){
          closingIssuesReferences(first:10){
            nodes { number }
          }
        }
      }
    }`;
    const result = await github.graphql(query, { owner, repo, number: pullNumber });
    const nodes = result.repository.pullRequest.closingIssuesReferences.nodes || [];
    return nodes.map(n => n.number);
  } catch (error) {
    logger.info(`GraphQL closingIssuesReferences failed: ${error.message}`);
    return [];
  }
}

/**
 * Checks whether the PR is linked to an issue and whether the PR author
 * is assigned to that issue.
 */
async function checkIssueLink(github, owner, repo, pullRequest, logger) {
  const body = pullRequest.body || '';
  const prAuthor = pullRequest.user?.login;
  const pullNumber = pullRequest.number;

  const issueNumbers = parseIssueNumbers(body);

  // If no issue numbers found in the body, try the GraphQL API
  if (issueNumbers.size === 0) {
    const graphqlIssues = await fetchClosingIssueNumbers(github, owner, repo, pullNumber, logger);
    graphqlIssues.forEach(n => issueNumbers.add(n));
  }

  if (issueNumbers.size === 0) {
    logger.info('Issue link check: no linked issues found');
    return { passed: false, reason: 'no_issue_linked', issues: [] };
  }

  // Fetch each linked issue and check if the PR author is assigned
  const linkedIssues = [];
  for (const num of issueNumbers) {
    try {
      const { data: issue } = await github.rest.issues.get({
        owner,
        repo,
        issue_number: num,
      });
      const isAssigned = (issue.assignees || []).some(
        a => a.login.toLowerCase() === prAuthor.toLowerCase()
      );
      linkedIssues.push({ number: num, title: issue.title, isAssigned });
    } catch (err) {
      logger.info(`Issue link check: could not fetch issue #${num}: ${err.message}`);
    }
  }

  if (linkedIssues.length === 0) {
    logger.info('Issue link check: all linked issues returned errors');
    return { passed: false, reason: 'no_issue_linked', issues: [] };
  }

  const allAssigned = linkedIssues.every(i => i.isAssigned);
  if (!allAssigned) {
    const missing = linkedIssues.filter(i => !i.isAssigned).map(i => `#${i.number}`).join(', ');
    logger.info(`Issue link check: author ${prAuthor} not assigned to all linked issues (missing: ${missing})`);
    return { passed: false, reason: 'not_assigned', issues: linkedIssues };
  }

  logger.info('Issue link check: passed (author assigned to all linked issues)');
  return { passed: true, reason: null, issues: linkedIssues };
}

/**
 * Posts a new comment or updates an existing one identified by the marker.
 */
async function postOrUpdateComment(github, owner, repo, issueNumber, marker, body) {
  let existingCommentId = null;
  let page = 1;
  const perPage = 100;

  while (!existingCommentId) {
    const { data: comments } = await github.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: perPage,
      page,
    });

    for (const c of comments) {
      if (c.body && c.body.startsWith(marker)) {
        existingCommentId = c.id;
        break;
      }
    }
    if (comments.length < perPage) break;
    page++;
  }

  if (existingCommentId) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingCommentId,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

/**
 * Checks if a PR has a specific label.
 */
function hasLabel(prPayload, labelName) {
  if (!prPayload?.labels?.length) return false;
  return prPayload.labels.some(label => {
    const name = typeof label === 'string' ? label : label?.name;
    return typeof name === 'string' && name.toLowerCase() === labelName.toLowerCase();
  });
}

/**
 * Swaps status labels (needs-review / needs-revision) based on check results.
 */
async function swapStatusLabel(github, owner, repo, pullRequest, allPassed, force, config) {
  const statusLabels = config.labels?.status || {};
  const needsReview = statusLabels.needsReview || 'status: needs review';
  const needsRevision = statusLabels.needsRevision || 'status: needs revision';

  const labelToAdd = allPassed ? needsReview : needsRevision;
  const labelToRemove = allPassed ? needsRevision : needsReview;

  if (force) {
    if (hasLabel(pullRequest, labelToRemove)) {
      try {
        await github.rest.issues.removeLabel({ owner, repo, issue_number: pullRequest.number, name: labelToRemove });
      } catch { /* label may not exist */ }
    }
    await github.rest.issues.addLabels({ owner, repo, issue_number: pullRequest.number, labels: [labelToAdd] });
  } else {
    if (hasLabel(pullRequest, labelToRemove)) {
      try {
        await github.rest.issues.removeLabel({ owner, repo, issue_number: pullRequest.number, name: labelToRemove });
      } catch { /* label may not exist */ }
      await github.rest.issues.addLabels({ owner, repo, issue_number: pullRequest.number, labels: [labelToAdd] });
    }
  }
}

/**
 * Main orchestrator: runs all PR checks, posts the dashboard comment,
 * and swaps status labels.
 *
 * @param {object} params
 * @param {object} params.github - Octokit instance.
 * @param {string} params.owner - Repository owner.
 * @param {string} params.repo - Repository name.
 * @param {object} params.pullRequest - The pull_request payload object.
 * @param {object} params.config - The hiero-automation config.
 * @param {boolean} params.force - Whether to force label swap (true on PR open).
 * @param {object} params.logger - Logger with .info() and .error() methods.
 * @returns {{ allPassed: boolean }}
 */
async function runPRChecks({ github, owner, repo, pullRequest, config, force = false, logger = console }) {
  const pullNumber = pullRequest.number;
  const prAuthor = pullRequest.user.login;

  let dco, gpg, merge, issueLink;
  let commits = [];

  // Fetch commits
  try {
    commits = await fetchPRCommits(github, owner, repo, pullNumber);
    logger.info(`Fetched ${commits.length} commits for PR #${pullNumber}`);
  } catch (e) {
    logger.error(`Failed to fetch PR commits: ${e.message}`);
    dco = { error: true, errorMessage: e.message };
    gpg = { error: true, errorMessage: e.message };
  }

  // Run DCO check
  if (!dco) {
    try { dco = checkDCO(commits, logger); }
    catch (e) { dco = { error: true, errorMessage: e.message }; }
  }

  // Run GPG check
  if (!gpg) {
    try { gpg = checkGPG(commits, logger); }
    catch (e) { gpg = { error: true, errorMessage: e.message }; }
  }

  // Run merge conflict check
  try { merge = await checkMergeConflict(github, owner, repo, pullNumber, logger); }
  catch (e) { merge = { error: true, errorMessage: e.message }; }

  // Run issue link check
  try { issueLink = await checkIssueLink(github, owner, repo, pullRequest, logger); }
  catch (e) { issueLink = { error: true, errorMessage: e.message }; }

  // Build and post the dashboard comment
  const { marker, body, allPassed } = buildBotComment({ prAuthor, dco, gpg, merge, issueLink, config });
  await postOrUpdateComment(github, owner, repo, pullNumber, marker, body);

  // Swap status labels
  await swapStatusLabel(github, owner, repo, pullRequest, allPassed, force, config);

  return { allPassed };
}

module.exports = {
  runPRChecks,
  fetchPRCommits,
  checkMergeConflict,
  checkIssueLink,
  fetchClosingIssueNumbers,
  postOrUpdateComment,
  hasLabel,
  swapStatusLabel,
};

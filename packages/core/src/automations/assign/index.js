// packages/core/src/automations/assign/index.js
//
// Orchestrator for the /assign command.
// Implements the full decision tree: already assigned? ready for dev?
// skill level? assignment limit? prerequisites? Then assign + welcome.

const {
  buildWelcomeComment,
  buildAlreadyAssignedComment,
  buildNotReadyComment,
  buildNoSkillLevelComment,
  buildAssignmentLimitExceededComment,
  buildPrerequisiteNotMetComment,
} = require('./messages');

/**
 * Handles the /assign command on an issue.
 *
 * @param {object} params
 * @param {object} params.github - Octokit instance.
 * @param {string} params.owner - Repository owner.
 * @param {string} params.repo - Repository name.
 * @param {object} params.issue - The issue payload object.
 * @param {object} params.comment - The comment payload object (the /assign comment).
 * @param {object} params.config - The hiero-automation config.
 * @param {object} params.logger - Logger with .info() and .error() methods.
 */
async function runAssign({ github, owner, repo, issue, comment, config, logger = console }) {
  const requester = comment.user.login;
  const issueNumber = issue.number;
  const issueLabels = (issue.labels || []).map(l => l.name);

  // React with thumbs-up to acknowledge the command
  await github.rest.reactions.createForIssueComment({
    owner,
    repo,
    comment_id: comment.id,
    content: '+1',
  });

  // 1. Check if already assigned
  if (issue.assignees?.length > 0) {
    const msg = buildAlreadyAssignedComment(requester, issue.assignees[0].login);
    await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: msg });
    logger.info(`Issue #${issueNumber} already assigned to ${issue.assignees[0].login}`);
    return { assigned: false, reason: 'already_assigned' };
  }

  // 2. Check "ready for dev" label
  const readyLabel = config.labels?.status?.readyForDev || 'status: ready for dev';
  if (!issueLabels.includes(readyLabel)) {
    const msg = buildNotReadyComment(requester, config);
    await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: msg });
    logger.info(`Issue #${issueNumber} not ready for dev`);
    return { assigned: false, reason: 'not_ready' };
  }

  // 3. Check skill level label
  const skillHierarchy = config.skillHierarchy || [];
  const issueSkillLevel = skillHierarchy.find(level => issueLabels.includes(level));

  if (!issueSkillLevel) {
    const msg = buildNoSkillLevelComment(requester, config);
    await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: msg });
    logger.info(`Issue #${issueNumber} missing skill level label`);
    return { assigned: false, reason: 'no_skill_level' };
  }

  // 4. Check open assignment limit
  const blockedLabel = config.labels?.status?.blocked || 'status: blocked';
  const maxOpen = config.assignment?.maxOpenAssignments || 2;
  const openSearchQuery = `repo:${owner}/${repo} is:issue is:open assignee:${requester} -label:"${blockedLabel}"`;
  const openSearch = await github.rest.search.issuesAndPullRequests({ q: openSearchQuery });
  const currentOpenAssignments = openSearch.data.total_count;

  if (currentOpenAssignments >= maxOpen) {
    const msg = buildAssignmentLimitExceededComment(requester, currentOpenAssignments, config);
    await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: msg });
    logger.info(`User ${requester} at assignment limit (${currentOpenAssignments}/${maxOpen})`);
    return { assigned: false, reason: 'limit_exceeded' };
  }

  // 5. Check skill prerequisites
  const prereqs = config.skillPrerequisites || {};
  const prereq = prereqs[issueSkillLevel];

  if (prereq && prereq.requiredLabel && prereq.requiredCount > 0) {
    const closedSearchQuery = `repo:${owner}/${repo} is:issue is:closed assignee:${requester} label:"${prereq.requiredLabel}"`;
    const closedSearch = await github.rest.search.issuesAndPullRequests({ q: closedSearchQuery });
    const completedCount = closedSearch.data.total_count;

    if (completedCount < prereq.requiredCount) {
      const msg = buildPrerequisiteNotMetComment(requester, issueSkillLevel, completedCount, config);
      await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: msg });
      logger.info(`User ${requester} prereq not met for ${issueSkillLevel}: ${completedCount}/${prereq.requiredCount}`);
      return { assigned: false, reason: 'prerequisite_not_met' };
    }
  }

  // 6. All checks passed — assign the user
  await github.rest.issues.addAssignees({
    owner,
    repo,
    issue_number: issueNumber,
    assignees: [requester],
  });

  const welcomeMsg = buildWelcomeComment(requester, issueSkillLevel, config);
  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body: welcomeMsg });

  // Swap labels: remove "ready for dev", add "in progress"
  const inProgressLabel = config.labels?.status?.inProgress || 'status: in progress';
  try {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name: readyLabel });
  } catch {
    // label may have already been removed — safe to ignore
  }
  await github.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [inProgressLabel] });

  logger.info(`Assigned ${requester} to issue #${issueNumber} (skill: ${issueSkillLevel})`);
  return { assigned: true, reason: null };
}

module.exports = { runAssign };

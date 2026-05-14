// packages/core/src/automations/pr-checks/checks.js
//
// Pure functions for PR quality checks.
// These have NO GitHub API dependencies — they operate on data passed in.

/**
 * Returns true if a commit message contains a valid DCO sign-off line.
 */
function hasDCOSignoff(message) {
  if (!message) return false;
  return /^Signed-off-by:\s+.+\s+<.+>/mi.test(message);
}

/**
 * Returns true if a commit has a verified GPG signature.
 */
function hasVerifiedGPGSignature(commit) {
  return commit?.commit?.verification?.verified === true;
}

/**
 * Returns true if a commit is a merge commit (has more than one parent).
 */
function isMergeCommit(commit) {
  return Array.isArray(commit?.parents) && commit.parents.length > 1;
}

/**
 * Checks all commits for DCO sign-off compliance.
 * Merge commits are skipped.
 *
 * @param {Array} commits - Array of commit objects from the GitHub API.
 * @param {object} logger - Logger with .info() method.
 * @returns {{ passed: boolean, failures: Array<{ sha: string, message: string }> }}
 */
function checkDCO(commits, logger) {
  const failures = [];
  let skipped = 0;

  for (const c of commits) {
    if (isMergeCommit(c)) {
      skipped++;
      continue;
    }
    const message = c.commit?.message || '';
    const shortSha = (c.sha || '').slice(0, 7);
    const firstLine = message.split('\n')[0] || '(no message)';

    if (!hasDCOSignoff(message)) {
      failures.push({ sha: shortSha, message: firstLine });
    }
  }

  const checked = commits.length - skipped;
  logger.info(`DCO check: ${checked - failures.length}/${checked} passed (${skipped} merge commit(s) skipped)`);
  return { passed: failures.length === 0, failures };
}

/**
 * Checks all commits for verified GPG signatures.
 *
 * @param {Array} commits - Array of commit objects from the GitHub API.
 * @param {object} logger - Logger with .info() method.
 * @returns {{ passed: boolean, failures: Array<{ sha: string, message: string }> }}
 */
function checkGPG(commits, logger) {
  const failures = [];

  for (const c of commits) {
    const shortSha = (c.sha || '').slice(0, 7);
    const message = c.commit?.message || '';
    const firstLine = message.split('\n')[0] || '(no message)';

    if (!hasVerifiedGPGSignature(c)) {
      failures.push({ sha: shortSha, message: firstLine });
    }
  }

  logger.info(`GPG check: ${commits.length - failures.length}/${commits.length} passed`);
  return { passed: failures.length === 0, failures };
}

/**
 * Parses issue numbers from a PR body using closing keywords and "related to" patterns.
 *
 * @param {string} body - The PR body text.
 * @returns {Set<number>} Set of parsed issue numbers.
 */
function parseIssueNumbers(body) {
  if (!body) return new Set();

  const numbers = new Set();
  const patterns = [
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi,
    /related\s+to\s+#(\d+)/gi,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(body)) !== null) {
      numbers.add(parseInt(match[1], 10));
    }
  }
  return numbers;
}

module.exports = {
  hasDCOSignoff,
  hasVerifiedGPGSignature,
  isMergeCommit,
  checkDCO,
  checkGPG,
  parseIssueNumbers,
};

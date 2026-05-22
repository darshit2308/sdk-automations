// packages/probot-app/src/github-client.js
//
// Thin adapter for the GitHub API client.
// Wraps context.octokit to provide a consistent interface for core logic.
//
// Currently a pass-through — exists as an architectural seam for future
// GitHub App authentication concerns (token refresh, installation tokens,
// per-repo client scoping).

/**
 * Creates a GitHub client adapter from a Probot webhook context.
 *
 * @param {object} context - Probot webhook context.
 * @returns {object} An Octokit-compatible GitHub client.
 */
function createGitHubClient(context) {
  return context.octokit;
}

/**
 * Extracts owner and repo from a Probot webhook context.
 *
 * @param {object} context - Probot webhook context.
 * @returns {{ owner: string, repo: string }}
 */
function getRepoIdentifiers(context) {
  return context.repo();
}

module.exports = { createGitHubClient, getRepoIdentifiers };

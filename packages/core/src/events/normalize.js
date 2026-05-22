// packages/core/src/events/normalize.js
//
// Normalizes GitHub webhook payloads into a clean internal event structure.
// This is the first step in the core pipeline — all adapters (Probot, Actions,
// CLI) should normalize their input into this shape before passing to the router.

const ASSIGN_COMMAND = /^\s*\/assign\s*$/i;

/**
 * @typedef {object} NormalizedEvent
 * @property {string} type - The GitHub event type (e.g., 'issue_comment', 'pull_request').
 * @property {string} action - The event action (e.g., 'created', 'opened', 'synchronize').
 * @property {string|null} command - Parsed slash command, if any (e.g., '/assign').
 * @property {string} owner - Repository owner.
 * @property {string} repo - Repository name.
 * @property {object|null} issue - The issue object, if applicable.
 * @property {object|null} pullRequest - The pull request object, if applicable.
 * @property {object|null} comment - The comment object, if applicable.
 * @property {object|null} sender - The user who triggered the event.
 * @property {object} raw - The original raw payload.
 */

/**
 * Extracts the repository owner and name from a webhook payload.
 *
 * @param {object} payload - GitHub webhook payload.
 * @returns {{ owner: string, repo: string }}
 */
function extractRepo(payload) {
  const repository = payload.repository;
  if (repository) {
    return {
      owner: repository.owner?.login || repository.owner?.name || '',
      repo: repository.name || '',
    };
  }
  return { owner: '', repo: '' };
}

/**
 * Detects a slash command from a comment body.
 *
 * @param {string|null} body - Comment body text.
 * @returns {string|null} The detected command (e.g., '/assign') or null.
 */
function detectCommand(body) {
  if (!body) return null;
  if (ASSIGN_COMMAND.test(body)) return '/assign';
  return null;
}

/**
 * Normalizes a GitHub webhook payload into a clean internal event structure.
 *
 * @param {string} eventType - The GitHub event type (e.g., 'issue_comment', 'pull_request').
 * @param {object} payload - The webhook event payload.
 * @returns {NormalizedEvent}
 */
function normalizeEvent(eventType, payload) {
  const action = payload.action || '';
  const { owner, repo } = extractRepo(payload);

  const issue = payload.issue || null;
  const pullRequest = payload.pull_request || null;
  const comment = payload.comment || null;

  const command = comment ? detectCommand(comment.body) : null;

  const sender = payload.sender || comment?.user || pullRequest?.user || issue?.user || null;

  return {
    type: eventType,
    action,
    command,
    owner,
    repo,
    issue,
    pullRequest,
    comment,
    sender,
    raw: payload,
  };
}

module.exports = { normalizeEvent, extractRepo, detectCommand };

// packages/core/src/routing/route-event.js
//
// Routes a normalized event to the correct automation key.
// This replaces the implicit routing that was previously hardcoded
// in the Probot listener and the automation registry.

/**
 * Maps a normalized event to an automation key.
 *
 * Routing rules:
 * - issue_comment.created + /assign command → 'assign'
 * - pull_request.opened / pull_request.reopened → 'pr-checks'
 * - pull_request.synchronize / pull_request.edited → 'pr-checks'
 * - schedule / workflow_dispatch → 'review-sync'
 *
 * @param {import('../events/normalize').NormalizedEvent} event - The normalized event.
 * @returns {string|null} The automation key, or null if the event doesn't match any route.
 */
function routeEvent(event) {
  const { type, action, command } = event;

  // /assign command on issue comments
  if (type === 'issue_comment' && action === 'created' && command === '/assign') {
    return 'assign';
  }

  // PR opened or reopened → PR quality checks
  if (type === 'pull_request' && (action === 'opened' || action === 'reopened')) {
    return 'pr-checks';
  }

  // PR updated (new commits or body edit) → PR quality checks
  if (type === 'pull_request' && (action === 'synchronize' || action === 'edited')) {
    return 'pr-checks';
  }

  // Scheduled or manually triggered → review sync
  if (type === 'schedule' || type === 'workflow_dispatch') {
    return 'review-sync';
  }

  return null;
}

/**
 * Returns all supported automation keys.
 *
 * @returns {string[]}
 */
function getSupportedAutomations() {
  return ['assign', 'pr-checks', 'review-sync'];
}

module.exports = { routeEvent, getSupportedAutomations };

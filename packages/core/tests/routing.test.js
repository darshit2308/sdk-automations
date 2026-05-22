const assert = require('node:assert/strict');
const test = require('node:test');

const { routeEvent, getSupportedAutomations } = require('../src/routing/route-event');

// ─── routeEvent ──────────────────────────────────────────────────

test('routeEvent routes /assign command to assign', () => {
  const result = routeEvent({
    type: 'issue_comment',
    action: 'created',
    command: '/assign',
  });
  assert.equal(result, 'assign');
});

test('routeEvent routes pull_request.opened to pr-checks', () => {
  assert.equal(routeEvent({ type: 'pull_request', action: 'opened' }), 'pr-checks');
});

test('routeEvent routes pull_request.reopened to pr-checks', () => {
  assert.equal(routeEvent({ type: 'pull_request', action: 'reopened' }), 'pr-checks');
});

test('routeEvent routes pull_request.synchronize to pr-checks', () => {
  assert.equal(routeEvent({ type: 'pull_request', action: 'synchronize' }), 'pr-checks');
});

test('routeEvent routes pull_request.edited to pr-checks', () => {
  assert.equal(routeEvent({ type: 'pull_request', action: 'edited' }), 'pr-checks');
});

test('routeEvent routes schedule to review-sync', () => {
  assert.equal(routeEvent({ type: 'schedule', action: '' }), 'review-sync');
});

test('routeEvent routes workflow_dispatch to review-sync', () => {
  assert.equal(routeEvent({ type: 'workflow_dispatch', action: '' }), 'review-sync');
});

test('routeEvent returns null for unrecognized events', () => {
  assert.equal(routeEvent({ type: 'push', action: '' }), null);
  assert.equal(routeEvent({ type: 'issue_comment', action: 'created', command: null }), null);
  assert.equal(routeEvent({ type: 'pull_request', action: 'closed' }), null);
});

// ─── getSupportedAutomations ─────────────────────────────────────

test('getSupportedAutomations returns all automation keys', () => {
  const automations = getSupportedAutomations();
  assert.ok(automations.includes('assign'));
  assert.ok(automations.includes('pr-checks'));
  assert.ok(automations.includes('review-sync'));
  assert.equal(automations.length, 3);
});

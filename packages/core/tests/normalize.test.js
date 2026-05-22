const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeEvent, extractRepo, detectCommand } = require('../src/events/normalize');

// ─── extractRepo ─────────────────────────────────────────────────

test('extractRepo extracts owner and repo from webhook payload', () => {
  const result = extractRepo({
    repository: { owner: { login: 'hiero-ledger' }, name: 'hiero-sdk-python' },
  });
  assert.equal(result.owner, 'hiero-ledger');
  assert.equal(result.repo, 'hiero-sdk-python');
});

test('extractRepo handles missing repository gracefully', () => {
  const result = extractRepo({});
  assert.equal(result.owner, '');
  assert.equal(result.repo, '');
});

test('extractRepo handles owner as name string', () => {
  const result = extractRepo({
    repository: { owner: { name: 'org-name' }, name: 'repo-name' },
  });
  assert.equal(result.owner, 'org-name');
  assert.equal(result.repo, 'repo-name');
});

// ─── detectCommand ───────────────────────────────────────────────

test('detectCommand detects /assign command', () => {
  assert.equal(detectCommand('/assign'), '/assign');
  assert.equal(detectCommand('  /assign  '), '/assign');
  assert.equal(detectCommand('/ASSIGN'), '/assign');
});

test('detectCommand returns null for non-commands', () => {
  assert.equal(detectCommand('Hello world'), null);
  assert.equal(detectCommand('/help'), null);
  assert.equal(detectCommand(''), null);
  assert.equal(detectCommand(null), null);
});

// ─── normalizeEvent ──────────────────────────────────────────────

test('normalizeEvent normalizes issue_comment payload', () => {
  const payload = {
    action: 'created',
    repository: { owner: { login: 'test-org' }, name: 'test-repo' },
    issue: { number: 42, labels: [] },
    comment: { body: '/assign', user: { login: 'alice', type: 'User' } },
    sender: { login: 'alice' },
  };

  const event = normalizeEvent('issue_comment', payload);

  assert.equal(event.type, 'issue_comment');
  assert.equal(event.action, 'created');
  assert.equal(event.command, '/assign');
  assert.equal(event.owner, 'test-org');
  assert.equal(event.repo, 'test-repo');
  assert.equal(event.issue.number, 42);
  assert.equal(event.comment.body, '/assign');
  assert.equal(event.pullRequest, null);
  assert.equal(event.raw, payload);
});

test('normalizeEvent normalizes pull_request payload', () => {
  const payload = {
    action: 'opened',
    repository: { owner: { login: 'test-org' }, name: 'test-repo' },
    pull_request: { number: 7, user: { login: 'bob' } },
    sender: { login: 'bob' },
  };

  const event = normalizeEvent('pull_request', payload);

  assert.equal(event.type, 'pull_request');
  assert.equal(event.action, 'opened');
  assert.equal(event.command, null);
  assert.equal(event.pullRequest.number, 7);
  assert.equal(event.issue, null);
});

test('normalizeEvent handles minimal payload', () => {
  const event = normalizeEvent('schedule', {});

  assert.equal(event.type, 'schedule');
  assert.equal(event.action, '');
  assert.equal(event.command, null);
  assert.equal(event.owner, '');
  assert.equal(event.repo, '');
});

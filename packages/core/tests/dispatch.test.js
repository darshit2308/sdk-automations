const assert = require('node:assert/strict');
const test = require('node:test');

const { getAutomation, runAutomation, dispatch } = require('../src/dispatcher/dispatch');

// ─── getAutomation ───────────────────────────────────────────────

test('getAutomation returns function for valid automation names', () => {
  assert.equal(typeof getAutomation('assign'), 'function');
  assert.equal(typeof getAutomation('pr-checks'), 'function');
  assert.equal(typeof getAutomation('review-sync'), 'function');
});

test('getAutomation throws for unknown automation', () => {
  assert.throws(
    () => getAutomation('nonexistent'),
    /Unsupported automation: nonexistent/
  );
});

// ─── runAutomation ───────────────────────────────────────────────

test('runAutomation throws for unknown automation', async () => {
  await assert.rejects(
    () => runAutomation('bad-name', {}),
    /Unsupported automation: bad-name/
  );
});

// ─── dispatch ────────────────────────────────────────────────────

test('dispatch throws for unknown automation key', async () => {
  await assert.rejects(
    () => dispatch({ automationKey: 'nonexistent', github: {}, config: {} }),
    /Unsupported automation: nonexistent/
  );
});

test('dispatch passes options to policy function', async () => {
  // We test by dispatching to 'assign' with an issue that's already assigned
  // This should return { assigned: false, reason: 'already_assigned' }
  const mockGithub = {
    rest: {
      reactions: { createForIssueComment: async () => ({}) },
      issues: { createComment: async () => ({}) },
    },
  };

  const config = {
    repository: { owner: 'test', name: 'test' },
    labels: {
      reviewQueue: {
        juniorCommitter: 'a', committers: 'b', maintainers: 'c',
        readyToMerge: 'd', communityReview: 'e',
      },
    },
  };

  const event = {
    owner: 'test',
    repo: 'test',
    issue: { number: 1, labels: [], assignees: [{ login: 'bob' }] },
    comment: { id: 100, user: { login: 'alice' } },
    raw: {},
  };

  const logger = { info: () => {}, error: () => {}, log: () => {} };

  const result = await dispatch({
    automationKey: 'assign',
    github: mockGithub,
    config,
    event,
    logger,
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'already_assigned');
});

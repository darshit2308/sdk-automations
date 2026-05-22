const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildReviewQueueLabels,
  determineLabel,
  runReviewSync,
} = require('../src/policies/review-sync/policy');
const { createConfig, createMockGithub, createLogger } = require('./test-utils');

test('determineLabel maps approval states to review queue labels', () => {
  const labels = buildReviewQueueLabels(createConfig());

  assert.equal(
    determineLabel({ maintainerApprovals: 0, coreApprovals: 0, softApprovals: 0, anyApproval: 0 }, false, labels).name,
    'queue:junior-committer'
  );
  assert.equal(
    determineLabel({ maintainerApprovals: 0, coreApprovals: 0, softApprovals: 1, anyApproval: 1 }, false, labels).name,
    'queue:committers'
  );
  assert.equal(
    determineLabel({ maintainerApprovals: 0, coreApprovals: 1, softApprovals: 0, anyApproval: 1 }, false, labels).name,
    'queue:maintainers'
  );
  assert.equal(
    determineLabel({ maintainerApprovals: 1, coreApprovals: 2, softApprovals: 0, anyApproval: 2 }, false, labels).name,
    'status: ready-to-merge'
  );
  assert.equal(
    determineLabel({ maintainerApprovals: 1, coreApprovals: 2, softApprovals: 0, anyApproval: 2 }, true, labels).name,
    'queue:junior-committer'
  );
});

test('runReviewSync honors dry-run without mutating labels', async () => {
  const github = createMockGithub({
    pullRequests: [
      {
        number: 7,
        draft: false,
        labels: [{ name: 'queue:committers' }],
        head: { sha: 'abc123' },
        user: { type: 'User' },
      },
    ],
    existingLabels: {
      'queue:junior-committer': true,
      'queue:committers': true,
      'queue:maintainers': true,
      'status: ready-to-merge': true,
      'open to community review': true,
    },
  });
  const logger = createLogger();

  const summary = await runReviewSync({
    github,
    config: createConfig(),
    dryRun: true,
    logger,
  });

  assert.equal(summary.dryRun, true);
  assert.equal(summary.changed, 1);
  assert.deepEqual(github.calls.labelsAdded, []);
  assert.deepEqual(github.calls.labelsRemoved, []);
});

test('runReviewSync skips when rate limit is below floor', async () => {
  const github = createMockGithub({ rateLimitRemaining: 10 });
  const result = await runReviewSync({
    github,
    config: createConfig(),
    logger: createLogger(),
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'rate-limit');
  assert.equal(github.calls.pullsListed, 0);
});

test('runReviewSync ignores draft PRs by default', async () => {
  const github = createMockGithub({
    pullRequests: [
      {
        number: 1,
        draft: true,
        labels: [],
        head: { sha: 'draft' },
        user: { type: 'User' },
      },
    ],
    existingLabels: {
      'queue:junior-committer': true,
      'queue:committers': true,
      'queue:maintainers': true,
      'status: ready-to-merge': true,
      'open to community review': true,
    },
  });

  const summary = await runReviewSync({
    github,
    config: createConfig(),
    logger: createLogger(),
  });

  assert.equal(summary.processed, 0);
});

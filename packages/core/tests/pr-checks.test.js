const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hasDCOSignoff,
  hasVerifiedGPGSignature,
  isMergeCommit,
  checkDCO,
  checkGPG,
  parseIssueNumbers,
} = require('../src/automations/pr-checks/checks');

const {
  allChecksPassed,
  buildBotComment,
  MARKER,
} = require('../src/automations/pr-checks/comments');

// ─── Test helpers ────────────────────────────────────────────────

function createLogger() {
  const lines = [];
  return {
    lines,
    info(msg) { lines.push(String(msg)); },
    error(msg) { lines.push(String(msg)); },
    log(msg) { lines.push(String(msg)); },
  };
}

function makeCommit({ sha = 'abc1234567', message = 'test commit', verified = true, parents = 1 }) {
  return {
    sha,
    commit: {
      message,
      verification: { verified },
    },
    parents: Array.from({ length: parents }, () => ({ sha: 'parent' })),
  };
}

function createConfig(overrides = {}) {
  return {
    repository: { owner: 'hiero-ledger', name: 'hiero-sdk-test' },
    labels: {
      reviewQueue: {
        juniorCommitter: 'queue:junior-committer',
        committers: 'queue:committers',
        maintainers: 'queue:maintainers',
        readyToMerge: 'status: ready-to-merge',
        communityReview: 'open to community review',
      },
    },
    maintainerTeam: '@hiero-ledger/maintainers',
    documentation: {
      signingGuide: 'https://example.com/signing',
      mergeConflictsGuide: 'https://example.com/merge',
    },
    ...overrides,
  };
}

// ─── hasDCOSignoff ───────────────────────────────────────────────

test('hasDCOSignoff returns true for valid sign-off', () => {
  assert.equal(hasDCOSignoff('feat: add thing\n\nSigned-off-by: John Doe <john@example.com>'), true);
});

test('hasDCOSignoff returns false for missing sign-off', () => {
  assert.equal(hasDCOSignoff('feat: add thing\n\nNo sign-off here'), false);
});

test('hasDCOSignoff returns false for null/empty', () => {
  assert.equal(hasDCOSignoff(null), false);
  assert.equal(hasDCOSignoff(''), false);
});

// ─── hasVerifiedGPGSignature ─────────────────────────────────────

test('hasVerifiedGPGSignature returns true for verified commit', () => {
  assert.equal(hasVerifiedGPGSignature(makeCommit({ verified: true })), true);
});

test('hasVerifiedGPGSignature returns false for unverified commit', () => {
  assert.equal(hasVerifiedGPGSignature(makeCommit({ verified: false })), false);
});

test('hasVerifiedGPGSignature returns false for missing verification', () => {
  assert.equal(hasVerifiedGPGSignature({}), false);
  assert.equal(hasVerifiedGPGSignature(null), false);
});

// ─── isMergeCommit ───────────────────────────────────────────────

test('isMergeCommit returns true for multi-parent commit', () => {
  assert.equal(isMergeCommit(makeCommit({ parents: 2 })), true);
});

test('isMergeCommit returns false for single-parent commit', () => {
  assert.equal(isMergeCommit(makeCommit({ parents: 1 })), false);
});

// ─── checkDCO ────────────────────────────────────────────────────

test('checkDCO passes when all commits have sign-offs', () => {
  const commits = [
    makeCommit({ message: 'feat: thing\n\nSigned-off-by: A <a@b.com>' }),
    makeCommit({ message: 'fix: thing\n\nSigned-off-by: B <b@c.com>' }),
  ];
  const result = checkDCO(commits, createLogger());
  assert.equal(result.passed, true);
  assert.equal(result.failures.length, 0);
});

test('checkDCO fails when a commit is missing sign-off', () => {
  const commits = [
    makeCommit({ sha: 'aaa1111111', message: 'feat: thing\n\nSigned-off-by: A <a@b.com>' }),
    makeCommit({ sha: 'bbb2222222', message: 'fix: no signoff here' }),
  ];
  const result = checkDCO(commits, createLogger());
  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].sha, 'bbb2222');
});

test('checkDCO skips merge commits', () => {
  const commits = [
    makeCommit({ message: 'Merge branch main', parents: 2 }),
    makeCommit({ message: 'feat: thing\n\nSigned-off-by: A <a@b.com>' }),
  ];
  const result = checkDCO(commits, createLogger());
  assert.equal(result.passed, true);
});

// ─── checkGPG ────────────────────────────────────────────────────

test('checkGPG passes when all commits are verified', () => {
  const commits = [
    makeCommit({ verified: true }),
    makeCommit({ verified: true }),
  ];
  const result = checkGPG(commits, createLogger());
  assert.equal(result.passed, true);
  assert.equal(result.failures.length, 0);
});

test('checkGPG fails when a commit is unverified', () => {
  const commits = [
    makeCommit({ sha: 'aaa1111111', verified: true }),
    makeCommit({ sha: 'bbb2222222', verified: false }),
  ];
  const result = checkGPG(commits, createLogger());
  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].sha, 'bbb2222');
});

// ─── parseIssueNumbers ──────────────────────────────────────────

test('parseIssueNumbers finds closing keywords', () => {
  const numbers = parseIssueNumbers('Fixes #42, closes #99');
  assert.equal(numbers.has(42), true);
  assert.equal(numbers.has(99), true);
  assert.equal(numbers.size, 2);
});

test('parseIssueNumbers finds "related to" pattern', () => {
  const numbers = parseIssueNumbers('Related to #7');
  assert.equal(numbers.has(7), true);
});

test('parseIssueNumbers finds resolve/resolves/resolved', () => {
  const numbers = parseIssueNumbers('Resolves #10\nResolved #20\nResolve #30');
  assert.equal(numbers.has(10), true);
  assert.equal(numbers.has(20), true);
  assert.equal(numbers.has(30), true);
});

test('parseIssueNumbers returns empty set for no matches', () => {
  const numbers = parseIssueNumbers('No issue references here');
  assert.equal(numbers.size, 0);
});

test('parseIssueNumbers handles null/empty body', () => {
  assert.equal(parseIssueNumbers(null).size, 0);
  assert.equal(parseIssueNumbers('').size, 0);
});

// ─── allChecksPassed ─────────────────────────────────────────────

test('allChecksPassed returns true when all checks pass', () => {
  assert.equal(allChecksPassed({
    dco: { passed: true },
    gpg: { passed: true },
    merge: { passed: true },
    issueLink: { passed: true },
  }), true);
});

test('allChecksPassed returns false when any check fails', () => {
  assert.equal(allChecksPassed({
    dco: { passed: true },
    gpg: { passed: false, failures: [] },
    merge: { passed: true },
    issueLink: { passed: true },
  }), false);
});

test('allChecksPassed returns false when any check has an error', () => {
  assert.equal(allChecksPassed({
    dco: { passed: true },
    gpg: { passed: true },
    merge: { error: true, errorMessage: 'timeout' },
    issueLink: { passed: true },
  }), false);
});

// ─── buildBotComment ─────────────────────────────────────────────

test('buildBotComment produces passing comment', () => {
  const config = createConfig();
  const result = buildBotComment({
    prAuthor: 'testuser',
    dco: { passed: true, failures: [] },
    gpg: { passed: true, failures: [] },
    merge: { passed: true },
    issueLink: { passed: true, issues: [{ number: 1, isAssigned: true }] },
    config,
  });

  assert.equal(result.marker, MARKER);
  assert.equal(result.allPassed, true);
  assert.ok(result.body.includes(MARKER));
  assert.ok(result.body.includes('@testuser'));
  assert.ok(result.body.includes(':tada:'));
  assert.ok(result.body.includes(':white_check_mark:'));
});

test('buildBotComment produces failing comment with config-driven URLs', () => {
  const config = createConfig();
  const result = buildBotComment({
    prAuthor: 'testuser',
    dco: { passed: false, failures: [{ sha: 'abc1234', message: 'bad commit' }] },
    gpg: { passed: true, failures: [] },
    merge: { passed: true },
    issueLink: { passed: false, reason: 'no_issue_linked', issues: [] },
    config,
  });

  assert.equal(result.allPassed, false);
  assert.ok(result.body.includes(':x:'));
  assert.ok(result.body.includes('https://example.com/signing'));
  assert.ok(result.body.includes(':hourglass_flowing_sand:'));
});

test('buildBotComment handles error state in checks', () => {
  const config = createConfig();
  const result = buildBotComment({
    prAuthor: 'testuser',
    dco: { error: true, errorMessage: 'API timeout' },
    gpg: { passed: true, failures: [] },
    merge: { passed: true },
    issueLink: { passed: true, issues: [{ number: 1, isAssigned: true }] },
    config,
  });

  assert.equal(result.allPassed, false);
  assert.ok(result.body.includes(':warning:'));
  assert.ok(result.body.includes('API timeout'));
  assert.ok(result.body.includes('@hiero-ledger/maintainers'));
});

test('buildBotComment works without optional config fields', () => {
  const minimalConfig = {
    repository: { owner: 'test', name: 'test' },
    labels: {
      reviewQueue: {
        juniorCommitter: 'q:jc',
        committers: 'q:c',
        maintainers: 'q:m',
        readyToMerge: 'q:rtm',
        communityReview: 'q:cr',
      },
    },
  };
  const result = buildBotComment({
    prAuthor: 'user',
    dco: { passed: true, failures: [] },
    gpg: { passed: true, failures: [] },
    merge: { passed: true },
    issueLink: { passed: true, issues: [{ number: 1, isAssigned: true }] },
    config: minimalConfig,
  });

  assert.equal(result.allPassed, true);
  assert.ok(result.body.includes(MARKER));
});

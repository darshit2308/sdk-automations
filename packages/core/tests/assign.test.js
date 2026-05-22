const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildWelcomeComment,
  buildAlreadyAssignedComment,
  buildNotReadyComment,
  buildNoSkillLevelComment,
  buildAssignmentLimitExceededComment,
  buildPrerequisiteNotMetComment,
  buildGfiCapExceededComment,
} = require('../src/policies/assign/messages');

const { runAssign } = require('../src/policies/assign/policy');

// ─── Test helpers ────────────────────────────────────────────────

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
      status: {
        readyForDev: 'status: ready for dev',
        inProgress: 'status: in progress',
        blocked: 'status: blocked',
      },
      skill: {
        goodFirstIssue: 'skill: good first issue',
        beginner: 'skill: beginner',
        intermediate: 'skill: intermediate',
        advanced: 'skill: advanced',
      },
    },
    maintainerTeam: '@hiero-ledger/maintainers',
    assignment: {
      enabled: true,
      maxOpenAssignments: 2,
    },
    skillHierarchy: [
      'skill: good first issue',
      'skill: beginner',
      'skill: intermediate',
      'skill: advanced',
    ],
    skillPrerequisites: {
      'skill: good first issue': {
        requiredLabel: null,
        requiredCount: 0,
        displayName: 'Good First Issue',
      },
      'skill: beginner': {
        requiredLabel: 'skill: good first issue',
        requiredCount: 2,
        displayName: 'Beginner',
        prerequisiteDisplayName: 'Good First Issues',
      },
      'skill: intermediate': {
        requiredLabel: 'skill: beginner',
        requiredCount: 3,
        displayName: 'Intermediate',
        prerequisiteDisplayName: 'Beginner Issues',
      },
      'skill: advanced': {
        requiredLabel: 'skill: intermediate',
        requiredCount: 3,
        displayName: 'Advanced',
        prerequisiteDisplayName: 'Intermediate Issues',
      },
    },
    ...overrides,
  };
}

function createLogger() {
  const lines = [];
  return {
    lines,
    info(msg) { lines.push(String(msg)); },
    error(msg) { lines.push(String(msg)); },
    log(msg) { lines.push(String(msg)); },
  };
}

function createMockGithub(options = {}) {
  const {
    openAssignments = 0,
    closedPrereqs = 0,
  } = options;

  const calls = {
    reactions: [],
    comments: [],
    assignees: [],
    labelsAdded: [],
    labelsRemoved: [],
    searches: [],
  };

  return {
    calls,
    rest: {
      reactions: {
        createForIssueComment: async (params) => {
          calls.reactions.push(params);
          return {};
        },
      },
      issues: {
        createComment: async (params) => {
          calls.comments.push(params);
          return {};
        },
        addAssignees: async (params) => {
          calls.assignees.push(params);
          return {};
        },
        addLabels: async (params) => {
          calls.labelsAdded.push(...params.labels);
          return {};
        },
        removeLabel: async (params) => {
          calls.labelsRemoved.push(params.name);
          return {};
        },
      },
      search: {
        issuesAndPullRequests: async ({ q }) => {
          calls.searches.push(q);
          // First search is open assignments, second is closed prerequisites
          if (q.includes('is:open')) {
            return { data: { total_count: openAssignments } };
          }
          if (q.includes('is:closed')) {
            return { data: { total_count: closedPrereqs } };
          }
          return { data: { total_count: 0 } };
        },
      },
    },
  };
}

// ─── Message builder tests ───────────────────────────────────────

test('buildWelcomeComment for good first issue', () => {
  const config = createConfig();
  const msg = buildWelcomeComment('alice', 'skill: good first issue', config);
  assert.ok(msg.includes('@alice'));
  assert.ok(msg.includes('Good First Issue'));
  assert.ok(msg.includes('welcome'));
});

test('buildWelcomeComment for higher skill level', () => {
  const config = createConfig();
  const msg = buildWelcomeComment('alice', 'skill: beginner', config);
  assert.ok(msg.includes('@alice'));
  assert.ok(msg.includes('Beginner'));
});

test('buildAlreadyAssignedComment same user', () => {
  const msg = buildAlreadyAssignedComment('alice', 'alice');
  assert.ok(msg.includes('already assigned'));
  assert.ok(msg.includes('@alice'));
});

test('buildAlreadyAssignedComment different user', () => {
  const msg = buildAlreadyAssignedComment('alice', 'bob');
  assert.ok(msg.includes('@bob'));
  assert.ok(msg.includes('already assigned'));
});

test('buildNotReadyComment uses config label', () => {
  const config = createConfig();
  const msg = buildNotReadyComment('alice', config);
  assert.ok(msg.includes('status: ready for dev'));
});

test('buildNoSkillLevelComment includes maintainer team', () => {
  const config = createConfig();
  const msg = buildNoSkillLevelComment('alice', config);
  assert.ok(msg.includes('@hiero-ledger/maintainers'));
});

test('buildAssignmentLimitExceededComment uses config limit', () => {
  const config = createConfig();
  const msg = buildAssignmentLimitExceededComment('alice', 3, config);
  assert.ok(msg.includes('2 open issues'));
  assert.ok(msg.includes('3'));
});

test('buildPrerequisiteNotMetComment uses config prereqs', () => {
  const config = createConfig();
  const msg = buildPrerequisiteNotMetComment('alice', 'skill: beginner', 1, config);
  assert.ok(msg.includes('Beginner'));
  assert.ok(msg.includes('2 Good First Issues'));
  assert.ok(msg.includes('1'));
});

test('buildGfiCapExceededComment uses config hierarchy', () => {
  const config = createConfig();
  const msg = buildGfiCapExceededComment('alice', 5, 5, config);
  assert.ok(msg.includes('5 Good First Issues'));
  assert.ok(msg.includes('graduated'));
  assert.ok(msg.includes('Beginner'));
});

// ─── runAssign integration tests ─────────────────────────────────

test('runAssign rejects when issue is already assigned', async () => {
  const github = createMockGithub();
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }, { name: 'skill: good first issue' }],
      assignees: [{ login: 'bob' }],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'already_assigned');
  assert.equal(github.calls.comments.length, 1);
  assert.ok(github.calls.comments[0].body.includes('@bob'));
});

test('runAssign rejects when issue is not ready for dev', async () => {
  const github = createMockGithub();
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'skill: good first issue' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'not_ready');
});

test('runAssign rejects when no skill level label', async () => {
  const github = createMockGithub();
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'no_skill_level');
});

test('runAssign rejects when assignment limit exceeded', async () => {
  const github = createMockGithub({ openAssignments: 5 });
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }, { name: 'skill: good first issue' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'limit_exceeded');
});

test('runAssign rejects when GFI cap is exceeded', async () => {
  // 5 closed GFIs
  const github = createMockGithub({ openAssignments: 0, closedPrereqs: 5 });
  const config = createConfig({
    assignment: { enabled: true, maxOpenAssignments: 2, maxGoodFirstIssueCompletions: 5 }
  });

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }, { name: 'skill: good first issue' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'gfi_cap_exceeded');
  assert.ok(github.calls.comments[0].body.includes('graduated'));
});

test('runAssign rejects when prerequisite not met', async () => {
  const github = createMockGithub({ openAssignments: 0, closedPrereqs: 1 });
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }, { name: 'skill: beginner' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, false);
  assert.equal(result.reason, 'prerequisite_not_met');
});

test('runAssign succeeds for good first issue with no prereqs', async () => {
  const github = createMockGithub({ openAssignments: 0 });
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }, { name: 'skill: good first issue' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, true);
  assert.equal(result.reason, null);
  assert.equal(github.calls.assignees.length, 1);
  assert.deepEqual(github.calls.assignees[0].assignees, ['alice']);
  assert.ok(github.calls.labelsAdded.includes('status: in progress'));
  assert.ok(github.calls.labelsRemoved.includes('status: ready for dev'));
});

test('runAssign succeeds for beginner when prereqs met', async () => {
  const github = createMockGithub({ openAssignments: 0, closedPrereqs: 5 });
  const config = createConfig();

  const result = await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [{ name: 'status: ready for dev' }, { name: 'skill: beginner' }],
      assignees: [],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(result.assigned, true);
});

test('runAssign always reacts with thumbs-up', async () => {
  const github = createMockGithub();
  const config = createConfig();

  await runAssign({
    github,
    owner: 'hiero-ledger',
    repo: 'hiero-sdk-test',
    issue: {
      number: 1,
      labels: [],
      assignees: [{ login: 'someone' }],
    },
    comment: { id: 100, user: { login: 'alice' } },
    config,
    logger: createLogger(),
  });

  assert.equal(github.calls.reactions.length, 1);
  assert.equal(github.calls.reactions[0].content, '+1');
});

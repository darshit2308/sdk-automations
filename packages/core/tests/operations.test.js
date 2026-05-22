const assert = require('node:assert/strict');
const test = require('node:test');

const { createOperationPlan, OperationType } = require('../src/operations/operation-plan');
const { executeOperations } = require('../src/operations/executor');

// ─── OperationType ───────────────────────────────────────────────

test('OperationType has all expected types', () => {
  assert.equal(OperationType.ADD_LABEL, 'add_label');
  assert.equal(OperationType.REMOVE_LABEL, 'remove_label');
  assert.equal(OperationType.ADD_COMMENT, 'add_comment');
  assert.equal(OperationType.UPDATE_COMMENT, 'update_comment');
  assert.equal(OperationType.ADD_ASSIGNEE, 'add_assignee');
  assert.equal(OperationType.ADD_REACTION, 'add_reaction');
});

test('OperationType is frozen', () => {
  OperationType.NEW_TYPE = 'new';
  assert.equal(OperationType.NEW_TYPE, undefined, 'frozen object should not accept new properties');
});

// ─── createOperationPlan ─────────────────────────────────────────

test('createOperationPlan builds plan with chaining', () => {
  const plan = createOperationPlan({
    owner: 'test',
    repo: 'test-repo',
    issueNumber: 42,
    automationKey: 'assign',
  });

  plan
    .addReaction(100, '+1')
    .addAssignee('alice')
    .addLabel('status: in progress')
    .removeLabel('status: ready for dev')
    .addComment('Welcome!');

  assert.equal(plan.operations.length, 5);
  assert.equal(plan.operations[0].type, OperationType.ADD_REACTION);
  assert.equal(plan.operations[1].type, OperationType.ADD_ASSIGNEE);
  assert.equal(plan.operations[1].username, 'alice');
  assert.equal(plan.operations[2].type, OperationType.ADD_LABEL);
  assert.equal(plan.operations[3].type, OperationType.REMOVE_LABEL);
  assert.equal(plan.operations[4].type, OperationType.ADD_COMMENT);
});

test('createOperationPlan summarize returns readable string', () => {
  const plan = createOperationPlan({
    owner: 'org',
    repo: 'repo',
    issueNumber: 1,
    automationKey: 'test',
  });

  plan.addLabel('bug').addComment('Hello');
  const summary = plan.summarize();
  assert.ok(summary.includes('[test]'));
  assert.ok(summary.includes('+ label "bug"'));
  assert.ok(summary.includes('+ comment'));
});

test('createOperationPlan summarize handles empty plan', () => {
  const plan = createOperationPlan({
    owner: 'org',
    repo: 'repo',
    issueNumber: 1,
    automationKey: 'test',
  });

  const summary = plan.summarize();
  assert.ok(summary.includes('No operations planned'));
});

// ─── executeOperations ───────────────────────────────────────────

test('executeOperations dry-run skips all operations', async () => {
  const plan = createOperationPlan({
    owner: 'test',
    repo: 'test',
    issueNumber: 1,
    automationKey: 'test',
  });
  plan.addLabel('bug').addComment('test');

  const logLines = [];
  const logger = { info: (m) => logLines.push(m), error: (m) => logLines.push(m) };

  const result = await executeOperations({ plan, github: {}, dryRun: true, logger });

  assert.equal(result.executed, 0);
  assert.equal(result.skipped, 2);
  assert.equal(result.errors, 0);
  assert.ok(logLines.some(l => l.includes('[DRY RUN]')));
});

test('executeOperations executes add_label operation', async () => {
  const plan = createOperationPlan({
    owner: 'test',
    repo: 'test',
    issueNumber: 1,
    automationKey: 'test',
  });
  plan.addLabel('bug');

  const addedLabels = [];
  const github = {
    rest: {
      issues: {
        addLabels: async ({ labels }) => { addedLabels.push(...labels); },
      },
    },
  };

  const logger = { info: () => {}, error: () => {} };
  const result = await executeOperations({ plan, github, logger });

  assert.equal(result.executed, 1);
  assert.deepEqual(addedLabels, ['bug']);
});

test('executeOperations handles errors gracefully', async () => {
  const plan = createOperationPlan({
    owner: 'test',
    repo: 'test',
    issueNumber: 1,
    automationKey: 'test',
  });
  plan.addLabel('bug');

  const github = {
    rest: {
      issues: {
        addLabels: async () => { throw new Error('API failure'); },
      },
    },
  };

  const logger = { info: () => {}, error: () => {} };
  const result = await executeOperations({ plan, github, logger });

  assert.equal(result.executed, 0);
  assert.equal(result.errors, 1);
});

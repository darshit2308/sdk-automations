const assert = require('node:assert/strict');
const test = require('node:test');

// We test the adapter's event routing logic by requiring the module
// and calling it with a mock Probot app object.

const registerProbotApp = require('../src/index');

// ─── Test helpers ────────────────────────────────────────────────

function createMockApp() {
  const handlers = {};
  const logLines = [];

  const app = {
    log: {
      info(msg) { logLines.push(`INFO: ${msg}`); },
      error(msg) { logLines.push(`ERROR: ${msg}`); },
    },
    logLines,
    handlers,
    on(events, handler) {
      const eventList = Array.isArray(events) ? events : [events];
      for (const event of eventList) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }
    },
  };

  return app;
}

// ─── Registration tests ─────────────────────────────────────────

test('registerProbotApp registers all expected event handlers', () => {
  const app = createMockApp();
  registerProbotApp(app);

  // Should register issue_comment.created
  assert.ok(app.handlers['issue_comment.created'], 'missing issue_comment.created handler');
  assert.ok(app.handlers['issue_comment.created'].length > 0);

  // Should register pull_request.opened
  assert.ok(app.handlers['pull_request.opened'], 'missing pull_request.opened handler');

  // Should register pull_request.reopened
  assert.ok(app.handlers['pull_request.reopened'], 'missing pull_request.reopened handler');

  // Should register pull_request.synchronize
  assert.ok(app.handlers['pull_request.synchronize'], 'missing pull_request.synchronize handler');

  // Should register pull_request.edited
  assert.ok(app.handlers['pull_request.edited'], 'missing pull_request.edited handler');
});

test('registerProbotApp logs startup message', () => {
  const app = createMockApp();
  registerProbotApp(app);

  assert.ok(
    app.logLines.some(l => l.includes('running')),
    'should log startup message'
  );
});

// ─── issue_comment handler filtering tests ───────────────────────

test('issue_comment handler ignores PR comments', async () => {
  const app = createMockApp();
  registerProbotApp(app);

  const handler = app.handlers['issue_comment.created'][0];
  // Should not throw — just silently return
  await handler({
    payload: {
      issue: { pull_request: { url: 'https://...' } },
      comment: { body: '/assign', user: { login: 'alice', type: 'User' } },
    },
  });

  // No error log means it was silently ignored
  assert.ok(!app.logLines.some(l => l.includes('ERROR')));
});

test('issue_comment handler ignores bot comments', async () => {
  const app = createMockApp();
  registerProbotApp(app);

  const handler = app.handlers['issue_comment.created'][0];
  await handler({
    payload: {
      issue: { number: 1 },
      comment: { body: '/assign', user: { login: 'bot', type: 'Bot' } },
    },
  });

  assert.ok(!app.logLines.some(l => l.includes('Detected /assign')));
});

test('issue_comment handler ignores non-assign commands', async () => {
  const app = createMockApp();
  registerProbotApp(app);

  const handler = app.handlers['issue_comment.created'][0];
  await handler({
    payload: {
      issue: { number: 1 },
      comment: { body: 'Hello world!', user: { login: 'alice', type: 'User' } },
    },
  });

  assert.ok(!app.logLines.some(l => l.includes('Detected /assign')));
});

test('issue_comment handler detects /assign command', async () => {
  const app = createMockApp();
  registerProbotApp(app);

  const handler = app.handlers['issue_comment.created'][0];

  // This will fail at the config-loading step (no real octokit),
  // but it should at least log that it detected the command first.
  try {
    await handler({
      payload: {
        issue: { number: 1, labels: [], assignees: [] },
        comment: { id: 100, body: '/assign', user: { login: 'alice', type: 'User' } },
        repository: { owner: { login: 'test' }, name: 'test' },
      },
      octokit: {
        repos: {
          getContent: async () => { throw new Error('test-no-config'); },
        },
        rest: {
          reactions: { createForIssueComment: async () => ({}) },
          issues: {
            createComment: async () => ({}),
            addAssignees: async () => ({}),
            addLabels: async () => ({}),
            removeLabel: async () => ({}),
          },
          search: {
            issuesAndPullRequests: async () => ({ data: { total_count: 0 } }),
          },
        },
      },
      repo: () => ({ owner: 'test', repo: 'test' }),
    });
  } catch {
    // Expected — no real GitHub API available
  }

  assert.ok(
    app.logLines.some(l => l.includes('Detected /assign command from: alice')),
    'should log /assign detection'
  );
});

// ─── pull_request handler filtering tests ────────────────────────

test('pull_request.opened handler skips bot PRs', async () => {
  const app = createMockApp();
  registerProbotApp(app);

  const handler = app.handlers['pull_request.opened'][0];
  await handler({
    payload: {
      pull_request: {
        number: 1,
        html_url: 'https://github.com/test/test/pull/1',
        user: { login: 'dependabot', type: 'Bot' },
        assignees: [],
      },
    },
  });

  // Should not attempt to load config or process further
  assert.ok(!app.logLines.some(l => l.includes('ERROR')));
});

test('pull_request.edited handler skips non-body edits', async () => {
  const app = createMockApp();
  registerProbotApp(app);

  const handler = app.handlers['pull_request.edited'][0];
  await handler({
    payload: {
      action: 'edited',
      changes: { title: { from: 'old' } },
      pull_request: {
        number: 1,
        html_url: 'https://github.com/test/test/pull/1',
        user: { login: 'alice', type: 'User' },
      },
    },
  });

  assert.ok(
    app.logLines.some(l => l.includes('Body not changed')),
    'should log that body was not changed'
  );
});

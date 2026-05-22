const registerProbotApp = require('./packages/probot-app/src/index');
const { parseConfig } = require('@hiero-sdk-automations/core');
const app = {
  log: {
    info: console.log,
    error: console.error
  },
  on: (events, handler) => {
    if (events === 'issue_comment.created') {
      setTimeout(() => handler({
        payload: {
          issue: { number: 1, labels: [], assignees: [{ login: 'alice' }] },
          comment: { id: 100, body: '/assign', user: { login: 'alice', type: 'User' } }
        },
        octokit: {
          repos: {
            getContent: async ({ path }) => {
              if (path.endsWith('.json')) {
                const err = new Error('Not found');
                err.status = 404;
                throw err;
              }
              return {
                data: { content: Buffer.from(`repository:\n  owner: test\n  name: test\nlabels:\n  reviewQueue:\n    juniorCommitter: a\n    committers: b\n    maintainers: c\n    readyToMerge: d\n    communityReview: e\n`).toString('base64') }
              };
            }
          },
          rest: { reactions: { createForIssueComment: async () => ({}) }, issues: { createComment: async () => ({}) } }
        },
        repo: () => ({ owner: 'test', repo: 'test' })
      }), 100);
    }
  }
};
registerProbotApp(app);

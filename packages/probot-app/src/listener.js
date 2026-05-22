// packages/probot-app/src/listener.js
//
// Probot webhook listener.
// Registers all GitHub webhook event handlers and delegates to core policies.
//
// This module is adapter-specific — it bridges Probot's webhook delivery
// with the shared core logic. The equivalent for GitHub Actions is
// packages/github-action-adapter.

const { runPRChecks } = require('@hiero-sdk-automations/core/src/policies/pr-checks/policy');
const { runAssign } = require('@hiero-sdk-automations/core/src/policies/assign/policy');
const { loadRepoConfig } = require('./config-loader');
const { createLogger } = require('./audit-sink');

const ASSIGN_COMMAND = /^\s*\/assign\s*$/i;

/**
 * Registers all Probot event handlers.
 *
 * @param {import('probot').Probot} app - The Probot application instance.
 */
function registerListeners(app) {
  // ───────────────────────────────────────────────────────────────
  // /assign command handler
  // ───────────────────────────────────────────────────────────────
  app.on('issue_comment.created', async (context) => {
    const { issue, comment } = context.payload;

    // Ignore PR comments
    if (issue.pull_request) return;

    // Ignore bot comments
    if (comment.user.type === 'Bot') return;

    // Only process /assign commands
    if (!ASSIGN_COMMAND.test(comment.body)) return;

    const logger = createLogger(app.log);
    app.log.info(`Detected /assign command from: ${comment.user.login}`);

    try {
      const config = await loadRepoConfig(context, logger, 'assign');
      const { owner, repo } = context.repo();

      await runAssign({
        github: context.octokit,
        owner,
        repo,
        issue,
        comment,
        config,
        logger,
      });
    } catch (error) {
      app.log.error(`Error handling /assign: ${error.message}`);
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PR Opened / Reopened handler
  // ───────────────────────────────────────────────────────────────
  app.on(['pull_request.opened', 'pull_request.reopened'], async (context) => {
    const pr = context.payload.pull_request;
    app.log.info(`PR Opened/Reopened: ${pr.html_url}`);

    // Skip bot-authored PRs
    if (pr.user.type === 'Bot') return;

    const logger = createLogger(app.log);

    try {
      const config = await loadRepoConfig(context, logger, 'pr-checks');
      const { owner, repo } = context.repo();
      const prAuthor = pr.user.login;

      // Auto-assign the PR author
      const isAlreadyAssigned = (pr.assignees || []).some(
        a => (a?.login || '').toLowerCase() === prAuthor.toLowerCase()
      );
      if (!isAlreadyAssigned) {
        await context.octokit.issues.addAssignees(
          context.repo({ issue_number: pr.number, assignees: [prAuthor] })
        );
        app.log.info(`Auto-assigned author ${prAuthor} to PR #${pr.number}`);
      }

      // Run PR checks with force=true (always set labels on open)
      await runPRChecks({
        github: context.octokit,
        owner,
        repo,
        pullRequest: pr,
        config,
        force: true,
        logger,
      });

      app.log.info(`PR open handler completed for PR #${pr.number}`);
    } catch (error) {
      app.log.error(`Error processing PR open: ${error.message}`);
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PR Updated handler (new commits pushed, or body edited)
  // ───────────────────────────────────────────────────────────────
  app.on(['pull_request.synchronize', 'pull_request.edited'], async (context) => {
    const pr = context.payload.pull_request;
    app.log.info(`PR Updated: ${pr.html_url}`);

    // Skip bot-authored PRs
    if (pr.user.type === 'Bot') return;

    // For edits, only re-check if the body changed (issue link may have changed)
    if (context.payload.action === 'edited' && !context.payload.changes?.body) {
      return app.log.info('Body not changed, skipping PR edit check');
    }

    const logger = createLogger(app.log);

    try {
      const config = await loadRepoConfig(context, logger, 'pr-checks');
      const { owner, repo } = context.repo();

      // Run PR checks with force=false (only swap labels if old label exists)
      await runPRChecks({
        github: context.octokit,
        owner,
        repo,
        pullRequest: pr,
        config,
        force: false,
        logger,
      });

      app.log.info(`PR update handler completed for PR #${pr.number}`);
    } catch (error) {
      app.log.error(`Error processing PR update: ${error.message}`);
    }
  });
}

module.exports = { registerListeners };

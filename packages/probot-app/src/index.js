// packages/probot-app/src/index.js
//
// Probot adapter for sdk-automations.
// Listens to GitHub webhook events and delegates to the shared core logic.
//
// This is a thin adapter — all business logic lives in @hiero-sdk-automations/core.

const { loadConfig } = require('@hiero-sdk-automations/core');
const { runPRChecks } = require('@hiero-sdk-automations/core/src/automations/pr-checks');
const { runAssign } = require('@hiero-sdk-automations/core/src/automations/assign');

const ASSIGN_COMMAND = /^\s*\/assign\s*$/i;
const DEFAULT_CONFIG_PATH = '.github/hiero-automation.json';

/**
 * Creates a logger that delegates to the Probot app logger.
 */
function createLogger(appLog) {
  return {
    info: (msg) => appLog.info(msg),
    error: (msg) => appLog.error(msg),
    log: (msg) => appLog.info(msg),
  };
}

/**
 * Loads the hiero-automation config from the repository.
 * Falls back to sensible defaults if the config file is not found.
 */
async function loadRepoConfig(context, logger) {
  try {
    const { data: file } = await context.octokit.repos.getContent(
      context.repo({ path: DEFAULT_CONFIG_PATH })
    );
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.info(`Could not load repo config (${DEFAULT_CONFIG_PATH}): ${error.message}. Using minimal defaults.`);
    const { owner, repo } = context.repo();
    return {
      repository: { owner, name: repo },
      labels: {
        reviewQueue: {
          juniorCommitter: 'queue:junior-committer',
          committers: 'queue:committers',
          maintainers: 'queue:maintainers',
          readyToMerge: 'status: ready-to-merge',
          communityReview: 'open to community review',
        },
      },
    };
  }
}

/**
 * Registers the Probot app event handlers.
 *
 * @param {import('probot').Probot} app - The Probot application instance.
 */
function registerProbotApp(app) {
  app.log.info('Hiero SDK Automations Probot adapter is running!');

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
      const config = await loadRepoConfig(context, logger);
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
      const config = await loadRepoConfig(context, logger);
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
      const config = await loadRepoConfig(context, logger);
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

module.exports = registerProbotApp;

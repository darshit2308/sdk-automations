// packages/probot-app/src/listener.js
//
// Probot webhook listener.
// Registers all GitHub webhook event handlers and delegates to the shared
// core pipeline: normalize -> route -> dispatch.

const {
  normalizeEvent,
  routeEvent,
  dispatch,
} = require('@hiero-sdk-automations/core');
const { loadRepoConfig } = require('./config-loader');
const { createLogger } = require('./audit-sink');
const { createGitHubClient } = require('./github-client');

function isBotUser(user) {
  return user?.type === 'Bot';
}

function createEventHandler(app, eventName, preflight) {
  return async (context) => {
    const logger = createLogger(app.log);

    if (preflight && preflight(context, app.log)) {
      return;
    }

    const normalizedEvent = normalizeEvent(eventName, context.payload);
    const automationKey = routeEvent(normalizedEvent);

    if (!automationKey) {
      app.log.info(`No automation route for ${eventName}`);
      return;
    }

    app.log.info(`Routed ${eventName} to automation "${automationKey}"`);

    try {
      const config = await loadRepoConfig(context, logger, automationKey);
      await dispatch({
        automationKey,
        github: createGitHubClient(context),
        config,
        event: normalizedEvent,
        logger,
      });
    } catch (error) {
      app.log.error(`Error handling ${eventName} (${automationKey}): ${error.message}`);
    }
  };
}

/**
 * Registers all Probot event handlers.
 *
 * @param {import('probot').Probot} app - The Probot application instance.
 */
function registerListeners(app) {
  app.on('issue_comment.created', createEventHandler(app, 'issue_comment', (context) => {
    const { issue, comment } = context.payload;
    if (issue.pull_request) return true;
    if (isBotUser(comment.user)) return true;
    return false;
  }));

  app.on(['pull_request.opened', 'pull_request.reopened'], createEventHandler(app, 'pull_request', (context, log) => {
    const pr = context.payload.pull_request;
    log.info(`PR Opened/Reopened: ${pr.html_url}`);
    return isBotUser(pr.user);
  }));

  app.on(['pull_request.synchronize', 'pull_request.edited'], createEventHandler(app, 'pull_request', (context, log) => {
    const pr = context.payload.pull_request;
    log.info(`PR Updated: ${pr.html_url}`);

    if (isBotUser(pr.user)) return true;
    if (context.payload.action === 'edited' && !context.payload.changes?.body) {
      log.info('Body not changed, skipping PR edit check');
      return true;
    }
    return false;
  }));
}

module.exports = { registerListeners, createEventHandler };

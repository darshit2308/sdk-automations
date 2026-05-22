// packages/probot-app/src/index.js
//
// Probot adapter entrypoint for sdk-automations.
//
// This is a thin entrypoint — it bootstraps the app and delegates to
// the listener module for webhook event registration. All business
// logic lives in @hiero-sdk-automations/core.

const { registerListeners } = require('./listener');

/**
 * Registers the Probot app event handlers.
 *
 * @param {import('probot').Probot} app - The Probot application instance.
 */
function registerProbotApp(app) {
  app.log.info('Hiero SDK Automations Probot adapter is running!');
  registerListeners(app);
}

module.exports = registerProbotApp;

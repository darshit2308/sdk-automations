// packages/probot-app/src/config-loader.js
//
// Probot-specific config loader.
// Loads the hiero-automation config from the target repository's default branch
// via the GitHub Contents API. This is adapter-specific because Probot receives
// webhook events (no local filesystem), unlike the Action adapter which reads
// from the checked-out workspace.

const { parseConfig, validateConfig } = require('@hiero-sdk-automations/core');

/**
 * Config file paths to search, in priority order.
 */
const CONFIG_PATHS = [
  '.github/hiero-automation.json',
  '.github/hiero-automation.yml',
  '.github/hiero-automation.yaml',
];

/**
 * Loads and validates the hiero-automation config from the repository.
 * Fails closed (throws) if the config is missing or invalid.
 *
 * @param {object} context - Probot webhook context.
 * @param {object} logger - Logger with .info() and .error() methods.
 * @param {string} automationName - Name of the automation to validate for.
 * @returns {Promise<object>} The parsed and validated config object.
 * @throws {Error} If no config file is found or validation fails.
 */
async function loadRepoConfig(context, logger, automationName) {
  for (const configPath of CONFIG_PATHS) {
    try {
      const { data: file } = await context.octokit.repos.getContent(
        context.repo({ path: configPath })
      );
      const content = Buffer.from(file.content, 'base64').toString('utf8');
      const config = parseConfig(content, configPath);

      validateConfig(config, automationName);

      logger.info(`Successfully loaded and validated config from ${configPath}`);
      return config;
    } catch (error) {
      if (error.status === 404) {
        // File not found, try the next path
        continue;
      }
      // If parsing/validation fails, or API gives 500, fail closed immediately
      throw new Error(`Failed to load/validate config from ${configPath}: ${error.message}`);
    }
  }

  // Fail closed if we couldn't find any config file
  throw new Error('No hiero-automation config file found (.json, .yml, or .yaml). Aborting automation.');
}

module.exports = { loadRepoConfig, CONFIG_PATHS };

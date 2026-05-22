// packages/core/src/dispatcher/dispatch.js
//
// Central dispatcher for sdk-automations.
// Routes automation keys to the correct policy module and executes them.
//
// This module replaces packages/core/src/automations/registry.js with a
// cleaner separation between routing and execution.

const { runReviewSync } = require('../policies/review-sync/policy');
const { runPRChecks } = require('../policies/pr-checks/policy');
const { runAssign } = require('../policies/assign/policy');

/**
 * Registry of automation keys to their policy functions.
 * @type {Object<string, Function>}
 */
const automations = {
  'review-sync': runReviewSync,
  'pr-checks': runPRChecks,
  'assign': runAssign,
};

/**
 * Returns the policy function for a given automation name.
 *
 * @param {string} name - The automation key.
 * @returns {Function} The policy function.
 * @throws {Error} If the automation is not supported.
 */
function getAutomation(name) {
  const automation = automations[name];
  if (!automation) {
    throw new Error(`Unsupported automation: ${name}`);
  }
  return automation;
}

/**
 * Dispatches to the correct policy module by automation name.
 *
 * @param {string} name - The automation key.
 * @param {object} options - Options to pass to the policy function.
 * @returns {Promise<any>} The result from the policy function.
 * @throws {Error} If the automation is not supported.
 */
async function runAutomation(name, options) {
  return getAutomation(name)(options);
}

/**
 * Full dispatch pipeline: takes a normalized event and dispatches
 * to the correct policy.
 *
 * @param {object} params
 * @param {string} params.automationKey - The automation key (from the router).
 * @param {object} params.github - Octokit instance.
 * @param {object} params.config - The hiero-automation config.
 * @param {object} params.event - The normalized event.
 * @param {object} [params.logger] - Logger with .info() and .error() methods.
 * @param {boolean} [params.dryRun] - Whether to run in dry-run mode.
 * @returns {Promise<any>} The result from the policy function.
 */
async function dispatch({ automationKey, github, config, event, logger = console, dryRun }) {
  const policyFn = getAutomation(automationKey);

  // Build the options object based on what the policy expects.
  // Each policy has a different signature, so we pass a superset
  // and let the policy destructure what it needs.
  const options = {
    github,
    config,
    logger,
    dryRun,
    owner: event?.owner || config?.repository?.owner,
    repo: event?.repo || config?.repository?.name,
    issue: event?.issue || null,
    pullRequest: event?.pullRequest || null,
    comment: event?.comment || null,
    event: event?.raw || null,
  };

  return policyFn(options);
}

module.exports = { getAutomation, runAutomation, dispatch };

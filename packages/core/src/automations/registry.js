const { runReviewSync } = require('./review-sync');
const { runPRChecks } = require('./pr-checks');
const { runAssign } = require('./assign');

const automations = {
  'review-sync': runReviewSync,
  'pr-checks': runPRChecks,
  'assign': runAssign,
};

function getAutomation(name) {
  const automation = automations[name];
  if (!automation) {
    throw new Error(`Unsupported automation: ${name}`);
  }
  return automation;
}

async function runAutomation(name, options) {
  return getAutomation(name)(options);
}

module.exports = { getAutomation, runAutomation };

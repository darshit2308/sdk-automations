const { loadConfig } = require('./config/load-config');
const { validateConfig } = require('./config/validate-config');
const { runAutomation, getAutomation } = require('./automations/registry');
const reviewSync = require('./automations/review-sync');
const prChecks = require('./automations/pr-checks');
const assign = require('./automations/assign');

module.exports = {
  loadConfig,
  validateConfig,
  runAutomation,
  getAutomation,
  reviewSync,
  prChecks,
  assign,
};

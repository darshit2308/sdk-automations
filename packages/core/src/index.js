// packages/core/src/index.js
//
// Public API for @hiero-sdk-automations/core.
//
// Exports all shared modules. Consumers (probot-app, github-action-adapter)
// should prefer importing from this entrypoint.

// ── Config ──────────────────────────────────────────────────────
const { loadConfig, parseConfig } = require('./config/load-config');
const { validateConfig } = require('./config/validate-config');

// ── New architectural layers ────────────────────────────────────
const { normalizeEvent, extractRepo, detectCommand } = require('./events/normalize');
const { routeEvent, getSupportedAutomations } = require('./routing/route-event');
const { dispatch, getAutomation, runAutomation } = require('./dispatcher/dispatch');

// ── Policies ────────────────────────────────────────────────────
const assign = require('./policies/assign/policy');
const prChecks = require('./policies/pr-checks/policy');
const reviewSync = require('./policies/review-sync/policy');

// ── Operations ──────────────────────────────────────────────────
const { createOperationPlan, OperationType } = require('./operations/operation-plan');
const { executeOperations } = require('./operations/executor');

module.exports = {
  // Config
  loadConfig,
  parseConfig,
  validateConfig,

  // Event pipeline
  normalizeEvent,
  extractRepo,
  detectCommand,
  routeEvent,
  getSupportedAutomations,
  dispatch,

  // Backward-compatible automation dispatch
  getAutomation,
  runAutomation,

  // Policy modules (for direct access)
  assign,
  prChecks,
  reviewSync,

  // Operations
  createOperationPlan,
  OperationType,
  executeOperations,
};

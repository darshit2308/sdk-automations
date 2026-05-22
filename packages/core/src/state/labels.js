// packages/core/src/state/labels.js
//
// Label state-machine helpers.
// Provides utility functions for working with GitHub issue/PR labels
// across different policies.
//
// Re-exports shared label utilities and adds cross-policy helpers.

const {
  buildReviewQueueLabels,
  queueLabelNames,
  ensureLabel,
  hasCIFailures,
  determineLabel,
  syncLabel,
} = require('../policies/review-sync/labels');

const { hasLabel, swapStatusLabel } = require('../policies/pr-checks/policy');

module.exports = {
  // From review-sync
  buildReviewQueueLabels,
  queueLabelNames,
  ensureLabel,
  hasCIFailures,
  determineLabel,
  syncLabel,

  // From pr-checks
  hasLabel,
  swapStatusLabel,
};

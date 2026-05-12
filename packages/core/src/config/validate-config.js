function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertBoolean(value, name) {
  if (typeof value !== 'boolean') {
    throw new Error(`${name} must be a boolean`);
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function validateReviewSyncConfig(config) {
  assertObject(config, 'config');
  assertObject(config.repository, 'repository');
  assertString(config.repository.owner, 'repository.owner');
  assertString(config.repository.name, 'repository.name');

  assertObject(config.labels, 'labels');
  assertObject(config.labels.reviewQueue, 'labels.reviewQueue');

  for (const key of ['juniorCommitter', 'committers', 'maintainers', 'readyToMerge', 'communityReview']) {
    assertString(config.labels.reviewQueue[key], `labels.reviewQueue.${key}`);
  }

  if (config.reviewSync !== undefined) {
    assertObject(config.reviewSync, 'reviewSync');
    if (config.reviewSync.enabled !== undefined) assertBoolean(config.reviewSync.enabled, 'reviewSync.enabled');
    if (config.reviewSync.rateLimitFloor !== undefined) {
      assertNonNegativeInteger(config.reviewSync.rateLimitFloor, 'reviewSync.rateLimitFloor');
    }
    if (config.reviewSync.includeDraftPullRequests !== undefined) {
      assertBoolean(config.reviewSync.includeDraftPullRequests, 'reviewSync.includeDraftPullRequests');
    }
    if (config.reviewSync.dryRunDefault !== undefined) {
      assertBoolean(config.reviewSync.dryRunDefault, 'reviewSync.dryRunDefault');
    }
  }

  return config;
}

function validateConfig(config, automation) {
  if (automation === 'review-sync') return validateReviewSyncConfig(config);
  throw new Error(`Unsupported automation for validation: ${automation}`);
}

module.exports = { validateConfig, validateReviewSyncConfig };

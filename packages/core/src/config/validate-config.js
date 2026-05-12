function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function assertNoUnknownKeys(value, name, allowedKeys) {
  assertObject(value, name);
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${name}.${key} is not supported`);
    }
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

function assertStringMap(value, name) {
  assertObject(value, name);
  for (const [key, entry] of Object.entries(value)) {
    assertString(entry, `${name}.${key}`);
  }
}

function assertStringArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  value.forEach((entry, index) => assertString(entry, `${name}[${index}]`));
}

function validateRepository(repository) {
  assertNoUnknownKeys(repository, 'repository', ['owner', 'name']);
  assertString(repository.owner, 'repository.owner');
  assertString(repository.name, 'repository.name');
}

function validateLabels(labels) {
  assertNoUnknownKeys(labels, 'labels', ['reviewQueue', 'status', 'skill', 'priority']);
  assertNoUnknownKeys(labels.reviewQueue, 'labels.reviewQueue', [
    'juniorCommitter',
    'committers',
    'maintainers',
    'readyToMerge',
    'communityReview',
  ]);

  for (const key of ['juniorCommitter', 'committers', 'maintainers', 'readyToMerge', 'communityReview']) {
    assertString(labels.reviewQueue[key], `labels.reviewQueue.${key}`);
  }

  for (const key of ['status', 'skill', 'priority']) {
    if (labels[key] !== undefined) assertStringMap(labels[key], `labels.${key}`);
  }
}

function validateReviewSync(reviewSync) {
  assertNoUnknownKeys(reviewSync, 'reviewSync', [
    'enabled',
    'rateLimitFloor',
    'includeDraftPullRequests',
    'dryRunDefault',
  ]);
  if (reviewSync.enabled !== undefined) assertBoolean(reviewSync.enabled, 'reviewSync.enabled');
  if (reviewSync.rateLimitFloor !== undefined) {
    assertNonNegativeInteger(reviewSync.rateLimitFloor, 'reviewSync.rateLimitFloor');
  }
  if (reviewSync.includeDraftPullRequests !== undefined) {
    assertBoolean(reviewSync.includeDraftPullRequests, 'reviewSync.includeDraftPullRequests');
  }
  if (reviewSync.dryRunDefault !== undefined) {
    assertBoolean(reviewSync.dryRunDefault, 'reviewSync.dryRunDefault');
  }
}

function validateAssignment(assignment) {
  assertNoUnknownKeys(assignment, 'assignment', [
    'enabled',
    'maxOpenAssignments',
    'maxGoodFirstIssueCompletions',
  ]);
  if (assignment.enabled !== undefined) assertBoolean(assignment.enabled, 'assignment.enabled');
  if (assignment.maxOpenAssignments !== undefined) {
    assertNonNegativeInteger(assignment.maxOpenAssignments, 'assignment.maxOpenAssignments');
  }
  if (assignment.maxGoodFirstIssueCompletions !== undefined) {
    assertNonNegativeInteger(
      assignment.maxGoodFirstIssueCompletions,
      'assignment.maxGoodFirstIssueCompletions'
    );
  }
}

function validateAssignmentLimits(assignmentLimits) {
  assertNoUnknownKeys(assignmentLimits, 'assignmentLimits', ['maxOpenAssignments', 'maxGfiCompletions']);
  if (assignmentLimits.maxOpenAssignments !== undefined) {
    assertNonNegativeInteger(assignmentLimits.maxOpenAssignments, 'assignmentLimits.maxOpenAssignments');
  }
  if (assignmentLimits.maxGfiCompletions !== undefined) {
    assertNonNegativeInteger(assignmentLimits.maxGfiCompletions, 'assignmentLimits.maxGfiCompletions');
  }
}

function validateSkillPrerequisites(skillPrerequisites) {
  assertObject(skillPrerequisites, 'skillPrerequisites');
  for (const [label, prerequisite] of Object.entries(skillPrerequisites)) {
    assertNoUnknownKeys(prerequisite, `skillPrerequisites.${label}`, [
      'requiredLabel',
      'requiredCount',
      'displayName',
      'prerequisiteDisplayName',
    ]);
    if (prerequisite.requiredLabel !== null) {
      assertString(prerequisite.requiredLabel, `skillPrerequisites.${label}.requiredLabel`);
    }
    assertNonNegativeInteger(prerequisite.requiredCount, `skillPrerequisites.${label}.requiredCount`);
    assertString(prerequisite.displayName, `skillPrerequisites.${label}.displayName`);
    if (prerequisite.prerequisiteDisplayName !== undefined) {
      assertString(prerequisite.prerequisiteDisplayName, `skillPrerequisites.${label}.prerequisiteDisplayName`);
    }
  }
}

function validateReviewSyncConfig(config) {
  assertNoUnknownKeys(config, 'config', [
    'repository',
    'labels',
    'reviewSync',
    'assignment',
    'assignmentLimits',
    'maintainerTeam',
    'goodFirstIssueSupportTeam',
    'skillHierarchy',
    'priorityHierarchy',
    'skillPrerequisites',
    'documentation',
    'community',
  ]);

  validateRepository(config.repository);
  validateLabels(config.labels);

  if (config.reviewSync !== undefined) validateReviewSync(config.reviewSync);
  if (config.assignment !== undefined) validateAssignment(config.assignment);
  if (config.assignmentLimits !== undefined) validateAssignmentLimits(config.assignmentLimits);
  if (config.maintainerTeam !== undefined) assertString(config.maintainerTeam, 'maintainerTeam');
  if (config.goodFirstIssueSupportTeam !== undefined) {
    assertString(config.goodFirstIssueSupportTeam, 'goodFirstIssueSupportTeam');
  }
  if (config.skillHierarchy !== undefined) assertStringArray(config.skillHierarchy, 'skillHierarchy');
  if (config.priorityHierarchy !== undefined) assertStringArray(config.priorityHierarchy, 'priorityHierarchy');
  if (config.skillPrerequisites !== undefined) validateSkillPrerequisites(config.skillPrerequisites);
  if (config.documentation !== undefined) assertStringMap(config.documentation, 'documentation');
  if (config.community !== undefined) assertStringMap(config.community, 'community');

  return config;
}

function validateConfig(config, automation) {
  if (automation === 'review-sync') return validateReviewSyncConfig(config);
  throw new Error(`Unsupported automation for validation: ${automation}`);
}

module.exports = { validateConfig, validateReviewSyncConfig };

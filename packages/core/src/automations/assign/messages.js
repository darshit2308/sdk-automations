// packages/core/src/automations/assign/messages.js
//
// Pure functions for building /assign command response comments.
// All policy values come from the config object — nothing is hardcoded.

/**
 * Builds a welcome comment for a newly assigned contributor.
 */
function buildWelcomeComment(username, skillLevel, config) {
  const skillHierarchy = config.skillHierarchy || [];
  const prereqs = config.skillPrerequisites || {};
  const goodFirstIssueLabel = skillHierarchy[0] || '';
  const isGoodFirstIssue = skillLevel === goodFirstIssueLabel;
  const displayName = prereqs[skillLevel]?.displayName || 'issue';

  if (isGoodFirstIssue) {
    return [
      `👋 Hi @${username}, welcome to the Hiero community! Thank you for choosing to contribute — we're thrilled to have you here! 🎉`,
      '',
      `You've been assigned this **Good First Issue**, and the **Good First Issue Support Team** is ready to help you succeed.`,
      '',
      'The issue description above has everything you need. If anything is unclear, just ask.',
      '',
      'Good luck, and welcome aboard! 🚀',
    ].join('\n');
  }

  return `👋 Hi @${username}, thanks for continuing to contribute! You've been assigned this **${displayName}** issue. 🙌\n\nGood luck! 🚀`;
}

/**
 * Builds a comment for when the issue is already assigned.
 */
function buildAlreadyAssignedComment(requesterUsername, currentAssignee) {
  if (requesterUsername.toLowerCase() === currentAssignee.toLowerCase()) {
    return `👋 Hi @${requesterUsername}! You're already assigned to this issue. You're all set to start working on it!`;
  }
  return `👋 Hi @${requesterUsername}! This issue is already assigned to @${currentAssignee}. Find another open issue and comment \`/assign\` to get started!`;
}

/**
 * Builds a comment for when the issue is not ready for development.
 */
function buildNotReadyComment(requesterUsername, config) {
  const readyLabel = config.labels?.status?.readyForDev || 'status: ready for dev';
  return `👋 Hi @${requesterUsername}! This issue is not ready for development yet.\n\nIssues must have the \`${readyLabel}\` label before they can be assigned.`;
}

/**
 * Builds a comment for when the issue has no skill level label.
 */
function buildNoSkillLevelComment(requesterUsername, config) {
  const maintainerTeam = config.maintainerTeam || '';
  return `👋 Hi @${requesterUsername}! This issue doesn't have a skill level label yet.\n\n${maintainerTeam} — could you please add a skill level label? Once added, @${requesterUsername} can comment \`/assign\` again.`;
}

/**
 * Builds a comment for when the requester has too many open assignments.
 */
function buildAssignmentLimitExceededComment(requesterUsername, openCount, config) {
  const maxOpen = config.assignment?.maxOpenAssignments || 2;
  return [
    `👋 Hi @${requesterUsername}! Thanks for your enthusiasm!`,
    '',
    `To help contributors stay focused, we limit assignments to **${maxOpen} open issues** at a time.`,
    '',
    `📊 **Your Current Assignments:** You're currently assigned to **${openCount}** open issues. Once you complete one, come back and we'll be happy to assign this to you! 🎯`,
  ].join('\n');
}

/**
 * Builds a comment for when the requester hasn't met the skill prerequisites.
 */
function buildPrerequisiteNotMetComment(requesterUsername, skillLevel, completedCount, config) {
  const prereqs = config.skillPrerequisites || {};
  const prereq = prereqs[skillLevel] || {};
  const displayName = prereq.displayName || 'this level';
  const requiredCount = prereq.requiredCount || 0;
  const prerequisiteDisplayName = prereq.prerequisiteDisplayName || 'prerequisite issues';

  return [
    `👋 Hi @${requesterUsername}! This is a **${displayName}** issue.`,
    '',
    `Before taking it on, you need to complete at least **${requiredCount} ${prerequisiteDisplayName}**.`,
    '',
    `📊 **Your Progress:** You've completed **${completedCount}** so far. Keep going! 🎯`,
  ].join('\n');
}

module.exports = {
  buildWelcomeComment,
  buildAlreadyAssignedComment,
  buildNotReadyComment,
  buildNoSkillLevelComment,
  buildAssignmentLimitExceededComment,
  buildPrerequisiteNotMetComment,
};

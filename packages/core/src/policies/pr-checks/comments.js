// packages/core/src/policies/pr-checks/comments.js
//
// Pure functions for building the PR dashboard comment.
// All policy values (URLs, team names) come from the config object.

const MARKER = '<!-- bot:pr-helper -->';

/**
 * Determines check state: 'error', 'pass', or 'fail'.
 */
function checkState(result) {
  if (result.error) return 'error';
  return result.passed ? 'pass' : 'fail';
}

/**
 * Builds a generic section for a passing or errored check.
 * Returns null if the check failed (caller handles fail case).
 */
function buildSection({ title, result, passMessage, maintainerTeam }) {
  const state = checkState(result);

  if (state === 'error') {
    return [
      `:warning: **${title}** -- This check encountered an internal error. ${maintainerTeam} please review manually.`,
      '',
      `Error: ${result.errorMessage || 'Unknown error'}`,
    ].join('\n');
  }
  if (state === 'pass') {
    return `:white_check_mark: **${title}** -- ${passMessage}`;
  }
  return null;
}

function buildDCOSection(dco, config) {
  const maintainerTeam = config.maintainerTeam || '';
  const signingGuide = config.documentation?.signingGuide || '';
  const guideLink = signingGuide ? ` See the [Signing Guide](${signingGuide}).` : '';

  const common = buildSection({
    title: 'DCO Sign-off',
    result: dco,
    passMessage: 'All commits have valid sign-offs. Nice work!',
    maintainerTeam,
  });
  if (common) return common;

  const failList = (dco.failures || []).map(f => `- \`${f.sha}\` ${f.message}`).join('\n');
  return [
    ':x: **DCO Sign-off** -- Uh oh! The following commits are missing the required DCO sign-off:',
    failList,
    '',
    `No worries, this is an easy fix! Add \`Signed-off-by: Your Name <email>\` to each commit (e.g. \`git commit -s\`).${guideLink}`,
  ].join('\n');
}

function buildGPGSection(gpg, config) {
  const maintainerTeam = config.maintainerTeam || '';
  const signingGuide = config.documentation?.signingGuide || '';
  const guideLink = signingGuide ? ` See the [Signing Guide](${signingGuide}) for a step-by-step walkthrough.` : '';

  const common = buildSection({
    title: 'GPG Signature',
    result: gpg,
    passMessage: 'All commits have verified GPG signatures. Locked and loaded!',
    maintainerTeam,
  });
  if (common) return common;

  const failList = (gpg.failures || []).map(f => `- \`${f.sha}\` ${f.message}`).join('\n');
  return [
    ':x: **GPG Signature** -- Heads up! The following commits don\'t have a verified GPG signature:',
    failList,
    '',
    `You'll need to sign your commits with GPG (e.g. \`git commit -S\`).${guideLink}`,
  ].join('\n');
}

function buildMergeSection(merge, config) {
  const maintainerTeam = config.maintainerTeam || '';
  const mergeGuide = config.documentation?.mergeConflictsGuide || '';
  const guideLink = mergeGuide ? ` See the [Merge Conflicts Guide](${mergeGuide}) if you need a hand.` : '';

  const common = buildSection({
    title: 'Merge Conflicts',
    result: merge,
    passMessage: 'No merge conflicts detected. Smooth sailing!',
    maintainerTeam,
  });
  if (common) return common;

  return [
    ':x: **Merge Conflicts** -- Oh no, this PR has merge conflicts with the base branch.',
    '',
    `Let's get this sorted! Update your branch (e.g. rebase or merge from base) and push.${guideLink}`,
  ].join('\n');
}

function buildIssueLinkSection(issueLink, config) {
  const maintainerTeam = config.maintainerTeam || '';
  const linked = (issueLink.issues || []).filter(i => i.isAssigned).map(i => `#${i.number}`).join(', ');

  const common = buildSection({
    title: 'Issue Link',
    result: issueLink,
    passMessage: `Linked to ${linked} (assigned to you).`,
    maintainerTeam,
  });
  if (common) return common;

  if (issueLink.reason === 'not_assigned') {
    const unassigned = (issueLink.issues || []).filter(i => !i.isAssigned).map(i => `#${i.number}`).join(', ');
    return [
      `:x: **Issue Link** -- Almost there! You are not assigned to the following linked issues: ${unassigned}.`,
      '',
      'Please ensure you are assigned to all linked issues before opening a PR. You can comment `/assign` on the issue to grab it!',
    ].join('\n');
  }

  return [
    ':x: **Issue Link** -- This PR is not linked to any issue.',
    '',
    'Please reference an issue using a closing keyword (e.g. `Fixes #123`) and ensure the issue is assigned to you. Every PR needs a home!',
  ].join('\n');
}

/**
 * Returns true if all four checks passed without errors.
 */
function allChecksPassed({ dco, gpg, merge, issueLink }) {
  return (
    !dco.error && dco.passed &&
    !gpg.error && gpg.passed &&
    !merge.error && merge.passed &&
    !issueLink.error && issueLink.passed
  );
}

/**
 * Builds the full PR dashboard comment body.
 *
 * @param {object} params
 * @param {string} params.prAuthor - PR author's GitHub login.
 * @param {object} params.dco - DCO check result.
 * @param {object} params.gpg - GPG check result.
 * @param {object} params.merge - Merge conflict check result.
 * @param {object} params.issueLink - Issue link check result.
 * @param {object} params.config - The hiero-automation config object.
 * @returns {{ marker: string, body: string, allPassed: boolean }}
 */
function buildBotComment({ prAuthor, dco, gpg, merge, issueLink, config }) {
  const greeting = [
    `Hey @${prAuthor} :wave: thanks for the PR!`,
    "I'm your friendly **PR Helper Bot** :robot: and I'll be riding shotgun on this one, keeping track of your PR's status to help you get it approved and merged.",
    '',
    "This comment updates automatically as you push changes -- think of it as your PR's live scoreboard!",
    "Here's the latest:",
  ].join('\n');

  const checksSection = [
    '### PR Checks', '',
    buildDCOSection(dco, config), '', '---', '',
    buildGPGSection(gpg, config), '', '---', '',
    buildMergeSection(merge, config), '', '---', '',
    buildIssueLinkSection(issueLink, config),
  ].join('\n');

  const passed = allChecksPassed({ dco, gpg, merge, issueLink });

  const footer = passed
    ? ':tada: *All checks passed! Your PR is ready for review. Great job!*'
    : ':hourglass_flowing_sand: *All checks must pass before this PR can be reviewed. You\'ve got this!*';

  const body = [MARKER, greeting, '', '---', '', checksSection, '', '---', '', footer].join('\n');
  return { marker: MARKER, body, allPassed: passed };
}

module.exports = {
  MARKER,
  checkState,
  buildSection,
  buildDCOSection,
  buildGPGSection,
  buildMergeSection,
  buildIssueLinkSection,
  allChecksPassed,
  buildBotComment,
};

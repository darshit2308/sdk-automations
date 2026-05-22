// packages/core/src/policies/review-sync/policy.js
//
// Orchestrator for the review-sync automation.
// Syncs review queue labels for open pull requests based on approval states.

const { validateConfig } = require('../../config/validate-config');
const { buildReviewQueueLabels, ensureLabel, syncLabel } = require('./labels');

async function runReviewSync({ github, config, dryRun, logger = console }) {
  validateConfig(config, 'review-sync');

  const reviewSyncConfig = config.reviewSync || {};
  if (reviewSyncConfig.enabled === false) {
    logger.log('reviewSync.enabled is false. Skipping review sync.');
    return { skipped: true, reason: 'disabled' };
  }

  const owner = config.repository.owner;
  const repo = config.repository.name;
  const effectiveDryRun = dryRun ?? reviewSyncConfig.dryRunDefault ?? false;
  const rateLimitFloor = reviewSyncConfig.rateLimitFloor ?? 200;
  const includeDraftPullRequests = reviewSyncConfig.includeDraftPullRequests ?? false;
  const labels = buildReviewQueueLabels(config);

  if (effectiveDryRun) logger.log('DRY RUN MODE: no labels will be created or modified.');

  const { data: rateLimit } = await github.rest.rateLimit.get();
  const remaining = rateLimit.resources.core.remaining;
  logger.log(`Core API remaining: ${remaining}`);

  if (remaining < rateLimitFloor) {
    logger.log(`Skipping run: rate limit too low (${remaining} < ${rateLimitFloor}).`);
    return { skipped: true, reason: 'rate-limit', remaining };
  }

  const allPullRequests = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  const pullRequests = includeDraftPullRequests
    ? allPullRequests
    : allPullRequests.filter((pr) => !pr.draft);

  logger.log(`Open PRs: ${allPullRequests.length}`);
  logger.log(`PRs to process: ${pullRequests.length}`);

  for (const label of Object.values(labels)) {
    await ensureLabel(github, owner, repo, label, effectiveDryRun, logger);
  }

  let changed = 0;
  let skipped = 0;
  let errors = 0;

  for (const pr of pullRequests) {
    try {
      const didChange = await syncLabel(github, owner, repo, pr, {
        labels,
        dryRun: effectiveDryRun,
        logger,
      });
      if (didChange) changed++;
      else skipped++;
    } catch (error) {
      errors++;
      logger.error(`Error on PR #${pr.number}: ${error.message || error}`);
    }
  }

  const summary = {
    processed: pullRequests.length,
    changed,
    unchanged: skipped,
    errors,
    dryRun: effectiveDryRun,
  };

  logger.log(`Review sync summary: ${JSON.stringify(summary)}`);

  if (errors > 0) {
    throw new Error(`Review sync completed with ${errors} error(s).`);
  }

  return summary;
}

module.exports = {
  runReviewSync,
  ...require('./labels'),
  ...require('./permissions'),
  ...require('./reviews'),
};

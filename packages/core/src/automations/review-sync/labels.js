const { countApprovals } = require('./permissions');

const DEFAULT_LABEL_DETAILS = {
  juniorCommitter: {
    color: 'e4e669',
    description: 'PR awaiting initial quality review',
  },
  committers: {
    color: '0075ca',
    description: 'PR awaiting committer technical review',
  },
  maintainers: {
    color: 'd876e3',
    description: 'PR awaiting maintainer final review',
  },
  readyToMerge: {
    color: '0e8a16',
    description: 'PR has maintainer and core approvals, ready to merge',
  },
  communityReview: {
    color: '008672',
    description: 'PR is open for community review and feedback',
  },
};

function buildReviewQueueLabels(config) {
  const names = config.labels.reviewQueue;
  return {
    juniorCommitter: { name: names.juniorCommitter, ...DEFAULT_LABEL_DETAILS.juniorCommitter },
    committers: { name: names.committers, ...DEFAULT_LABEL_DETAILS.committers },
    maintainers: { name: names.maintainers, ...DEFAULT_LABEL_DETAILS.maintainers },
    readyToMerge: { name: names.readyToMerge, ...DEFAULT_LABEL_DETAILS.readyToMerge },
    communityReview: { name: names.communityReview, ...DEFAULT_LABEL_DETAILS.communityReview },
  };
}

function queueLabelNames(labels) {
  return [
    labels.juniorCommitter.name,
    labels.committers.name,
    labels.maintainers.name,
    labels.readyToMerge.name,
  ];
}

async function ensureLabel(github, owner, repo, label, dryRun, logger = console) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name: label.name });
    logger.log(`Label "${label.name}" already exists. Skipping creation.`);
  } catch (error) {
    if (error.status !== 404) throw error;

    if (dryRun) {
      logger.log(`[DRY RUN] Would create label "${label.name}" (${label.color}).`);
      return;
    }

    try {
      await github.rest.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
      logger.log(`Created label "${label.name}" (#${label.color}).`);
    } catch (createError) {
      if (createError.status === 422) {
        logger.log(`Label "${label.name}" already exists (422). Skipping.`);
      } else {
        throw createError;
      }
    }
  }
}

async function hasCIFailures(github, owner, repo, sha, logger = console) {
  try {
    const checkRuns = await github.paginate(github.rest.checks.listForRef, {
      owner,
      repo,
      ref: sha,
      filter: 'latest',
    });

    return checkRuns.some((run) =>
      ['failure', 'timed_out', 'startup_failure', 'action_required'].includes(run.conclusion)
    );
  } catch (error) {
    logger.error(`Failed to fetch CI checks for ${sha}: ${error.message || error}`);
    throw error;
  }
}

function determineLabel(approvals, ciFailing = false, labels) {
  if (ciFailing) return labels.juniorCommitter;
  if (approvals.maintainerApprovals >= 1 && approvals.coreApprovals >= 2) return labels.readyToMerge;
  if (approvals.maintainerApprovals >= 1) return labels.committers;
  if (approvals.coreApprovals >= 1) return labels.maintainers;
  if (approvals.anyApproval >= 1) return labels.committers;
  return labels.juniorCommitter;
}

async function syncLabel(github, owner, repo, pr, options) {
  const {
    labels,
    dryRun = false,
    logger = console,
  } = options;

  const currentLabels = (pr.labels || []).map((label) => label.name);
  const approvals = await countApprovals(github, owner, repo, pr.number, logger);
  const ciFailing = await hasCIFailures(github, owner, repo, pr.head.sha, logger);
  const correctLabel = determineLabel(approvals, ciFailing, labels);

  logger.log(
    `PR #${pr.number}: maintainerApprovals=${approvals.maintainerApprovals}, ` +
      `coreApprovals=${approvals.coreApprovals}, softApprovals=${approvals.softApprovals}, ` +
      `anyApproval=${approvals.anyApproval}, ciFailing=${ciFailing} -> ${correctLabel.name}`
  );

  const staleLabels = currentLabels.filter(
    (name) => queueLabelNames(labels).includes(name) && name !== correctLabel.name
  );

  const isHuman = pr.user && pr.user.type !== 'Bot';
  const needsCommunityReview = isHuman && !currentLabels.includes(labels.communityReview.name);

  if (currentLabels.includes(correctLabel.name) && staleLabels.length === 0 && !needsCommunityReview) {
    logger.log(`Already has "${correctLabel.name}". No change needed.`);
    return false;
  }

  const labelsToAdd = [];
  if (!currentLabels.includes(correctLabel.name)) labelsToAdd.push(correctLabel.name);
  if (needsCommunityReview) labelsToAdd.push(labels.communityReview.name);

  if (dryRun) {
    if (labelsToAdd.length > 0) logger.log(`[DRY RUN] Would add: ${labelsToAdd.join(', ')}.`);
    if (staleLabels.length > 0) logger.log(`[DRY RUN] Would remove: ${staleLabels.join(', ')}.`);
    return true;
  }

  if (labelsToAdd.length > 0) {
    await github.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: labelsToAdd,
    });
    logger.log(`Added: ${labelsToAdd.join(', ')}.`);
  }

  for (const stale of staleLabels) {
    try {
      await github.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: pr.number,
        name: stale,
      });
      logger.log(`Removed "${stale}".`);
    } catch (error) {
      if (error.status === 404) {
        logger.log(`Label "${stale}" already gone (404). Skipping.`);
      } else {
        throw error;
      }
    }
  }

  return true;
}

module.exports = {
  buildReviewQueueLabels,
  queueLabelNames,
  ensureLabel,
  hasCIFailures,
  determineLabel,
  syncLabel,
};

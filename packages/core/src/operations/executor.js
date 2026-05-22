// packages/core/src/operations/executor.js
//
// Executes an OperationPlan via an injected GitHub client.
//
// This module is the bridge between pure policy output (operation plans)
// and actual GitHub API mutations. It supports dry-run mode and
// structured logging for audit trails.

const { OperationType } = require('./operation-plan');

/**
 * Executes all operations in a plan against the GitHub API.
 *
 * @param {object} params
 * @param {object} params.plan - An operation plan from createOperationPlan().
 * @param {object} params.github - Octokit instance.
 * @param {boolean} [params.dryRun=false] - If true, logs operations without executing.
 * @param {object} [params.logger=console] - Logger with .info() and .error() methods.
 * @returns {Promise<{ executed: number, skipped: number, errors: number }>}
 */
async function executeOperations({ plan, github, dryRun = false, logger = console }) {
  const { owner, repo, issueNumber, operations } = plan;
  let executed = 0;
  let skipped = 0;
  let errors = 0;

  for (const op of operations) {
    if (dryRun) {
      logger.info(`[DRY RUN] Would execute: ${JSON.stringify(op)}`);
      skipped++;
      continue;
    }

    try {
      switch (op.type) {
        case OperationType.ADD_LABEL:
          await github.rest.issues.addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: [op.label],
          });
          break;

        case OperationType.REMOVE_LABEL:
          try {
            await github.rest.issues.removeLabel({
              owner,
              repo,
              issue_number: issueNumber,
              name: op.label,
            });
          } catch (err) {
            // Label may already be removed — safe to ignore 404
            if (err.status !== 404) throw err;
          }
          break;

        case OperationType.ADD_COMMENT:
          await github.rest.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body: op.body,
          });
          break;

        case OperationType.UPDATE_COMMENT:
          await github.rest.issues.updateComment({
            owner,
            repo,
            comment_id: op.commentId,
            body: op.body,
          });
          break;

        case OperationType.ADD_ASSIGNEE:
          await github.rest.issues.addAssignees({
            owner,
            repo,
            issue_number: issueNumber,
            assignees: [op.username],
          });
          break;

        case OperationType.ADD_REACTION:
          await github.rest.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: op.commentId,
            content: op.content,
          });
          break;

        default:
          logger.error(`Unknown operation type: ${op.type}`);
          errors++;
          continue;
      }

      executed++;
    } catch (error) {
      errors++;
      logger.error(`Failed to execute ${op.type}: ${error.message}`);
    }
  }

  return { executed, skipped, errors };
}

module.exports = { executeOperations };

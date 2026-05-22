// packages/core/src/operations/operation-plan.js
//
// Pure data structures for representing automation operations.
//
// An OperationPlan is a list of intended actions (add label, remove label,
// post comment, assign user, etc.) that a policy produces as output.
// The executor then carries out these operations via an injected GitHub client.
//
// This separation enables:
// - Dry-run support at the core level
// - Audit logging of all intended actions
// - Unit testing policies without GitHub API mocks
// - Future batching and deduplication of operations

/**
 * Enumeration of supported operation types.
 */
const OperationType = Object.freeze({
  ADD_LABEL: 'add_label',
  REMOVE_LABEL: 'remove_label',
  ADD_COMMENT: 'add_comment',
  UPDATE_COMMENT: 'update_comment',
  ADD_ASSIGNEE: 'add_assignee',
  ADD_REACTION: 'add_reaction',
});

/**
 * Creates a new operation plan.
 *
 * @param {object} params
 * @param {string} params.owner - Repository owner.
 * @param {string} params.repo - Repository name.
 * @param {number} params.issueNumber - Issue or PR number.
 * @param {string} params.automationKey - The automation that produced this plan.
 * @returns {object} An operation plan with methods to add operations.
 */
function createOperationPlan({ owner, repo, issueNumber, automationKey }) {
  const operations = [];

  const plan = {
    owner,
    repo,
    issueNumber,
    automationKey,
    operations,

    /**
     * Adds a label operation.
     * @param {string} label - Label name to add.
     * @returns {object} The plan (for chaining).
     */
    addLabel(label) {
      operations.push({ type: OperationType.ADD_LABEL, label });
      return plan;
    },

    /**
     * Adds a remove-label operation.
     * @param {string} label - Label name to remove.
     * @returns {object} The plan (for chaining).
     */
    removeLabel(label) {
      operations.push({ type: OperationType.REMOVE_LABEL, label });
      return plan;
    },

    /**
     * Adds a comment operation.
     * @param {string} body - Comment body.
     * @returns {object} The plan (for chaining).
     */
    addComment(body) {
      operations.push({ type: OperationType.ADD_COMMENT, body });
      return plan;
    },

    /**
     * Adds an update-comment operation.
     * @param {number} commentId - ID of the comment to update.
     * @param {string} body - New comment body.
     * @returns {object} The plan (for chaining).
     */
    updateComment(commentId, body) {
      operations.push({ type: OperationType.UPDATE_COMMENT, commentId, body });
      return plan;
    },

    /**
     * Adds an assignee operation.
     * @param {string} username - GitHub username to assign.
     * @returns {object} The plan (for chaining).
     */
    addAssignee(username) {
      operations.push({ type: OperationType.ADD_ASSIGNEE, username });
      return plan;
    },

    /**
     * Adds a reaction operation.
     * @param {number} commentId - ID of the comment to react to.
     * @param {string} content - Reaction content (e.g., '+1', 'heart').
     * @returns {object} The plan (for chaining).
     */
    addReaction(commentId, content) {
      operations.push({ type: OperationType.ADD_REACTION, commentId, content });
      return plan;
    },

    /**
     * Returns a summary of the plan for logging/auditing.
     * @returns {string}
     */
    summarize() {
      if (operations.length === 0) return `[${automationKey}] No operations planned.`;
      const lines = operations.map(op => {
        switch (op.type) {
          case OperationType.ADD_LABEL: return `  + label "${op.label}"`;
          case OperationType.REMOVE_LABEL: return `  - label "${op.label}"`;
          case OperationType.ADD_COMMENT: return `  + comment (${op.body.length} chars)`;
          case OperationType.UPDATE_COMMENT: return `  ~ comment #${op.commentId}`;
          case OperationType.ADD_ASSIGNEE: return `  + assignee @${op.username}`;
          case OperationType.ADD_REACTION: return `  + reaction ${op.content}`;
          default: return `  ? unknown op: ${op.type}`;
        }
      });
      return `[${automationKey}] ${owner}/${repo}#${issueNumber}:\n${lines.join('\n')}`;
    },
  };

  return plan;
}

module.exports = { createOperationPlan, OperationType };

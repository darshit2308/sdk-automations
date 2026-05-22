// packages/probot-app/src/audit-sink.js
//
// Structured audit logger for the Probot adapter.
// Wraps Probot's app.log to provide a consistent logger interface for core
// logic, and adds structured context for future audit trail support.

/**
 * Creates a structured logger that delegates to the Probot app logger.
 *
 * Core logic expects a logger with .info(), .error(), and .log() methods.
 * This adapter fulfills that contract while preserving Probot's log context.
 *
 * @param {object} appLog - Probot's app.log instance.
 * @returns {{ info: Function, error: Function, log: Function }}
 */
function createLogger(appLog) {
  return {
    info: (msg) => appLog.info(msg),
    error: (msg) => appLog.error(msg),
    log: (msg) => appLog.info(msg),
  };
}

module.exports = { createLogger };

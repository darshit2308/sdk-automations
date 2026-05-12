const { runWithDependencies } = require('./run-automation');

async function run() {
  const actionsCore = require('@actions/core');
  const actionsGithub = require('@actions/github');

  const wrappedCore = {
    ...actionsCore,
    getInput(name, options) {
      if (name === 'automation') return 'review-sync';
      return actionsCore.getInput(name, options);
    },
  };

  await runWithDependencies({ actionsCore: wrappedCore, actionsGithub });
}

module.exports = { run };

if (require.main === module) {
  run();
}

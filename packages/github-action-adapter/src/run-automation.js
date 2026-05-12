const path = require('node:path');
const { loadConfig, runAutomation } = require('../../core/src');

function parseBooleanInput(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Expected boolean input, received: ${value}`);
}

function readInputs(core) {
  const automation = core.getInput('automation', { required: true });
  const configPath = core.getInput('config-path') || '.github/hiero-automation.yml';
  const dryRun = parseBooleanInput(core.getInput('dry-run'), undefined);
  const token = core.getInput('github-token', { required: true });

  return { automation, configPath, dryRun, token };
}

async function runWithDependencies(dependencies) {
  const {
    actionsCore,
    actionsGithub,
    cwd = process.cwd(),
    logger = console,
  } = dependencies;

  try {
    const inputs = readInputs(actionsCore);
    const github = actionsGithub.getOctokit(inputs.token);
    const config = loadConfig(path.resolve(cwd, inputs.configPath));

    await runAutomation(inputs.automation, {
      github,
      config,
      dryRun: inputs.dryRun,
      logger,
      event: actionsGithub.context.payload,
    });
  } catch (error) {
    actionsCore.setFailed(error.message || String(error));
  }
}

async function run() {
  const actionsCore = require('@actions/core');
  const actionsGithub = require('@actions/github');
  await runWithDependencies({ actionsCore, actionsGithub });
}

module.exports = { parseBooleanInput, readInputs, runWithDependencies, run };

if (require.main === module) {
  run();
}

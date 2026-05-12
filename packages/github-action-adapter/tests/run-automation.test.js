const assert = require('node:assert/strict');
const test = require('node:test');

const { parseBooleanInput, readInputs } = require('../src/run-automation');

function fakeCore(inputs) {
  return {
    getInput(name, options = {}) {
      const value = inputs[name] || '';
      if (options.required && value === '') {
        throw new Error(`Input required and not supplied: ${name}`);
      }
      return value;
    },
  };
}

test('parseBooleanInput accepts true, false, and empty default', () => {
  assert.equal(parseBooleanInput('true', undefined), true);
  assert.equal(parseBooleanInput('FALSE', undefined), false);
  assert.equal(parseBooleanInput('', false), false);
});

test('parseBooleanInput rejects invalid values', () => {
  assert.throws(() => parseBooleanInput('maybe', undefined), /Expected boolean input/);
});

test('readInputs validates required action inputs', () => {
  const inputs = readInputs(fakeCore({
    automation: 'review-sync',
    'github-token': 'token',
    'dry-run': 'true',
  }));

  assert.equal(inputs.automation, 'review-sync');
  assert.equal(inputs.configPath, '.github/hiero-automation.yml');
  assert.equal(inputs.dryRun, true);
  assert.equal(inputs.token, 'token');
});

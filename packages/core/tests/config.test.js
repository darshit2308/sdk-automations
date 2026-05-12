const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadConfig, parseConfig } = require('../src/config/load-config');
const { validateConfig } = require('../src/config/validate-config');

test('loads JSON config', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-automations-'));
  const configPath = path.join(dir, 'hiero-automation.json');
  fs.writeFileSync(configPath, JSON.stringify({
    repository: { owner: 'hiero-ledger', name: 'hiero-sdk-python' },
    labels: {
      reviewQueue: {
        juniorCommitter: 'queue:junior-committer',
        committers: 'queue:committers',
        maintainers: 'queue:maintainers',
        readyToMerge: 'status: ready-to-merge',
        communityReview: 'open to community review',
      },
    },
  }));

  const config = loadConfig(configPath);
  assert.equal(config.repository.name, 'hiero-sdk-python');
  assert.equal(config.labels.reviewQueue.readyToMerge, 'status: ready-to-merge');
});

test('loads simple YAML config', () => {
  const config = parseConfig(`
repository:
  owner: hiero-ledger
  name: hiero-sdk-python
labels:
  reviewQueue:
    juniorCommitter: "queue:junior-committer"
    committers: "queue:committers"
    maintainers: "queue:maintainers"
    readyToMerge: "status: ready-to-merge"
    communityReview: "open to community review"
reviewSync:
  enabled: true
  rateLimitFloor: 200
  includeDraftPullRequests: false
  dryRunDefault: false
skillHierarchy:
  - "Good First Issue"
  - "skill: beginner"
`, 'hiero-automation.yml');

  assert.equal(config.reviewSync.rateLimitFloor, 200);
  assert.deepEqual(config.skillHierarchy, ['Good First Issue', 'skill: beginner']);
});

test('missing config file fails clearly', () => {
  assert.throws(
    () => loadConfig('/definitely/not/here/hiero-automation.yml'),
    /Config file not found/
  );
});

test('invalid review-sync config fails validation', () => {
  assert.throws(
    () => validateConfig({ repository: { owner: 'hiero-ledger' } }, 'review-sync'),
    /repository.name/
  );
});

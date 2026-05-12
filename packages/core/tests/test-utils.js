function createConfig(overrides = {}) {
  return {
    repository: {
      owner: 'hiero-ledger',
      name: 'hiero-sdk-python',
    },
    labels: {
      reviewQueue: {
        juniorCommitter: 'queue:junior-committer',
        committers: 'queue:committers',
        maintainers: 'queue:maintainers',
        readyToMerge: 'status: ready-to-merge',
        communityReview: 'open to community review',
      },
    },
    reviewSync: {
      enabled: true,
      rateLimitFloor: 200,
      includeDraftPullRequests: false,
      dryRunDefault: false,
    },
    ...overrides,
  };
}

function createMockGithub(options = {}) {
  const {
    roles = {},
    reviews = [],
    existingLabels = {},
    checkRuns = [],
    pullRequests = [],
    rateLimitRemaining = 5000,
  } = options;

  const calls = {
    labelsAdded: [],
    labelsRemoved: [],
    labelsCreated: [],
    labelsChecked: [],
    permissionsChecked: [],
    pullsListed: 0,
  };

  const github = {
    calls,
    rest: {
      rateLimit: {
        get: async () => ({
          data: { resources: { core: { remaining: rateLimitRemaining } } },
        }),
      },
      repos: {
        getCollaboratorPermissionLevel: async ({ username }) => {
          calls.permissionsChecked.push(username);
          const role = roles[username];
          if (!role) throw Object.assign(new Error('Not found'), { status: 404 });
          return { data: role };
        },
      },
      pulls: {
        list: async () => {
          calls.pullsListed++;
          return { data: pullRequests };
        },
        listReviews: async () => ({ data: reviews }),
      },
      checks: {
        listForRef: async () => ({ data: { check_runs: checkRuns } }),
      },
      issues: {
        getLabel: async ({ name }) => {
          calls.labelsChecked.push(name);
          if (!existingLabels[name]) throw Object.assign(new Error('Not found'), { status: 404 });
          return { data: { name } };
        },
        createLabel: async ({ name, color, description }) => {
          calls.labelsCreated.push({ name, color, description });
          return {};
        },
        addLabels: async ({ labels }) => {
          calls.labelsAdded.push(...labels);
          return {};
        },
        removeLabel: async ({ name }) => {
          calls.labelsRemoved.push(name);
          return {};
        },
      },
    },
    paginate: async (fn, optionsForCall) => {
      const result = await fn(optionsForCall);
      if (result.data?.check_runs) return result.data.check_runs;
      return result.data || result || [];
    },
  };

  return github;
}

function createLogger() {
  const lines = [];
  return {
    lines,
    log(message) {
      lines.push(String(message));
    },
    error(message) {
      lines.push(String(message));
    },
  };
}

module.exports = { createConfig, createMockGithub, createLogger };

const { getLatestReviewStates } = require('./reviews');

const permissionCache = new Map();

async function getPermissionLevel(github, owner, repo, username, logger = console) {
  const cacheKey = `${owner}/${repo}/${username}`;

  if (permissionCache.has(cacheKey)) return permissionCache.get(cacheKey);

  try {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    const role = data.role_name || data.permission || 'none';
    permissionCache.set(cacheKey, role);
    return role;
  } catch (error) {
    if (error.status === 404) {
      permissionCache.set(cacheKey, 'none');
      return 'none';
    }
    logger.log(`Permission check failed for ${username}: ${error.message || error}. Treating as "none".`);
    return 'none';
  }
}

async function countApprovals(github, owner, repo, prNumber, logger = console) {
  const latestStates = await getLatestReviewStates(github, owner, repo, prNumber);

  let maintainerApprovals = 0;
  let coreApprovals = 0;
  let softApprovals = 0;

  for (const [username, state] of latestStates) {
    if (state !== 'APPROVED') continue;

    const role = await getPermissionLevel(github, owner, repo, username, logger);

    if (role === 'admin' || role === 'maintain') {
      maintainerApprovals++;
      coreApprovals++;
    } else if (role === 'write') {
      coreApprovals++;
    } else {
      softApprovals++;
    }
  }

  return {
    maintainerApprovals,
    coreApprovals,
    softApprovals,
    anyApproval: coreApprovals + softApprovals,
  };
}

function clearPermissionCache() {
  permissionCache.clear();
}

module.exports = { getPermissionLevel, countApprovals, clearPermissionCache };

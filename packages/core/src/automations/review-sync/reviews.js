async function getLatestReviewStates(github, owner, repo, prNumber) {
  const reviews = await github.paginate(github.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const sortedReviews = [...reviews].sort(
    (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at)
  );

  const latestByUser = new Map();

  for (const review of sortedReviews) {
    const login = review.user?.login;
    const state = review.state?.toUpperCase();

    if (!login || !state) continue;

    if (state === 'APPROVED' || state === 'CHANGES_REQUESTED') {
      latestByUser.set(login, state);
    } else if (state === 'DISMISSED') {
      latestByUser.delete(login);
    }
  }

  return latestByUser;
}

module.exports = { getLatestReviewStates };

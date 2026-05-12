function normalizeRepository(input) {
  if (input?.repository?.owner && input?.repository?.name) {
    return { owner: input.repository.owner, repo: input.repository.name };
  }

  if (input?.repo?.owner && input?.repo?.repo) {
    return { owner: input.repo.owner, repo: input.repo.repo };
  }

  if (input?.repo?.owner && input?.repo?.name) {
    return { owner: input.repo.owner, repo: input.repo.name };
  }

  throw new Error('Unable to determine repository owner/name');
}

module.exports = { normalizeRepository };

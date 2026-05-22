# sdk-automations

Shared GitHub automation platform for the Hiero ecosystem.

This repository now uses a **GitHub App first, GitHub Actions compatibility second** architecture:

- `packages/probot-app` is the primary adapter for real-time webhook-driven automations.
- `packages/core` contains shared normalization, routing, dispatching, policies, and execution helpers.
- `packages/github-action-adapter` and `actions/*` remain supported for repositories that still need local workflow callers.

## Current Scope

Implemented automations:

- `assign`
- `pr-checks`
- `review-sync`

Repository-owned configuration is read from the target repository default branch or checked-out workspace:

- `.github/hiero-automation.json`
- `.github/hiero-automation.yml`
- `.github/hiero-automation.yaml`

## Architecture

Primary runtime path:

```text
GitHub webhook
  -> packages/probot-app/src/listener.js
  -> packages/core/src/events/normalize.js
  -> packages/core/src/routing/route-event.js
  -> packages/core/src/dispatcher/dispatch.js
  -> packages/core/src/policies/{assign,pr-checks,review-sync}/policy.js
  -> GitHub API writes
```

Compatibility action path:

```text
Caller workflow
  -> actions/run-automation or actions/review-sync
  -> packages/github-action-adapter
  -> packages/core dispatcher/policies
```

The repository is mid-transition toward a stricter `OperationPlan` plus executor model. That layer already exists in `packages/core/src/operations/`, but some production policies still perform direct GitHub API calls while the migration is completed.

## Package Layout

```text
actions/                         Generated GitHub Action entrypoints and bundles
docs/                            Architecture, migration notes, ADRs, adapter docs
examples/                        Example caller workflows and config files
packages/core/                   Shared normalization, routing, dispatch, policies, operations
packages/github-action-adapter/  GitHub Actions compatibility adapter
packages/probot-app/             Primary GitHub App adapter
schemas/                         Config schema
```

## Security Model

- Probot reads config from the repository default branch through the Contents API.
- The GitHub App fails closed on missing or invalid config: it logs and aborts the automation instead of mutating state.
- GitHub Actions callers keep their own workflow triggers, permissions, checkout strategy, concurrency, and `step-security/harden-runner`.
- `pull_request_target` workflows must never execute untrusted PR head code with privileged tokens.
- Generated Action bundles in `actions/*/dist/index.js` are committed and CI verifies they stay in sync with source.

## Local Development

Requirements:

- Node.js 20+

Commands:

```bash
npm install
npm test
npm run build
```

`npm run build` regenerates the committed GitHub Action bundles:

- `actions/run-automation/dist/index.js`
- `actions/review-sync/dist/index.js`

## Documentation

- [Architecture](./docs/architecture.md)
- [Caller Interface](./docs/caller-interface.md)
- [Probot Adapter](./docs/probot-adapter.md)
- [Migration Plan](./docs/migration-plan.md)
- [ADR 0002: GitHub App First, Actions as Compatibility Adapter](./docs/adrs/0002-github-app-first-actions-as-compatibility-adapter.md)

## Status Notes

- `docs/adrs/0001-actions-first-probot-later.md` is preserved as history and superseded by ADR 0002.
- `docs/phased-migration-plan.md` captures the earlier actions-first proof strategy for the LFDT project and is retained as historical context.

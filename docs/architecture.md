# Architecture

## Why This Repo Exists

Hiero SDK repositories previously duplicated GitHub automation logic in local workflow YAML and scripts. This repository centralizes reusable automation behavior while providing multiple ways for repositories to consume it.

The goal is to share logic, enforce consistent policies across SDKs, and provide a single place to update automations.

## Centralized GitHub App (Primary)

The primary delivery mechanism is the **Hiero SDK Automations GitHub App** (built with Probot).

- Listens to webhooks in real-time
- Uses fine-grained, scoped installation tokens
- Requires no local workflow YAML in target repositories
- Standardizes events across all installed SDK repos

## GitHub Action Adapters (Compatibility)

For repositories that have not yet migrated, or for specific policies that still need to run in the context of a local GitHub Actions workflow (e.g. relying on local repository secrets or specific runner environments), this repo also exports GitHub Actions (`actions/run-automation` and `actions/review-sync`).

## Shared Core

Reusable behavior lives in `packages/core`. The core architecture follows a strict, one-way data flow pipeline:

```
GitHub webhook
  → listener           adapter-specific (Probot or Actions)
  → normalizer         packages/core/src/events/normalize.js
  → router             packages/core/src/routing/route-event.js
  → dispatcher         packages/core/src/dispatcher/dispatch.js
  → policy module      packages/core/src/policies/{name}/policy.js
  → operation plan     packages/core/src/operations/operation-plan.js
  → executor           packages/core/src/operations/executor.js
  → GitHub API write   adapter-specific GitHub client
```

### 1. Listener (Adapter)
The adapter (`packages/probot-app` or `packages/github-action-adapter`) listens for GitHub events. It loads the configuration for the specific repository and passes the raw payload to the core.

### 2. Normalizer
`events/normalize.js` takes raw GitHub webhook payloads (which vary wildly) and normalizes them into a consistent internal `NormalizedEvent` structure.

### 3. Router
`routing/route-event.js` maps a normalized event (e.g. `issue_comment.created` + `/assign`) to a specific automation key (e.g. `assign`).

### 4. Dispatcher
`dispatcher/dispatch.js` routes the automation key to the correct policy module and passes along the necessary context (config, GitHub client, event details).

### 5. Policies
Business logic lives in `packages/core/src/policies/`. Policies evaluate the event, check prerequisites, and decide what should happen. The long-term target is for all policies to produce an `OperationPlan`, but the current codebase is in transition: some policies still make direct GitHub API calls while newer logic and refactors use the operations layer.

### 6. Operations & Executor
An `OperationPlan` is a pure data structure describing intended side effects (add label, assign user, post comment). The executor (`operations/executor.js`) carries out these plans using the injected GitHub client. This layer exists today and is actively used for testability and future refactors, but it is not yet the sole execution path for every production policy.

This separation enables:
- **Testability:** Policies can be unit tested without mocking the GitHub API.
- **Dry-run mode:** The executor can log operations instead of applying them.
- **Auditing:** We can easily log all intended actions before they happen.

# ADR 0002: GitHub App First, Actions as Compatibility Adapter

## Status

Accepted — Supersedes [ADR 0001](./0001-actions-first-probot-later.md)

## Context

ADR 0001 chose GitHub Actions as the primary delivery mechanism and deferred Probot to a later phase. Since then, the project has proven core logic in `packages/core`, shipped a working Probot adapter in `packages/probot-app` with `/assign`, PR quality checks, and review-sync automations, and validated the architecture through 68+ passing tests.

A GitHub App (Probot) provides significant advantages for the next phase:

- **Real-time webhooks** — no polling, no cron-scheduled runs
- **Fine-grained permissions** — GitHub App installations use scoped tokens
- **Cross-repository installation** — one App serves all SDK repos
- **Richer event context** — direct access to webhook payloads without workflow indirection
- **Simpler contributor experience** — no workflow YAML to maintain per-repo

## Decision

**The GitHub App (Probot) is now the primary product.** The architectural priority order is:

1. **`packages/probot-app`** — Primary adapter. Listens to webhooks, delegates to core.
2. **`packages/core`** — Reusable shared logic. All policies, event normalization, routing, dispatching, and operations live here.
3. **`packages/github-action-adapter` + `actions/`** — Compatibility adapter. Kept for gradual migration and SDK repos that still call central logic through Actions.

### Architecture: Listener → Router → Dispatcher

The core follows Sophie's layered architecture:

```
GitHub webhook
  → listener           packages/probot-app/src/listener.js
  → normalizer          packages/core/src/events/normalize.js
  → router              packages/core/src/routing/route-event.js
  → dispatcher          packages/core/src/dispatcher/dispatch.js
  → policy module       packages/core/src/policies/{name}/policy.js
  → operation plan      packages/core/src/operations/operation-plan.js
  → executor            packages/core/src/operations/executor.js
  → GitHub API write    packages/probot-app/src/github-client.js
```

Key boundaries:

- **Listener is adapter-specific.** Probot listens to webhooks; GitHub Actions reads event files. The shared core starts after the event is normalized.
- **Policies live inside core**, not at the repo root. They are reusable business logic.
- **Operations are explicit as the target execution model.** The operation-plan and executor layers are part of the shared core and are being adopted incrementally; some current policies still perform direct GitHub API calls while the migration finishes. This separation enables auditing, dry-run, and testability.

### What stays

- `actions/` is **not deleted**. It remains for compatibility during gradual migration.
- `packages/github-action-adapter` continues to work — it calls the same core API.
- All existing automation keys (`assign`, `pr-checks`, `review-sync`) remain stable.

## Consequences

- New automation development starts in `packages/core/src/policies/` and is wired through `packages/probot-app`.
- The Actions adapter is maintained but not the primary development path.
- SDK repos can migrate from Actions to the GitHub App at their own pace.
- The listener ↔ core boundary is clean — future adapters (CLI, Slack, etc.) can reuse the same core.

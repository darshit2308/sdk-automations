# sdk-automations

Shared GitHub automation logic for Hiero SDK repositories.

This repository is intentionally **actions-first, Probot-later**:

- SDK repositories keep their own workflow YAML for triggers, permissions, runner selection, concurrency, checkout strategy, and visible security steps.
- Shared behavior lives in `packages/core`, where it can be tested without GitHub Actions globals.
- Thin JavaScript actions in `actions/*` adapt GitHub Actions inputs to the shared core.
- A future Probot/GitHub App can reuse the same core modules once the behavior is proven.

The first pilot automation is `review-sync`, based on the modular Python SDK review queue label sync.

## Layout

```text
docs/                         Architecture, caller interface, migration notes, ADRs
examples/                     Example caller workflows for SDK repositories
schemas/                      Repo-owned automation config schema
packages/core/                Shared automation logic
packages/github-action-adapter/ GitHub Action input/client adapters
packages/probot-app/          Placeholder for future GitHub App adapter
actions/run-automation/       Generic JavaScript action entrypoint
actions/review-sync/          Review-sync-specific JavaScript action entrypoint
```

## Current Actions

```yaml
- name: Run shared review sync
  uses: hiero-hackers/sdk-automations/actions/review-sync@v0.1.0
  with:
    config-path: .github/hiero-automation.yml
    github-token: ${{ github.token }}
    dry-run: ${{ inputs.dry_run || 'false' }}
```

See [docs/caller-interface.md](docs/caller-interface.md) for the supported inputs and versioning guidance.

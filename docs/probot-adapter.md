# Probot Adapter

`packages/probot-app` contains the primary GitHub App adapter for `sdk-automations`.

## Runtime Flow

```text
GitHub webhook
  -> Probot listener
  -> normalizeEvent
  -> routeEvent
  -> dispatch
  -> shared policy
  -> GitHub API writes
```

The Probot adapter stays thin. It is responsible for:

1. Receiving webhook events
2. Applying small adapter-only safety filters
3. Loading repository config from the default branch
4. Delegating to the shared core pipeline

The shared business logic stays in `packages/core`.

## Supported Events

| Event | Behavior |
|---|---|
| `issue_comment.created` | Routes `/assign` issue comments to the `assign` policy |
| `pull_request.opened` | Routes to `pr-checks` and auto-assigns the author |
| `pull_request.reopened` | Routes to `pr-checks` with open/reopen semantics |
| `pull_request.synchronize` | Routes to `pr-checks` |
| `pull_request.edited` | Routes to `pr-checks` only when the PR body changed |

## Configuration

The App looks for one of:

- `.github/hiero-automation.json`
- `.github/hiero-automation.yml`
- `.github/hiero-automation.yaml`

The config is loaded from the repository default branch and validated before the automation runs. Missing or invalid config fails closed with no mutation.

## Permissions

The GitHub App manifest in `packages/probot-app/app.yml` currently requests:

- `issues: write`
- `pull_requests: write`
- `metadata: read`
- `contents: read`

These permissions match the current `assign` and `pr-checks` behavior.

## Implementation Note

The shared `OperationPlan` and executor layers already exist in `packages/core/src/operations/`, but not every policy has been fully migrated to them yet. The listener, router, and dispatcher pipeline is now the main execution path; the remaining work is finishing the internal policy-to-operation-plan migration.

## Local Development

```bash
cp packages/probot-app/.env.example packages/probot-app/.env
cd packages/probot-app
npm start
```

For local webhook forwarding, use the standard Probot + Smee workflow described in the Probot docs.

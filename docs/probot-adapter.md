# Probot Adapter

The `packages/probot-app` directory contains a [Probot](https://probot.github.io/) adapter that exposes the shared `sdk-automations` core logic as a GitHub App.

## Architecture

```
GitHub Webhook Events
        │
        ▼
┌──────────────────┐
│  Probot Adapter   │   packages/probot-app/src/index.js
│  (event routing)  │   Thin layer — no business logic here
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Shared Core     │   packages/core/src/automations/
│   (business logic)│   pr-checks/ , assign/ , review-sync/
└──────────────────┘
```

The Probot adapter is intentionally thin. It:

1. Listens for GitHub webhook events (`issue_comment.created`, `pull_request.*`)
2. Extracts the relevant data from the Probot context
3. Loads the repository's `hiero-automation.json` config
4. Delegates to the shared core functions

This means the same business logic works whether invoked via Probot (real-time webhooks) or via GitHub Actions (scheduled/on-demand).

## Supported Events

| Event | Handler | Core Function |
|---|---|---|
| `issue_comment.created` | `/assign` command on issues | `core.runAssign()` |
| `pull_request.opened` | Auto-assign author + run PR checks | `core.runPRChecks()` |
| `pull_request.reopened` | Re-run PR checks | `core.runPRChecks()` |
| `pull_request.synchronize` | New commits pushed — re-run checks | `core.runPRChecks()` |
| `pull_request.edited` | PR body changed — re-check issue links | `core.runPRChecks()` |

## Required Permissions

The GitHub App needs these permissions (defined in `app.yml`):

| Permission | Access | Reason |
|---|---|---|
| Issues | Write | Post comments, add assignees, manage labels |
| Pull Requests | Write | Read PR data, manage labels |
| Metadata | Read | Access repository metadata |
| Contents | Read | Read `.github/hiero-automation.json` config |

## Configuration

Each repository that installs the GitHub App must have a config file at:

```
.github/hiero-automation.json
```

This file follows the schema defined in `schemas/hiero-automation.schema.json`. If the config file is missing, the adapter falls back to minimal defaults.

## Local Development

1. Copy the environment template:
   ```bash
   cp packages/probot-app/.env.example packages/probot-app/.env
   ```

2. [Register a GitHub App](https://probot.github.io/docs/development/#manually-configuring-a-github-app) and fill in `APP_ID`, `WEBHOOK_SECRET`, and place the private key file.

3. Set up a webhook proxy for local testing:
   ```bash
   npx smee -u https://smee.io/YOUR_CHANNEL -t http://localhost:3000/api/github/webhooks
   ```

4. Start the Probot app:
   ```bash
   cd packages/probot-app
   npm start
   ```

## Testing

```bash
# Run Probot adapter tests
npm test -w packages/probot-app

# Run all workspace tests (core + probot + action adapter)
npm test
```

## Relationship to GitHub Actions Adapter

Both adapters consume the same core logic:

- **GitHub Actions adapter** (`packages/github-action-adapter`): Runs on-demand via workflow dispatch or on a schedule. Best for `review-sync` and batch operations.
- **Probot adapter** (`packages/probot-app`): Responds to real-time webhook events. Best for `/assign` commands and PR quality checks that need immediate feedback.

The migration strategy is: start with GitHub Actions for proven automations, then add the Probot adapter for real-time use cases once maintainers approve.

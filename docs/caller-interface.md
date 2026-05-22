# Caller Interface

There are two ways to consume Hiero SDK Automations: as a GitHub App (recommended) or via GitHub Actions.

## 1. GitHub App (Recommended)

The easiest way to consume the automations is by installing the **Hiero SDK Automations GitHub App** on your repository.

Once installed, the App automatically listens to webhooks and applies policies based on your repository's configuration file. No workflow YAML is required.

### Configuration

The App looks for a configuration file in your repository's default branch. JSON and simple YAML are supported:

- `.github/hiero-automation.json`
- `.github/hiero-automation.yml`
- `.github/hiero-automation.yaml`

If no configuration file is found, the App will gracefully skip automations for that repository.

---

## 2. GitHub Actions (Compatibility)

For repositories that cannot use the GitHub App, or for specific workflows that need to run locally, you can use the provided GitHub Actions.

### `actions/review-sync`

Runs the review queue label sync automation.

Inputs:

- `github-token` required: token used to call the GitHub API.
- `config-path` optional: repository-owned config file. Defaults to `.github/hiero-automation.yml`.
- `dry-run` optional: when `true`, logs label changes without applying them.

### `actions/run-automation`

Generic dispatcher for any automation.

Inputs:

- `automation` required: e.g., `assign`, `pr-checks`, `review-sync`.
- `github-token` required.
- `config-path` optional.
- `dry-run` optional.

### Action Configuration

Like the GitHub App, the actions load the config file from the checked-out workspace. Caller workflows *must* include `actions/checkout` before running the automation action so the config file is present on disk.

### Examples

**Running Review Sync**

```yaml
- name: Checkout
  uses: actions/checkout@v4

- name: Run shared review sync
  uses: hiero-hackers/sdk-automations/actions/review-sync@v0.1.0
  with:
    config-path: .github/hiero-automation.yml
    github-token: ${{ github.token }}
    dry-run: ${{ inputs.dry_run || 'false' }}
```

**Running Assign Command via Issue Comment**

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  assign:
    if: contains(github.event.comment.body, '/assign')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hiero-hackers/sdk-automations/actions/run-automation@v0.1.0
        with:
          automation: assign
          github-token: ${{ github.token }}
```

## Versioning

Production callers using GitHub Actions should pin to a release tag or SHA:

- Release tag for normal adoption: `@v0.1.0`
- Full commit SHA for maximum supply-chain stability

Avoid floating `@main` in production SDK repositories.

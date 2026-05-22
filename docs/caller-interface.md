# Caller Interface

There are two supported ways to consume `sdk-automations`:

1. GitHub App / Probot adapter
2. GitHub Actions compatibility adapter

## GitHub App

The primary consumption model is the **Hiero SDK Automations GitHub App**.

Repositories install the App and add a repository-owned config file on the default branch:

- `.github/hiero-automation.json`
- `.github/hiero-automation.yml`
- `.github/hiero-automation.yaml`

Behavior notes:

- The App loads and validates config before running an automation.
- Missing or invalid config fails closed for that event: the App logs and aborts without mutating repository state.
- No local workflow YAML is required for the App path.

## GitHub Actions Compatibility

For repositories that still need local workflow ownership, this repo exports two Actions:

### `actions/review-sync`

Runs the review queue label sync automation.

Inputs:

- `github-token` required
- `config-path` optional, defaults to `.github/hiero-automation.yml`
- `dry-run` optional

### `actions/run-automation`

Generic compatibility action for shared automations.

Inputs:

- `automation` required: `assign`, `pr-checks`, or `review-sync`
- `github-token` required
- `config-path` optional
- `dry-run` optional

Caller workflows must run `actions/checkout` first so the config file exists on disk.

## Example

```yaml
- name: Checkout
  uses: actions/checkout@v4

- name: Run shared automation
  uses: hiero-hackers/sdk-automations/actions/run-automation@v0.1.0
  with:
    automation: review-sync
    config-path: .github/hiero-automation.yml
    github-token: ${{ github.token }}
    dry-run: true
```

## Versioning

Production GitHub Actions callers should pin to a release tag or full commit SHA.

- Prefer full commit SHAs for maximum supply-chain stability.
- Avoid floating `@main`.

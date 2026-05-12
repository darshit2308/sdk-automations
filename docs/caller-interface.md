# Caller Interface

## Supported Actions

### `actions/review-sync`

Runs the review queue label sync pilot.

Inputs:

- `github-token` required: token used to call the GitHub API.
- `config-path` optional: repository-owned config file. Defaults to `.github/hiero-automation.yml`.
- `dry-run` optional: when `true`, logs label changes without applying them.

### `actions/run-automation`

Generic dispatcher.

Inputs:

- `automation` required: currently `review-sync`.
- `github-token` required.
- `config-path` optional.
- `dry-run` optional.

## Config Path Behavior

The caller repository owns its automation policy file. JSON and simple YAML are supported:

- `.github/hiero-automation.json`
- `.github/hiero-automation.yml`
- `.github/hiero-automation.yaml`

The action loads this file from the checked-out workspace, validates the sections needed by the selected automation, and passes the resulting config to core logic.

Caller workflows should include checkout when the action needs a local config file.

## Python Example

```yaml
- name: Run shared review sync
  uses: hiero-hackers/sdk-automations/actions/review-sync@v0.1.0
  with:
    config-path: .github/hiero-automation.yml
    github-token: ${{ github.token }}
    dry-run: ${{ inputs.dry_run || 'false' }}
```

## C++ Example

```yaml
- name: Run shared automation
  uses: hiero-hackers/sdk-automations/actions/run-automation@v0.1.0
  with:
    automation: assign
    config-path: .github/hiero-automation.json
    github-token: ${{ github.token }}
```

`assign` is shown as the intended future caller shape, not as an implemented automation in this first pilot.

## Versioning

Production callers should pin actions to a release tag or SHA:

- Release tag for normal adoption: `@v0.1.0`
- Full commit SHA for maximum supply-chain stability

Avoid floating `@main` in production SDK repositories.

Before creating a release tag, run `npm run build` and commit the generated `actions/*/dist/index.js` bundles so callers do not need to install dependencies.

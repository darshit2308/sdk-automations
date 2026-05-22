# Migration Plan

This file is the short current-state overview. The detailed earlier proof strategy lives in:

- [Phased Migration Plan](./phased-migration-plan.md)

## Recommendation

Use a phased rollout instead of a broad workflow rewrite.

1. Stabilize the central `sdk-automations` repo with official ownership, protected-branch governance, CI, releases, docs, schema validation, parity tests, and rollback guidance.
2. Treat the GitHub App / Probot adapter as the primary delivery path for real-time automations such as `/assign` and PR checks.
3. Keep GitHub Actions as a compatibility path for repositories that still need local workflow-owned execution, such as `review-sync` or repository-specific runner requirements.
4. Enable writes only after maintainers approve exact behavior, permissions, rollback, and parity results.
5. Compare C++ and Python assignment behavior before broader shared-policy rollout.
6. Expand repo adoption only after pilot behavior is stable and maintainers approve the boundary.

## Guardrails

- Keep `step-security/harden-runner` visible in any SDK workflow that still uses the compatibility actions.
- Keep SDK workflow triggers, permissions, checkout, concurrency, artifacts, and repo config local when using the GitHub Actions path.
- Treat `.github/hiero-automation.*` as privileged policy and protect it with CODEOWNERS and protected-branch review.
- Pin production action references to full-length commit SHAs when using the GitHub Actions compatibility path.
- Start with dry-run where practical, require automated parity before write mode, and keep rollback simple.

Important note:

> The `darshit2308/*` repositories used in the detailed plan are proof artifacts only. No upstream SDK should depend on a personal fork as the final production source.

The key principle is: centralize reusable logic and policy decisions without hiding repository security boundaries.

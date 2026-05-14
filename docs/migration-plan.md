# Migration Plan

This file is the short overview. The detailed strategy lives in:

- [Phased Migration Plan](./phased-migration-plan.md)

## Recommendation

Use a phased migration instead of a broad workflow rewrite.

1. Stabilize the central `sdk-automations` repo with official ownership, protected-branch governance, CI, releases, docs, schema validation, parity tests, and rollback guidance.
2. Pilot Python `review-sync` through a central JavaScript action, starting with a manual dry-run workflow.
3. Enable writes only after maintainers approve the exact behavior, final permissions, concurrency, rollback SLA, and automated parity results.
4. Compare C++ and Python assignment behavior before extracting shared assignment logic.
5. Keep C++ workflows unchanged until the #1627 investigation is accepted.
6. Expand to other SDKs only after the Python pilot is stable.
7. Add a Probot/GitHub App adapter later, reusing the same shared core logic.

## Guardrails

- Keep `step-security/harden-runner` visible in caller workflows.
- Keep SDK workflow triggers, permissions, checkout, concurrency, artifacts, and repo config local.
- Treat `.github/hiero-automation.*` as privileged policy and protect it with CODEOWNERS and protected-branch review.
- Pin production action references to full-length commit SHAs, not tags or `@main`.
- Start with dry-run, require automated parity before write mode, and keep rollback simple.

Important note:

> The `darshit2308/*` repositories used in the detailed plan are proof artifacts only. No upstream SDK should depend on a personal fork as the final production source.

The key principle is: centralize reusable logic, not every workflow boundary.

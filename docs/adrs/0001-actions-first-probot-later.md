# ADR 0001: Actions First, Probot Later

## Status

Accepted

## Context

Hiero SDK repositories need shared GitHub automation logic, but workflow details differ meaningfully across repositories and events. C++ maintainers also identified problems with local composite action wrappers and with hiding security steps such as `step-security/harden-runner`.

## Decision

Use central JavaScript GitHub Actions first.

- Keep workflow YAML local in SDK repositories.
- Keep event triggers, permissions, concurrency, checkout, runner selection, and `if:` guards local.
- Keep `step-security/harden-runner` visible in caller workflows.
- Put reusable behavior in `packages/core`.
- Use thin action adapters for GitHub Actions-specific inputs and clients.
- Defer Probot until core behavior is proven.

## Consequences

This reduces duplication in automation logic without forcing a broad workflow rewrite. It also gives maintainers a clear caller interface before production C++ migrations.

A future Probot/GitHub App can reuse the same core modules with a different adapter.

# Architecture

## Why This Repo Exists

Hiero SDK repositories currently duplicate GitHub automation logic in local workflow YAML and scripts. This repository centralizes reusable automation behavior while preserving each SDK repository's local workflow control.

The goal is to share logic, not to erase every workflow file from SDK repositories.

## Local Workflow Boundaries

SDK repositories should keep these concerns local:

- event triggers
- permissions
- concurrency
- `if:` guards
- runner selection
- checkout ref and sparse checkout details
- `step-security/harden-runner`
- multi-job orchestration and artifacts

Those details are meaningful per repository and per event. Hiding them behind a full reusable workflow would make the caller interface harder to reason about and would repeat the wrapper problems already found in C++.

## Shared Core

Reusable behavior lives in `packages/core`. Core modules receive explicit inputs:

- repository owner/name
- configuration values
- an Octokit-like GitHub client
- event payload or normalized context
- logger
- dry-run controls

Core modules do not depend on GitHub Actions globals, environment variables, or `@actions/*` packages. This makes the logic unit-testable and reusable by future adapters.

## GitHub Action Adapters

`packages/github-action-adapter` is the GitHub Actions boundary. It reads action inputs, creates the GitHub client, loads configuration, and calls `packages/core`.

The first action path is `review-sync`. `actions/run-automation` is a generic dispatch entrypoint, while `actions/review-sync` is a convenience entrypoint for the pilot.

## Actions First, Probot Later

A Probot/GitHub App can later reuse `packages/core` by providing a different adapter for authentication, event context, logging, and config loading.

Starting with JavaScript actions keeps migration small:

- SDK repositories can update one workflow step at a time.
- Existing triggers and security posture remain visible.
- Maintainers can review the central interface before production C++ workflow changes.

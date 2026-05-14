# Probot Proof of Concept History

## Timeline

### March 2025 — Initial Probot Prototype

The [`hiero-probot-official`](https://github.com/darshit2308/hiero-probot-official) repository was created as a standalone Probot proof of concept. It demonstrated that the C++ SDK workflow bot concepts (originally implemented as GitHub Actions with shell scripts) could be ported to a Probot-based GitHub App architecture.

**What the prototype implemented:**

- `/assign` command with full decision tree:
  - "Ready for dev" label gate
  - Skill-level prerequisite checks
  - Open assignment limits
  - Welcome messages with skill-specific wording
- PR quality checks on `pull_request.opened/reopened/synchronize/edited`:
  - DCO sign-off verification
  - GPG signature verification
  - Merge conflict detection (with retry polling)
  - Issue link + assignee verification (regex + GraphQL)
- Unified PR dashboard comment (auto-updating "scoreboard")
- Status label swapping (`needs review` ↔ `needs revision`)
- Auto-assign PR author
- Docker support and GitHub App manifest (`app.yml`)
- Demo video showing the bot in action

**Known limitations of the prototype:**

- `app.yml` only subscribed to `issues` events, but the code listened to `issue_comment` and `pull_request` — a configuration mismatch
- Policy values (team names, label names, documentation URLs) were hardcoded to C++ SDK specifics
- Permissions were incomplete for the runtime behavior
- Tests were stale and didn't cover the active handlers
- License metadata was inconsistent (README said Apache 2.0, package said ISC)
- No CI pipeline

### May 2025 — Evolution to Shared-Core Architecture

After maintainer feedback and architectural review, the design evolved into `sdk-automations`: a monorepo with shared core logic and multiple adapters.

**What changed:**

| Aspect | Prototype (`hiero-probot-official`) | Evolved (`sdk-automations`) |
|---|---|---|
| Architecture | Standalone Probot app | Monorepo: core + adapters |
| Config | Hardcoded C++ constants | JSON/YAML config per repo |
| Adapters | Probot only | GitHub Actions + Probot |
| Reusability | Single-repo | Any Hiero SDK repo |
| Testing | Stale single test | Comprehensive unit + integration |
| CI | None | GitHub Actions CI pipeline |
| Validation | None | JSON Schema + runtime validation |

## Design Philosophy

The key insight was: **centralize reusable logic, not every workflow boundary.**

The Probot prototype proved the concepts work. The `sdk-automations` architecture makes them production-ready by:

1. **Separating business logic from adapter concerns** — The same `checkDCO()`, `buildBotComment()`, and `runAssign()` functions work whether called from a Probot webhook handler or a GitHub Action.

2. **Making policy configurable** — Each repository provides its own `hiero-automation.json` with team names, label names, skill hierarchies, and documentation URLs. No more hardcoded C++ constants.

3. **Supporting incremental adoption** — Repositories can start with GitHub Actions (proven, low-risk) and add the Probot adapter later for real-time webhook handling.

## Narrative

> "I first built a standalone Probot proof of concept in March to validate the architecture. Then, after maintainer feedback, I evolved the design into sdk-automations: shared core logic with GitHub Action support now and a Probot adapter that reuses the same core. This gives us the flexibility to deploy via Actions today and add real-time webhook handling via Probot when ready."

This demonstrates architectural maturity: the ability to build a working prototype, gather feedback, and evolve the design without throwing away the validated concepts.

# Migration Plan

1. Establish this central repository structure, docs, examples, schema, and package boundaries.
2. Pilot Python `review-sync` through a central JavaScript action.
3. Expand schema validation as more repo-owned policy moves into `.github/hiero-automation.*`.
4. Compare C++ and Python assignment behavior without copying either script wholesale.
5. Implement a shared assignment core that is config-driven and tested with mocked GitHub clients.
6. Pilot one SDK repository before broader rollout.
7. Add a Probot/GitHub App adapter after the shared core interfaces are proven.

The C++ workflow structure should not be rewritten as part of the first central-repo PR. C++ issue work such as #1625, #1626, #1627, #1628, and #1629 should be considered as one cluster, with #1634 treated as related config groundwork.

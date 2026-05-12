# C++ Caller Examples

These files document the future central-action caller shape for C++ workflows. They are not the first migration target.

The first pilot is Python `review-sync` in dry-run mode. C++ contributor-facing bots such as `/assign` should wait until the shared assignment core is designed from both C++ and Python behavior and reviewed as part of the related C++ issue cluster.

The examples intentionally keep these details local and visible:

- `step-security/harden-runner`
- permissions
- concurrency
- `pull_request_target` checkout of only the default branch config
- multi-job workflow structure

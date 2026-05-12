# StepSecurity

`step-security/harden-runner` must stay visible in caller workflows.

Central actions in this repository must not wrap or hide `harden-runner`. Caller repositories should keep the literal step in their workflow YAML so maintainers and StepSecurity can see the security posture directly.

This avoids repeating the prior C++ problem where hiding `harden-runner` behind a wrapper caused unwanted StepSecurity PR noise.

Example:

```yaml
steps:
  - name: Harden runner
    uses: step-security/harden-runner@a5ad31d6a139d249332a2605b85202e8c0b78450
    with:
      egress-policy: audit

  - name: Run shared automation
    uses: hiero-hackers/sdk-automations/actions/review-sync@v0.1.0
    with:
      github-token: ${{ github.token }}
```

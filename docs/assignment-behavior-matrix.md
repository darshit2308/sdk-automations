# Assignment Behavior Matrix

This document outlines how the `/assign` command behaves across different Hiero SDK repositories, depending on their `hiero-automation` configuration.

Because the `sdk-automations` core is adapter-agnostic and config-driven, the bot's behavior automatically adapts to the policies defined in each repository.

## Comparison: C++ vs Python

Below is a comparison of the assignment rules derived from the example configurations in `examples/`.

| Feature | `hiero-sdk-cpp` | `hiero-sdk-python` |
|---|---|---|
| **Assignment Engine** | Enabled | Disabled |
| **Max Open Assignments** | 2 | Not enforced |
| **Good First Issue Cap** | 5 completions | Not enforced |
| **Ready for Dev Gate** | Requires `status: ready for dev` | Not configured |
| **Skill Hierarchy** | 4 levels: Good First Issue, Beginner, Intermediate, Advanced | None |
| **Prerequisites** | Enforced (e.g., 2 GFIs to unlock Beginner) | None |

## Decision Tree

When a user comments `/assign` on an issue, the bot evaluates the request in this exact order:

1. **Already Assigned:** If the issue has an assignee, reject.
2. **Ready for Dev:** If the issue lacks the "ready for dev" label defined in the config, reject.
3. **Skill Level Labeled:** If the issue lacks a skill level label from the hierarchy, reject and ping maintainers.
4. **Open Assignment Limit:** If the user currently has ≥ `maxOpenAssignments` issues open (excluding blocked issues), reject.
5. **Good First Issue Cap:** If the issue is a Good First Issue, and the user has closed ≥ `maxGoodFirstIssueCompletions` GFIs, reject and instruct them to graduate to Beginner issues.
6. **Skill Prerequisites:** If the issue is a higher skill level, check if the user has completed the required number of prerequisite issues. If not, reject.
7. **Success:** Assign the user, post a welcome message tailored to the skill level, remove the "ready for dev" label, and add the "in progress" label.

## Configuring the Good First Issue Cap

To prevent experienced contributors from taking Good First Issues away from newcomers, repositories can enforce a graduation cap.

In `.github/hiero-automation.json`:

```json
{
  "assignment": {
    "enabled": true,
    "maxOpenAssignments": 2,
    "maxGoodFirstIssueCompletions": 5
  }
}
```

If a user has 5 or more closed issues labeled `skill: good first issue`, the bot will automatically reject their request to be assigned to another Good First Issue and provide them instructions to look for `skill: beginner` issues instead.

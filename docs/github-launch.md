# GitHub launch checklist

1. Create a public repository called `mobix` under the chosen organization or account.
2. Replace `OWNER` in package metadata and CODEOWNERS; update homepage and documentation links.
3. Review ownership and third-party license compatibility; verify Apache-2.0 LICENSE and any NOTICE obligations.
4. Enable Issues, Discussions, and **private vulnerability reporting** in repository settings.
5. Configure branch protection/rulesets for `main`: require PRs, one review, passing `Node / build-and-test` status check, block force pushes and direct pushes.
6. Enable Dependabot security alerts and dependency review if available.
7. Create labels: `good first issue`, `help wanted`, `bug`, `documentation`, `android`, `ios`, `typescript`, `cli`, `security`.
8. Create a GitHub Project with `Backlog`, `In progress`, `In review`, `Done` columns.
9. Publish at least five approachable issues with explicit acceptance criteria.
10. Pin a welcome Discussion explaining how to contribute and what remains experimental.
11. Assign at least two maintainers if possible; establish private security/conduct contact channels.
12. Run CI on the default branch. Native CI needs platform toolchains and must not be represented as passing before it runs.
13. Confirm npm organization ownership, release policy, and dry-run checks before public npm beta release.

Suggested starter issues: CLI clean-room install smoke test; Android Gradle wrapper verification; iOS xtool signed build proof; bridge origin restriction tests; docs for camera/permission capability matrix.

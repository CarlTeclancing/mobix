# Contributing to Mobix

Thank you for helping improve Mobix. Mobix is experimental; please avoid claiming platform features work without testing on that platform.

## Start here

1. Check existing issues and GitHub Discussions. For large API or architectural changes, open a proposal issue before coding.
2. Fork the repository and create a branch, e.g. `fix/bridge-timeout` or `docs/ios-setup`.
3. Follow [docs/development.md](docs/development.md) and [docs/architecture.md](docs/architecture.md).
4. Make one focused change; include tests and documentation for changed public APIs.
5. Run `npm run check`. Run Android/iOS checks where toolchains are available; record any blocked checks.
6. Open a pull request using the provided template. Link the issue and provide reproduction steps and test output.

## Contribution areas

- `good first issue`: docs, test fixtures, reproducible bug fixes
- `help wanted`: native API implementation, build verification, examples
- `android`, `ios`, `typescript`, `cli`, `documentation`, `security`

## Pull request requirements

- Explain **what changed**, **why**, and **how it was tested**.
- Never commit passwords, API tokens, certificates, provisioning profiles, signing keys, or user data.
- Do not disable tests to hide failures.
- Do not introduce breaking changes without discussion and migration notes.
- Do not claim Android/iOS support based solely on TypeScript compilation or Swift parsing.
- Include a Changeset or changelog entry for user-facing changes once the release workflow is enabled.

## License

By submitting a contribution, you agree to license it under Apache-2.0. You retain copyright to your contribution. You must have rights to submit all included code and assets.

## Review and merge

Maintainers review correctness, API compatibility, security, test evidence, and documentation. Passing CI is necessary but not sufficient for merge. See [GOVERNANCE.md](GOVERNANCE.md).

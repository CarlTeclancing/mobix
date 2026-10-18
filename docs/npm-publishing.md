# npm publishing guide (maintainers)

**Nothing is automatically published by this repository.** Confirm the `@mobix` scope is available and that you have authorization to publish to it. If it is unavailable, replace package names, references and docs with your own npm organization scope before publishing.

1. Create/secure a GitHub organization or repository and an npm organization or owner account.
2. Replace `OWNER` in package repository metadata and `.github/CODEOWNERS` with the actual GitHub owner.
3. Enable 2FA and least-privilege access for GitHub/npm.
4. Install dependencies and run `npm run release:dry-run`.
5. Inspect each tarball with `npm pack --dry-run --json` to ensure it contains no secrets, local source paths, or omitted templates.
6. Confirm the CLI runs **from its packed tarball**, not only from this repository.
7. Publish the packages in dependency order (core, plugin-sdk, CLI) using `npm publish --access public --tag beta` from each package directory.
8. Prefer npm trusted publishing via GitHub Actions once configured. Do not commit npm tokens.
9. Test `npm install -g @mobix/cli@beta` and `mobix create demo-app` in a clean environment.
10. Create a GitHub release and publish accurate notes and verification status.

The first public release should be a beta, not a stable v1.0 release. `--tag beta` avoids assigning the default `latest` dist-tag.

**Important:** npm may reject an already-used version, reserved scope, invalid metadata, or authentication setup. Resolve those issues before attempting to publish.

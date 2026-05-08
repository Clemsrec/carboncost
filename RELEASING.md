# Releasing

This repository uses Changesets + GitHub Actions to publish packages to npm.

## Before publishing

- Confirm package name availability on npm.
- Confirm repository visibility and default branch (`main`).
- Verify all docs are in English.
- Verify examples run without manual fixes.
- Confirm package exports work for ESM and browser usage.
- Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- Add a Changeset entry.
- Review generated changelog text.

## Required metadata checks

- `repository` field in package metadata
- `bugs` field
- `homepage` field
- relevant `keywords`
- `LICENSE` present

## GitHub setup

- Public repository
- Main branch protection
- `NPM_TOKEN` GitHub secret
- GitHub Actions enabled
- Issue templates and PR template available

## npm setup

- `npm login`
- verify scope/public access strategy
- scoped packages should publish as public

## Release flow

1. Merge changes to `main`.
2. GitHub Action opens/updates version PR via Changesets.
3. Merge version PR.
4. Release workflow publishes to npm.
5. GitHub release notes are generated.

## Manual commands

```bash
pnpm version-packages
pnpm release
```

Use manual release only if automation is unavailable.

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

## Smoke testing with npm pack

Before publishing to npm, validate the published shape of packages using local pack archives. This catches packaging regressions (e.g., missing files, incorrect type paths, broken exports).

### Single smoke test

```bash
# Build, pack, install into consumer, typecheck, and run runtime tests
pnpm smoke:pack
```

This runs:
1. Full workspace build
2. `npm pack` for each package (core, browser, script-tag, next)
3. Fresh install into `smoke-tests/consumer-ts`
4. TypeScript typecheck (`tsc --noEmit`)
5. Consumer build
6. Runtime smoke test execution
7. Script-tag bundle integrity check

### Manual pack commands (advanced)

```bash
# Pack individual packages
pnpm run pack:core
pnpm run pack:browser
pnpm run pack:script-tag
pnpm run pack:next

# Pack all at once
pnpm run pack:all
```

Generated `.tgz` files are created in each package directory and can be inspected or shared.

### When to run

- **Before first release**: Validate all packages have correct structure
- **Before patch/minor releases**: Confirm publishing won't break consumers
- **After package.json changes**: Ensure exports and types point to correct files
- **In CI/CD**: Can be integrated into release workflow for safety

### Common issues

| Issue | Solution |
|-------|----------|
| "Cannot find module" in consumer | Verify package.json exports and types point to dist/ |
| Bundle file not found | Check script-tag package.json files field includes dist/ |
| TypeScript errors | Verify tsconfig.json in consumer matches your setup |

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

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
- `NPM_TOKEN` GitHub secret (being phased out, see the npm v12 section below)
- GitHub Actions enabled
- Issue templates and PR template available

## npm setup

- `npm login`
- verify scope/public access strategy
- scoped packages should publish as public

## npm v12 and the 2FA-bypass token deprecation

npm v12 turned install-time security defaults on and started deprecating
2FA-bypass granular access tokens (GATs). Two timelines matter here.

**Early August 2026 — account and package management.** 2FA-bypass tokens can no
longer create tokens, change package access or maintainers, or change trusted
publishing configuration. Do those in the npm web UI with 2FA. In particular,
you cannot script your way out of an expiring publish token: minting a new one
is now an interactive, 2FA-gated operation.

**Around January 2027 — direct publish.** 2FA-bypass tokens lose the ability to
publish directly. The `NPM_TOKEN` secret used by `.github/workflows/release.yml`
stops working at that point, so publishing needs to move to trusted publishing
(OIDC) or staged publishing with a human approval step before then.

### Migrating to trusted publishing

1. On npmjs.com, for each published package (`carbone-cost`, `@clemsrec/browser`,
   `@clemsrec/script-tag`, `@clemsrec/next`), open the package settings and add a
   trusted publisher: GitHub Actions, owner `Clemsrec`, repository `carboncost`,
   workflow file `release.yml`. npm does not validate these values when you save
   them, so they must match exactly.
2. The release workflow already grants `id-token: write`, and now runs Node 22,
   which satisfies the Node >= 22.14.0 / npm >= 11.5.1 requirement.
3. Confirm the publish path supports OIDC before removing `NPM_TOKEN`. Changesets
   picks its publish tool from the lockfile, so with `pnpm-lock.yaml` present it
   runs `pnpm publish`, not `npm publish` — pnpm's OIDC support must be verified
   at the pinned pnpm version, or the release step switched to `npm publish`.
4. Keep `NPM_TOKEN` in place until a trusted-publishing release has succeeded,
   then delete the secret and revoke the token.

### Install-time defaults (consumer impact)

None of the published packages declare `preinstall` / `install` / `postinstall`
scripts, and none depend on git or remote-URL dependencies. Consumers installing
them under npm v12 with `allowScripts` off and `--allow-git`/`--allow-remote` set
to `none` are unaffected. Keep it that way: adding an install script to any
published package would break installs for every consumer on npm v12 defaults.

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

# Prompt for VS Code AI agent — smoke testing via npm pack

You are a senior TypeScript library engineer working inside the **carboncost** monorepo.

Your task is to add a **local smoke-test pipeline** based on `npm pack` that validates the published shape of the packages before or after a real release.
This is **not** a feature sprint. Do not change the product API or behavior.

## Goal

Create a repeatable, automated smoke-test flow that:
- builds the workspace
- generates pack archives for each publishable package
- installs them into a fresh consumer project
- runs TypeScript typecheck
- runs a minimal runtime smoke test

The objective is to simulate how external projects consume the packages, using `npm pack` archives, as recommended practices for testing npm packages locally. The dev community often uses `npm pack` to validate packaging before pushing to the public registry. [web:195][web:168]

## Scope

Work only on:
- root workspace config (scripts, docs)
- `packages/core`
- `packages/browser`
- `packages/script-tag`
- `packages/next`
- new `smoke-tests/` folder

Do **not** modify runtime feature logic.

## Requirements

### 1. Add a smoke-tests consumer project

Create a minimal TS/Node consumer inside the repo, for example:

```txt
smoke-tests/
  consumer-ts/
    package.json
    tsconfig.json
    src/
      index.ts
      smoke-runtime.ts
```

This consumer project will:
- install the local `npm pack` archives
- import the packages like a real user would
- run `tsc --noEmit`
- run a small runtime smoke test script

### 2. Add scripts to generate pack archives

In the root `package.json`, add scripts along these lines (names are suggestions, not mandatory):

```json
"scripts": {
  "build": "pnpm -r run build",
  "pack:core": "cd packages/core && npm pack --json --silent",
  "pack:browser": "cd packages/browser && npm pack --json --silent",
  "pack:script-tag": "cd packages/script-tag && npm pack --json --silent",
  "pack:next": "cd packages/next && npm pack --json --silent",
  "pack:all": "pnpm run pack:core && pnpm run pack:browser && pnpm run pack:script-tag && pnpm run pack:next",
  "smoke:pack": "node smoke-tests/run-smoke-pack.mjs"
}
```

You are free to adjust the exact script names, but the intent must be:
- have a single `pnpm smoke:pack` entry
- that builds the workspace, packs the packages, and then runs the consumer tests

Use `npm pack` in a way that works well locally and in CI, similar to common practices for local package validation. [web:195][web:188]

### 3. Smoke runner script

Create `smoke-tests/run-smoke-pack.mjs` that will:

1. Build the workspace (`pnpm build` or by spawning the existing script).
2. Generate pack archives for each publishable package (`npm pack`).
3. Install those `.tgz` files inside `smoke-tests/consumer-ts`.
4. Inside `smoke-tests/consumer-ts`:
   - remove any previous `node_modules` / lockfile only if needed
   - install the pack archives
   - run `tsc --noEmit`
   - run a small runtime smoke test

Requirements for the runner:
- use Node ESM
- fail fast with a clear non-zero exit code on errors
- log concise results: which packages were packed, installed, typechecked, and executed

### 4. Consumer project behavior

The consumer project should:
- import a few key public APIs from the packages, for example:
  - core public API
  - browser SDK factory
  - one next adapter export if available
- call them with minimal dummy data
- verify the code compiles and executes

Suggested split:
- `src/index.ts` for type/import validation
- `src/smoke-runtime.ts` for runtime execution

Add scripts such as:
```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "build": "tsc -p tsconfig.json",
  "smoke": "node dist/smoke-runtime.js"
}
```

Do **not** add heavy dependencies.
Keep the consumer project tiny and deterministic.

### 5. Script-tag verification

Also verify the script-tag package in a lightweight way:
- confirm the `.tgz` contains the expected browser bundle
- confirm the file path matches package metadata
- if feasible, add a tiny assertion in the smoke runner that checks the bundle file exists after extraction/install

You do **not** need to build a browser automation suite.
Only verify packaging integrity and expected bundle presence.

### 6. Documentation

Update `RELEASING.md` to:
- describe when to run `pnpm smoke:pack`
- note that it uses `npm pack` and a local consumer project
- clarify that this is meant to catch packaging regressions before public releases

This matches common package validation practices where maintainers test consumption scenarios before publishing. [web:59][web:168]

## Constraints

- Do not change the public API surface.
- Do not bump versions by yourself in this task.
- Do not alter Changesets workflows.
- Keep comments and docs in English.
- Prefer Node.js stdlib only for the runner script.

## Completion criteria

Consider the task complete when:
- `pnpm smoke:pack` runs end-to-end without manual intervention
- the consumer project installs the generated pack archives successfully
- `tsc --noEmit` passes in the consumer project
- the runtime smoke script executes without throwing
- the script-tag bundle is verified as present

At the end, output a short summary with:
- pack files used
- install status
- typecheck status
- runtime status
- script-tag bundle status

## Suggested implementation order

1. Create `smoke-tests/consumer-ts`
2. Add consumer package.json and tsconfig
3. Add `src/index.ts`
4. Add `src/smoke-runtime.ts`
5. Create `smoke-tests/run-smoke-pack.mjs`

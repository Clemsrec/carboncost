# Contributing

Thanks for contributing to carbon-site-kit.

## Ground rules

- Keep documentation and code in sync.
- Keep APIs small and practical.
- Do not introduce fake precision in methodology.
- Use explicit methodology versioning.
- Keep all written docs in English.

## Required updates in every PR

- Update `CHANGELOG.md`.
- Update `README.md` when behavior, API, assumptions, or examples change.
- Update package README files when package-level usage changes.

PRs missing release notes or explanatory docs are not ready to merge.

## Local workflow

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Changesets

Use Changesets for versioning and release notes:

```bash
pnpm changeset
```

Then commit the generated file in `.changeset/`.

## Pull request checklist

- [ ] I ran `pnpm lint`.
- [ ] I ran `pnpm typecheck`.
- [ ] I ran `pnpm test`.
- [ ] I ran `pnpm build`.
- [ ] I added/updated a Changeset.
- [ ] I updated `CHANGELOG.md` and relevant README content.

## Code style

- TypeScript-first
- ESM-first
- no unnecessary dependencies
- clear exported types
- stable and minimal public API

## Contributors and developers

- Clément Tournier - Agence NuCom

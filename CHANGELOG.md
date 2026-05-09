# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

- Initial Phase 1 repository scaffold.
- Core SDK package.
- Browser SDK package.
- Script-tag distribution package.
- Next.js adapter package.
- GitHub Actions CI and release workflow.
- Changesets-based versioning.
- Initial examples and documentation.
- Core diagnostics helper `diagnose(config, recentEvents)` with explicit coverage statuses for web, API, AI, hosting, and client-device scope.
- Next.js integration example page at `/carbon-diagnostics` with environment-based enablement and optional secret-based access guard.

### Changed

- Added UI-friendly core helpers for formatting carbon results, aggregating pageview sessions, and generating simple awareness equivalents.
- Added local `npm pack` smoke testing workflow and release documentation to validate published package shape before release.

## [0.1.0] - 2026-05-08

### Added

- First public preview release.

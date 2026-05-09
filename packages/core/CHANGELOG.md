# carbone-cost

## 0.4.0

### Minor Changes

- Add a diagnostics layer to the core package with `diagnose(config, recentEvents)` and exported coverage types.

  This introduces transparent coverage statuses (`covered`, `partial`, `missing`, `unknown`) for:

  - web pageviews
  - API calls
  - AI inference usage
  - hosting metadata
  - client-device scope disclaimer

  Also adds tests and README examples for diagnostics usage.

## 0.3.0

### Minor Changes

- Add thin UI-oriented helpers on top of the existing carbon estimation model.

  - Add `formatForDisplay()` for rounded badge/footer display values and simple categories
  - Add `aggregateSession()` for pure pageview session aggregation
  - Add `toEquivalents()` for approximate phone charge and car distance equivalents
  - Add focused tests and documentation for the new helper layer
  - Update published wrapper packages to depend on the new core release

## Unreleased

### Added

- Added `formatForDisplay()` to map carbon results into UI-friendly rounded values, categories, and methodology metadata.
- Added `aggregateSession()` to compute total and average grams CO2e across pageview events.
- Added `toEquivalents()` to convert grams CO2e into approximate phone charge and car distance equivalents for awareness-oriented displays.
- Added focused tests and README examples for the new helper layer.
- Added `diagnose()` to compute integration coverage diagnostics with explicit `covered` / `partial` / `missing` / `unknown` statuses.
- Added diagnostics types: `CoverageStatus`, `CoverageDimension`, `CoverageReport`, `DiagnosticsConfig`, and `AnyEvent`.

## 0.2.1

### Patch Changes

- Packaging hardening pass: normalized TypeScript declarations, tightened published files, added smoke tests.

  **Changes:**

  - Fixed `types` and `exports.types` fields to point to generated `dist/*.d.ts` instead of source files
  - Tightened `files` field to publish only `dist/` (removed source files from npm packages)
  - Added smoke tests to verify package entrypoints and exports are accessible from published artifacts
  - Updated script-tag package to properly reference generated declaration file

  **Impact:** Improves type resolution for external consumers and reduces npm package size.

## 0.2.0

### Minor Changes

- 741709b: Initial Phase 1 public preview with core estimation helpers, browser SDK, script-tag global bundle, and Next.js adapter.

# @clemsrec/browser

## 0.2.9

### Patch Changes

- Updated dependencies [a0877c5]
  - carbone-cost@0.9.0

## 0.2.8

### Patch Changes

- Updated dependencies [a1efe75]
  - carbone-cost@0.8.0

## 0.2.7

### Patch Changes

- Updated dependencies [760796e]
  - carbone-cost@0.7.0

## 0.2.6

### Patch Changes

- Updated dependencies [326045d]
  - carbone-cost@0.6.0

## 0.2.5

### Patch Changes

- Updated dependencies [2cd535a]
  - carbone-cost@0.5.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - carbone-cost@0.4.1

## 0.2.3

### Patch Changes

- Updated dependencies
  - carbone-cost@0.4.0

## 0.2.2

### Patch Changes

- Add thin UI-oriented helpers on top of the existing carbon estimation model.

  - Add `formatForDisplay()` for rounded badge/footer display values and simple categories
  - Add `aggregateSession()` for pure pageview session aggregation
  - Add `toEquivalents()` for approximate phone charge and car distance equivalents
  - Add focused tests and documentation for the new helper layer
  - Update published wrapper packages to depend on the new core release

- Updated dependencies
  - carbone-cost@0.3.0

## 0.2.1

### Patch Changes

- Packaging hardening pass: normalized TypeScript declarations, tightened published files, added smoke tests.

  **Changes:**

  - Fixed `types` and `exports.types` fields to point to generated `dist/*.d.ts` instead of source files
  - Tightened `files` field to publish only `dist/` (removed source files from npm packages)
  - Added smoke tests to verify package entrypoints and exports are accessible from published artifacts
  - Updated script-tag package to properly reference generated declaration file

  **Impact:** Improves type resolution for external consumers and reduces npm package size.

- Updated dependencies
  - carbone-cost@0.2.1

## 0.2.0

### Minor Changes

- 741709b: Initial Phase 1 public preview with core estimation helpers, browser SDK, script-tag global bundle, and Next.js adapter.

### Patch Changes

- Updated dependencies [741709b]
  - carbone-cost@0.2.0

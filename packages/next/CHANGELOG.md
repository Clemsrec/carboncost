# @clemsrec/next

## 0.3.2

### Patch Changes

- Updated dependencies [760796e]
  - carbone-cost@0.7.0

## 0.3.1

### Patch Changes

- Updated dependencies [326045d]
  - carbone-cost@0.6.0

## 0.3.0

### Minor Changes

- 6b27541: Harden `collectHandler` and give it a way to actually do something with events.

  - A malformed JSON body now returns `400` instead of throwing an unhandled
    exception out of the route handler.
  - Added a body size limit (`maxBodyBytes`, 64 KB by default), checked against
    both the declared `content-length` and the real byte length, returning `413`.
  - Event payloads are validated against the supported event types, and both the
    `{ event }` envelope sent by the browser SDK and a bare event object are
    accepted.
  - New `onEvent` config hook, called once per accepted event, so consumers can
    persist or forward events without cloning and re-parsing the request. A
    throwing handler produces a `500` instead of an unhandled rejection.
  - Added test coverage for the handler, which previously had none.

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

# carbone-cost

## 0.9.1

### Patch Changes

- 5f76008: Fix two collector bugs found by a live integration.

  **Revisiting a route double-counted the session.** Measurements were keyed by
  route name while the timeline held one mark per route _opening_, so `readAll()`
  re-emitted the first visit's running total on every return. A three-step cycle
  reported 83 563 bytes against a real 45 347 — an 84% overstatement. Measurements
  are now accumulated per opening, which also restores the documented semantics
  (each visit is its own `web.pageview` event, summed by
  `aggregateEvents(groupBy: "route")`) and makes "coming back costs less"
  observable instead of impossible to show.

  **`cachedRequests` was structurally zero on Chromium.** `classifyEntry` folded
  two independent axes into one enum: Chromium reports a flat ~300 transferred
  bytes for a cache hit, so `transferred` matched first and the `cached` branch was
  unreachable on the very engine its documentation described. Cache is now a
  separate predicate, exported as `isCached()`, keyed on `deliveryType` where the
  browser exposes it and falling back to a zero transfer with a non-empty body
  elsewhere. Byte accounting is unchanged: cached bytes are still counted exactly
  as reported.

  Also:

  - `<CarbonBadge />`'s render function now receives the whole `UseCarbonResult`
    plus derived display values, rather than four fields. A real footer badge shows
    views and bytes, and the narrow payload meant reimplementing the component.
  - New `visitIndexForStartTime()`; `routeForStartTime()` stays as a wrapper.
  - Documented that a revisit opens a new measurement, and that a prefetched
    payload is billed to the route that triggered it.
  - Documented that on 0.x a caret range pins the minor, so `npm update` will not
    cross from 0.6 to 0.9 — `npm i carbone-cost@latest` does.

## 0.9.0

### Minor Changes

- a0877c5: Add `carbone-cost/react`, with `useCarbon()` and a `<CarbonBadge />`.

  ```tsx
  "use client";
  import { usePathname } from "next/navigation";
  import { CarbonBadge } from "carbone-cost/react/badge";

  export function Footer() {
    return (
      <CarbonBadge
        route={usePathname()}
        locale="fr"
        href="/empreinte-carbone"
      />
    );
  }
  ```

  React is an optional peer dependency, so importing `carbone-cost` or
  `carbone-cost/browser` never pulls it in.

  The route is passed in rather than read from a router, so nothing here is tied
  to a framework. In the App Router that is `usePathname()`.

  **The React layer shares one collector across every consumer.** `observePage()`
  throws on a second start, which is the right rule for the primitive — `buffered:
true` replays history, so two collectors double-count everything — but an app
  with a badge in each layout would hit it immediately. The store reference-counts
  subscribers, starts the collector on the first and stops it on the last, and
  hands everyone the same snapshot. `getServerSnapshot` is stable and empty, so
  hydration has nothing to mismatch on.

  `<CarbonBadge />` ships almost no styling, and takes a render function when the
  default is not wanted. A badge lives in someone else's footer, and a component
  that arrives with opinions about borders gets reimplemented rather than used.

## 0.8.0

### Minor Changes

- a1efe75: Add `carbone-cost/browser`, a measurement collector for the browser.

  Integrators were all rewriting the same eighty lines — `PerformanceObserver`
  wiring, the `transferSize === 0` ambiguity, route attribution in a SPA — while
  the arithmetic they were importing the package for was the trivial part.

  ```ts
  import { observePage } from "carbone-cost/browser";

  const collector = observePage({
    initialRoute: location.pathname,
    onMeasure: ({ route, bytesTransferred, unknownRequests, unknownOrigins }) =>
      trackPageview({
        route,
        bytesTransferred,
        unknownRequests,
        unknownOrigins,
      }),
  });
  ```

  The output maps onto `trackPageview()` without transformation. The module sends
  nothing, writes nothing, and touches no global at import time, so it is safe to
  import from code that also renders on a server.

  Decisions worth stating, because they are where a naive collector goes wrong:

  - Resources are classified in four cases, not two. `transferSize > 0`
    short-circuits: an opaque response reports 0 everywhere. A cross-origin
    resource **with** `Timing-Allow-Origin` served from cache reports
    `transferSize: 0` with a real body, and an opacity test reduced to "is it
    cross-origin?" would file it as unknown even though its size is known.
    Same-origin empty responses (204, preflight) are not opaque either.
  - Opacity uses `responseStatus === 0` where the browser exposes it, and falls
    back to comparing origins where it does not, such as Safari.
  - Attribution goes by each entry's `startTime` against a timeline of route
    changes, not by arrival order in the observer callback. The callback is
    batched, so crediting "the currently open route" misfiles every resource still
    in flight when a navigation happens.
  - The document is billed to the route in its own URL, not to whichever route is
    open, so a collector starting late does not charge 35 KB to the wrong page. It
    is counted once: soft navigations and bfcache restores produce no navigation
    entry.
  - Cached bytes are counted as reported. Chromium returns a flat ~300 bytes per
    cached resource where other engines return 0; the divergence is surfaced
    through `cachedRequests` rather than normalised by a constant that would go
    stale.
  - Only one collector may run at a time, enforced with a thrown error rather than
    a silent singleton, because `buffered: true` replays history and a second
    collector would count everything twice.

## 0.7.0

### Minor Changes

- 760796e: Make diagnostics machine-readable and display strings translatable.

  - `CoverageDimension` gains `reason`, a stable code (`not-expected`,
    `below-sample-threshold`, `unmeasured-requests`, …), and `metrics`, the
    numbers behind the verdict including the thresholds applied. `notes` stays
    English prose for integrators and should not be shown to end users — translate
    from `reason` instead.
  - New `not-applicable` coverage status. With `expectsAiTracking: false` and no
    events, `diagnose()` used to answer `unknown`, which reads as "we could not
    measure" where the truth is "there is nothing to measure".
  - The sample thresholds are exported as `MIN_SAMPLE_EVENTS` and
    `MIN_FIELD_COVERAGE_RATIO`, and appear in `metrics`, so a `partial` verdict
    explains itself instead of leaving the rule invisible.
  - New `unknownRequests` input on `WebPageviewInput`, for resources whose size
    could not be measured — typically opaque cross-origin responses reporting a
    `transferSize` of 0. Declaring them keeps the estimate an explicit undercount:
    confidence drops to `estimated`, an assumption says the total is a floor, and
    `diagnose()` caps coverage at `partial` with reason `unmeasured-requests`.
  - `toEquivalents()` accepts `{ locale, labels }`. Numbers are formatted with
    `Intl.NumberFormat`, so `locale: "fr"` yields `11,43 km` and `< 0,1 charge`,
    and unit words can be replaced outright.
  - `aggregateSession()` accepts any `CarbonEvent`, matching `aggregateEvents`, and
    reports `pageviewGrams` and `aiGrams` separately. `averageGramsPerView` stays
    based on pageviews alone, since dividing a total that includes inference by a
    pageview count would be meaningless.
  - `clientDevice` diagnostics now report `covered`: user device energy is a
    segment of the web model rather than an uncovered dimension.
  - `unknownOrigins` and `cachedRequests` join `WebPageviewInput`, so a collector
    payload maps onto `trackPageview()` without transformation. `diagnose()`
    deduplicates the origins and names them in its notes, which is the difference
    between telling a visitor "Firestore and Algolia are not counted" and "4
    requests are not counted".

## 0.6.0

### Minor Changes

- 326045d: Correct the web intensity coefficient, which was wrong by more than two orders
  of magnitude, and replace it with the full Sustainable Web Design Model.

  `WEB_GRAMS_PER_GB` was 0.5. The model the package claimed to follow gives
  roughly 148 gCO2e per GB (0.300 kWh/GB across all segments, at 494 gCO2e/kWh) —
  0.5 is a plausible per-megabyte figure mislabelled as per-gigabyte. Every web
  estimate produced before this release understates emissions by ~300x, and every
  real page collapsed into the "very-low" display band.

  **Every web number this package produces changes.** Anything published from an
  earlier version should be recomputed.

  - `estimateWeb` now applies per-segment intensities for data centre, network and
    user device, covering operational and embodied energy, and reports each
    segment in `breakdown` so a published figure can be audited.
  - Green hosting adjusts data centre operational emissions only, per the model,
    instead of halving the whole result on an unsourced constant. A fully green
    host now removes ~18% rather than 50%.
  - New `greenHostingFactor` input accepts a share between 0 and 1, for hosts that
    are partly renewable.
  - New `gridIntensityGCO2ePerKWh` input overrides the global average for
    operational emissions. Embodied emissions keep the global average, since
    hardware manufacturing spans global supply chains.
  - New `factorGPerGB` input bypasses the model entirely, mirroring
    `factorGPer1kTokens` on the AI side. Integrators who dispute the coefficient
    no longer have to fork.
  - Data transfer is now divided by 1e9 rather than 1024^3, matching the model's
    definition of a gigabyte.
  - `formatForDisplay` thresholds are recalibrated on grams per view. The previous
    bands were derived from the incorrect coefficient.
  - Methodology version is now `web-estimation-v2`, source
    `sustainable-web-design-model`.
  - Published tarballs no longer ship compiled test files.

## 0.5.0

### Minor Changes

- 2cd535a: Make estimation confidence honest and stop the AI factor table from going stale.

  - `estimateWeb` now reports `confidence: "estimated"` whenever no explicit
    hosting signal was given. Previously an omitted `greenHosting` field was
    reported as `benchmarked` even though nothing was known about the host; only
    the literal string `"unknown"` downgraded it.
  - AI model names are normalized before lookup, so dated or versioned aliases
    such as `gpt-4o-mini-2024-07-18` resolve to their known factor instead of
    falling through to the default.
  - Unknown models now fall back to a size tier derived from the qualifier in the
    model name (small / medium / large) rather than a single flat default, and are
    always reported as `estimated`. Exposed as `resolveModelTier()`.
  - New `factorGPer1kTokens` input overrides factor resolution entirely, for
    callers who have a factor they trust more than the built-in ones.
  - Factor lookup no longer uses a truthiness check, so a legitimate factor of `0`
    is treated as known.

## 0.4.1

### Patch Changes

- Improve developer experience for `toEquivalents()` by adding UI-ready display fields while preserving all existing raw numeric fields.

  Added display fields:

  - `phoneChargesDisplay`
  - `laptopChargesDisplay`
  - `trainKmDisplay`
  - `ledBulbHoursDisplay`

  Also updates docs with an external Next.js consumer example and a short pnpm workspace troubleshooting note.

## 0.4.1

### Patch Changes

- Improve `toEquivalents()` developer experience by adding UI-ready display fields while keeping all raw numeric fields unchanged.

  Added display fields:

  - `phoneChargesDisplay`
  - `laptopChargesDisplay`
  - `trainKmDisplay`
  - `ledBulbHoursDisplay`

  Also adds tests and documentation for near-zero display handling and sub-kilometer train formatting.

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

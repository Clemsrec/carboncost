---
"carbone-cost": minor
---

Make diagnostics machine-readable and display strings translatable.

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

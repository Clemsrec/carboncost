---
"carbone-cost": patch
---

Fix two collector bugs found by a live integration.

**Revisiting a route double-counted the session.** Measurements were keyed by
route name while the timeline held one mark per route *opening*, so `readAll()`
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

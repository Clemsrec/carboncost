---
"carbone-cost": minor
---

Add `carbone-cost/browser`, a measurement collector for the browser.

Integrators were all rewriting the same eighty lines — `PerformanceObserver`
wiring, the `transferSize === 0` ambiguity, route attribution in a SPA — while
the arithmetic they were importing the package for was the trivial part.

```ts
import { observePage } from "carbone-cost/browser";

const collector = observePage({
  initialRoute: location.pathname,
  onMeasure: ({ route, bytesTransferred, unknownRequests, unknownOrigins }) =>
    trackPageview({ route, bytesTransferred, unknownRequests, unknownOrigins })
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

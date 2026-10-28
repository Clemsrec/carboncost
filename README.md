# Carbon Site Kit

Carbon Site Kit is a lightweight SDK for estimating the carbon impact of websites and AI-powered features. It is designed for developers, agencies, and product teams who want a practical way to instrument web delivery and token-based AI usage without adding heavy complexity.

**One product, several names, so here they are in one place.** The product is
**Carbon Site Kit**. The core package on npm is `carbone-cost` — that is the name
you install. The repository is `Clemsrec/carboncost`. The adapters are published
under the `@clemsrec` scope. None of those names are changing; this paragraph
exists so you do not have to guess that they are the same thing.

## Why this exists

This toolkit targets:

- freelance developers
- web agencies
- modern SaaS teams
- website owners with JavaScript-enabled sites

It provides estimation and instrumentation helpers. It does not claim exact real-world emissions for every infrastructure setup.

## Phase 1 scope

- Free core package
- npm package distribution
- script-tag/CDN distribution
- Next.js adapter
- GitHub-first workflow with CI, Changesets, and release automation

Pro features are planned later and are out of scope for this release.

## Packages

| Package | What it is for |
| --- | --- |
| `carbone-cost` | The estimation core, plus `carbone-cost/browser` (page measurement) and `carbone-cost/react` (hook and badge). Start here. |
| `@clemsrec/browser` | Browser SDK that sends events to an endpoint you host. |
| `@clemsrec/script-tag` | The same SDK as one global, for sites with no build step. |
| `@clemsrec/next` | Next.js App Router adapter for the collecting route. |

## Installation

### npm / pnpm / yarn

```bash
npm install carbone-cost@latest
```

> While the package is on 0.x, a caret range pins the **minor**, so
> `npm update carbone-cost` will not move you from 0.6 to 0.9. Use
> `npm i carbone-cost@latest` to cross a minor.

```bash
pnpm add carbone-cost
```

```bash
yarn add carbone-cost
```

The browser SDK and the Next.js adapter are separate, optional packages:

```bash
npm install @clemsrec/browser @clemsrec/next
```

All packages are ESM only. They work in the Next.js App Router, Vite, and any
bundler targeting ES modules. A CommonJS `require()` will fail.

### Script tag / CDN

The bundle is published to npm, so any npm CDN serves it. It is an IIFE that
exposes `window.CarbonSiteKit`, and it weighs about 6.7 kB minified.

```html
<script src="https://cdn.jsdelivr.net/npm/@clemsrec/script-tag@0.2.10/dist/carbon-site-kit.min.js"></script>
<script>
  window.CarbonSiteKit.trackPageview({ bytesTransferred: 1500000 });
</script>
```

Pin the version. An unpinned CDN URL silently upgrades a script you did not
review, on every visitor, for as long as the tag stays in your HTML.

Two things this build does not do, and both surprise people:

- **It does not measure the page.** `observePage` lives in `carbone-cost/browser`,
  which is ESM only, so the global expects you to pass `bytesTransferred`
  yourself. If you want the bytes counted for you, use the npm path below.
- **It sends nothing until you ask.** `init({ endpoint })` is what turns on the
  transport; without it, `trackPageview` computes and returns, and that is all.

## Quick start

### A badge, with no backend at all

The shortest useful integration measures the page and shows the result. Nothing
is sent, no cookie is written, no storage is touched — the tally lives in memory
and disappears with the tab.

```ts
import { observePage } from "carbone-cost/browser";
import { formatForDisplay, trackPageview } from "carbone-cost";

observePage({
  initialRoute: location.pathname,
  onMeasure(measurement) {
    const event = trackPageview(measurement);
    const badge = formatForDisplay(event.result);
    document.querySelector("#carbon")!.textContent =
      badge.gramsPerViewRounded + " g CO2e";
  }
});
```

Add an endpoint only when you actually want to aggregate across visitors — that
is a second decision, with its own privacy consequences, and it is covered under
[Browser SDK](#browser-sdk) below.

### Core (Node or browser-safe logic)

```ts
import {
  aggregateEvents,
  aggregateSession,
  explain,
  formatForDisplay,
  toEquivalents,
  trackAIUsage,
  trackPageview
} from "carbone-cost";

const webEvent = trackPageview({
  route: "/pricing",
  bytesTransferred: 1200000,
  greenHosting: "unknown"
});

const aiEvent = trackAIUsage({
  provider: "openai",
  model: "gpt-4o-mini",
  promptTokens: 800,
  completionTokens: 300
});

const summary = aggregateEvents([webEvent, aiEvent], { groupBy: "type" });
const display = formatForDisplay(webEvent.result);
const session = aggregateSession([webEvent]);
const equivalents = toEquivalents(session.totalGrams);
const methodology = explain();
```

### AI usage: from tokens to energy to carbon

Since 0.10.0 (`ai-token-estimation-v2`), an AI request is estimated the way
[Carbon Watch](https://carbonewatch.fr) does it: tokens become server energy,
energy becomes carbon at the grid of the region where the request is computed,
and server manufacturing is added on top.

```
compute-equivalent tokens = generated + 0.25 x (read - cached + 0.065 x cached)
energy (Wh)               = PUE 1.2 x 0.7 Wh per 1,000 x compute-equivalent tokens / 1000
carbon (g)                = energy / 1000 x grid of the region + 0.019 g per 1,000 compute-equivalent tokens
```

| Assumption | Central | Low | High |
| --- | --- | --- | --- |
| Energy per 1,000 generated tokens, before PUE | 0.7 Wh | 0.17 | 5.1 |
| Token read, relative to a token generated | 0.25 | 1/21 | 0.35 |
| Token read from cache, relative to a token read | 0.065 | 0.045 | 0.37 |
| Data centre PUE | 1.2 | 1.09 | 1.27 |
| Server manufacturing, per 1,000 compute-equivalent tokens | 0.019 g | 0.004 | 0.13 |

The low and high values are returned as `result.range`; `gramsCO2e` stays the
central value. The grid does not vary within the range. Each value and bound is
sourced in Carbon Watch's sensitivity notes (CLEER 2026, Elsworth et al. 2025,
EcoLogits 0.11.3, Jegham et al. 2025, Irminsul 2026, BoaviztAPI 2.5.0).

The region defaults to where the provider mainly computes: `US` for OpenAI,
Anthropic and Google, `EU` for Mistral, the world average otherwise. A region
the table does not know counts at the world average, never at the cleanest grid.

```ts
const event = trackAIUsage({
  provider: "mistral",
  model: "mistral-medium",
  promptTokens: 12_000,
  cachedTokens: 9_000,       // part of promptTokens served from cache
  completionTokens: 800,
  region: "FR"               // where the request is computed, if you know it
});

event.result.gramsCO2e;      // central estimate
event.result.range;          // { low, high }
event.result.breakdown;      // energyWh, gridIntensityGCO2ePerKWh, embodiedGrams, ...
```

When you know your deployment better, override what you know. `whPer1kOutputTokens`
and `pue` hold on both bounds, since they are facts, not assumptions.
`factorGPer1kTokens` bypasses the model entirely and is the only case reported as
`benchmarked`.

What the model leaves out: training, network transfer, end of life, the user's
device, and reasoning tokens a provider does not report in `completionTokens`.
The model name no longer selects a factor: the built-in table of 2024 models had
no published source, and the range already spans small to frontier models.

### Grid intensity by region

`region` sets the grid from a built-in table (`GRID_REGIONS`): Ember's 2025
lifecycle intensities, rounded to the unit, and ADEME Base Carbone 2024 for
France (51.9 gCO2e/kWh). Codes are ISO 3166 alpha-2, plus `EU` and `WORLD`.

For web pageviews, `region` is where the site is hosted (data centre and
network) and `visitorRegion` is where the visitor is (user device only). An
explicit `gridIntensityGCO2ePerKWh` wins over both, and an unknown code keeps the
model default of 494 gCO2e/kWh, with an assumption line saying so. Web estimates
have no `range`: the Sustainable Web Design Model publishes no bounds, and this
package does not invent them.

### Measuring a page in the browser

`carbone-cost/browser` observes what a page actually transferred. It sends
nothing, writes no cookie and touches no storage — the tally lives in memory and
disappears with the tab. Nothing runs at import time, so the module is safe to
import from code that also renders on a server.

```ts
import { observePage } from "carbone-cost/browser";
import { trackPageview } from "carbone-cost";

const collector = observePage({
  initialRoute: location.pathname,
  onMeasure(measurement) {
    // Debounced, and cumulative for the route.
    const { route, bytesTransferred, unknownRequests, unknownOrigins } = measurement;
    trackPageview({ route, bytesTransferred, unknownRequests, unknownOrigins });
  }
});

collector.setRoute("/pricing"); // on every client-side navigation
collector.stop();               // idempotent
```

`setRoute` is a push, not a getter: the collector cannot know when a client-side
navigation happens, and in frameworks that swap the path during render a getter
read on resource arrival would be consulted at arbitrary moments.

A `Measurement` maps onto `trackPageview()` without transformation:

| Field | Meaning |
| --- | --- |
| `bytesTransferred` | Bytes observed crossing the network |
| `unknownRequests` | Resources whose size the browser hid |
| `unknownOrigins` | Which origins those were, deduplicated |
| `cachedRequests` | Resources served from cache |
| `requests` | Every entry attributed to the route |

Three things worth knowing before you trust the numbers:

- **Cached bytes are counted as the browser reports them.** Chromium returns a
  flat ~300 bytes per cached resource where other engines return 0. That
  divergence is surfaced through `cachedRequests` rather than normalised away —
  subtracting a hardcoded constant would become an invented number the day
  Chromium changes it.
- **Opaque resources are counted as unknown, never as zero.** A cross-origin
  response without `Timing-Allow-Origin` hides its size. A cross-origin response
  *with* the header, served from cache, is not opaque and is measured normally.
- **A bfcache restore costs nothing.** No navigation entry, no resources. That
  is correct, and it will look like a bug to anyone not expecting it.
- **Revisiting a route opens a new measurement.** `readAll()` returns one entry
  per visit, not per route, so a session that comes back to a page shows the
  cheaper second visit rather than hiding it. Group them yourself with
  `aggregateEvents(events, { groupBy: "route" })`.
- **A prefetched payload is billed to the route that triggered it.** Frameworks
  fetch the next route's payload on hover or click, before the path changes, so
  its `startTime` precedes the new route's mark. Arriving on a page can
  therefore show near-zero bytes while the page you came from carries them.
  That is the honest accounting — those bytes were spent by the earlier page —
  but it surprises people.

Only one collector may run at a time — `buffered: true` replays history, so a
second one would count everything twice. Starting a second throws rather than
silently double-counting.

### UI-friendly helpers

The core package also exposes thin presentation helpers for product surfaces such as footer badges, session summaries, and diagnostic pages.

```ts
import {
  aggregateSession,
  formatForDisplay,
  toEquivalents,
  trackPageview
} from "carbone-cost";

const pageview = trackPageview({
  route: "/carbon-test",
  bytesTransferred: 1200000
});

const badge = formatForDisplay(pageview.result);
const session = aggregateSession([pageview]);
const awareness = toEquivalents(session.totalGrams);
```

- `formatForDisplay()` returns rounded UI values, a simple category, and the methodology version.
- `aggregateSession()` sums pageview events into a session total and average grams per view.
- `toEquivalents()` maps grams CO2e to approximate comparisons and now returns both raw values and UI-ready display strings.

Quick example:

```ts
const eq = toEquivalents(8.4);

console.log(eq.trainKm); // raw numeric value
console.log(eq.trainKmDisplay); // UI-ready string
console.log(eq.phoneChargesDisplay);
```

Display fields are approximate and intended for awareness. Use raw fields if you need custom formatting or localization.

The core package also exposes `diagnose(config, recentEvents)` to produce integration coverage diagnostics (`covered`, `partial`, `missing`, `unknown`) for web, API, AI, and hosting dimensions.

These helpers are intended for awareness and reporting consistency. They do not change the underlying estimation formulas.

## Release story: 0.4.x

**0.4.0** introduced the diagnostics layer:
- `diagnose(config, recentEvents)` for transparent coverage analysis
- Explicit status badges: `covered`, `partial`, `missing`, `unknown`
- Coverage dimensions: web pageviews, API calls, AI usage, hosting, client device
- Support for `/carbon-diagnostics` pages in Next.js

**0.4.1** polished developer experience:
- `toEquivalents()` now returns both raw numeric values and UI-ready display strings
- Examples: `trainKmDisplay: "11.43 km"`, `phoneChargesDisplay: "4.9 charge"`
- Improved external consumer documentation with real Next.js example
- Validated in fresh npm-only and pnpm-only setups

## What this package does and does not do

### What it does

- Estimates website carbon footprint from pageview activity (bytes transferred, route)
- Estimates AI usage carbon footprint from token counts (model, provider, prompt/completion tokens)
- Aggregates events into session or batch summaries
- Exposes coverage diagnostics when you provide tracking events for web, API, AI, and hosting
- Provides human-readable equivalents for awareness (phone charges, train distance, LED hours, etc.)
- Returns both raw numeric values and UI-friendly display strings

### What it does not do

- It does not automatically discover backend services, APIs, or infrastructure without integration hooks
- It does not provide a comprehensive corporate carbon inventory or Scope 3 reporting
- It does not claim exact end-to-end physical emissions for your entire application stack
- It does not track unmeasured activities (e.g., database queries, caching behavior) unless you explicitly instrument them
- It depends on available activity data and methodology assumptions, which are approximate

The package is intended for **directional tracking and awareness**, not formal LCA or compliance reporting.

## External consumer example (Next.js)

```bash
pnpm create next-app@latest carbone-consumer --ts --app
cd carbone-consumer
pnpm add carbone-cost
```

Create `app/carbon-test/page.tsx`:

```tsx
import {
  diagnose,
  formatForDisplay,
  toEquivalents,
  trackPageview,
  type AnyEvent,
  type DiagnosticsConfig
} from "carbone-cost";

export default function CarbonTestPage() {
  const pageview = trackPageview({ route: "/carbon-test", bytesTransferred: 1_200_000 });
  const display = formatForDisplay(pageview.result);
  const eq = toEquivalents(pageview.result.gramsCO2e);

  const config: DiagnosticsConfig = {
    expectsApiTracking: true,
    expectsAiTracking: false,
    hostingProvider: "vercel",
    region: "fra1",
    greenHosting: true
  };

  const recentEvents: AnyEvent[] = [
    { type: "web.pageview", input: { route: "/carbon-test", bytesTransferred: 1_200_000 } }
  ];

  const report = diagnose(config, recentEvents);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>Raw estimate: {pageview.result.gramsCO2e} gCO2e</p>
      <p>Rounded display: {display.gramsPerViewRounded} gCO2e</p>
      <p>Category: {display.category}</p>
      <p>Equivalents: {eq.trainKmDisplay}, {eq.phoneChargesDisplay}</p>
      <p>Diagnostics summary: web={report.webPageviews.status}, api={report.webApiCalls.status}</p>
    </main>
  );
}
```

## Tooling notes

**Installation and package manager compatibility:**

- carbone-cost has been validated in fresh npm-only and pnpm monorepo setups
- `pnpm` users: if a newly scaffolded app includes an auto-generated `pnpm-workspace.yaml` with empty or invalid `packages` field, installation may fail due to workspace tooling—not due to carbone-cost itself
- If you encounter workspace resolution errors, inspect your `pnpm-workspace.yaml` and ensure it correctly lists your package directories or remove it if your app is not a monorepo
- Avoid mixing multiple package managers in the same repository unless you have an explicit workspace configuration

## Framework adapters

### Browser SDK

```ts
import { createCarbonBrowserSdk } from "@clemsrec/browser";

const carbon = createCarbonBrowserSdk({
  endpoint: "/api/carbon",
  useBeacon: true,
  defaultGreenHosting: "unknown"
});

carbon.trackPageview({
  bytesTransferred: 1823400,
  route: "/home"
});
```

### Next.js adapter (App Router)

```ts
// app/api/carbon/route.ts
import { createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon({
  // Called once per accepted event. This is where you persist or forward it —
  // collectHandler validates the payload but stores nothing by itself.
  onEvent: async (event) => {
    await saveToYourStore(event);
  }
});

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}
```

`collectHandler` responds `405` to non-POST, `429` when `rateLimit` refuses,
`413` above `maxBodyBytes` (64 KB by default), `400` on malformed JSON or an
input that fails validation, `500` if your `onEvent` throws, and
`200 {"ok":true}` otherwise. It accepts both the `{ event }` envelope sent by the
browser SDK and a bare event object.

Since 0.4.0 it never trusts the client's numbers. The input is validated with a
strict schema (unknown fields, negative or absurd values and nested metadata are
refused), the result is **recomputed on the server** from that input, and the
event is dated on arrival. `onEvent` receives the recomputed event.

```ts
import { createMemoryRateLimiter, createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon({
  rateLimit: createMemoryRateLimiter({ limit: 60, windowMs: 60_000 }),
  onEvent: saveToYourStore
});
```

`createMemoryRateLimiter` counts in the memory of one process. On serverless
platforms each instance counts on its own: use a shared store or your platform's
firewall there, through the same `rateLimit` hook.

```ts
import { createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon();

export async function POST(request: Request) {
  const response = await fetch("https://api.openai.com/...", {
    method: "POST",
    body: await request.text()
  });

  const event = carbon.trackAIUsage({
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 1000,
    completionTokens: 450
  });

  await carbon.sendEvent(event);
  return response;
}
```

## Methodology disclaimer

Carbon Site Kit uses estimation models with explicit versioning:

- `web-estimation-v2`
- `ai-token-estimation-v2` (since 0.10.0; `v1` priced every token, read or
  generated, at an unsourced per-model factor)

### Web estimation

Web estimates apply the [Sustainable Web Design Model](https://sustainablewebdesign.org/estimating-digital-emissions/)
intensities per GB transferred, across three segments and both operational and
embodied energy:

| Segment | Operational | Embodied | Total |
| --- | --- | --- | --- |
| Data centre | 0.055 | 0.012 | 0.067 kWh/GB |
| Network | 0.059 | 0.013 | 0.072 kWh/GB |
| User device | 0.080 | 0.081 | 0.161 kWh/GB |

At the model's global average grid intensity of 494 gCO2e/kWh, that is about
**148 g of CO2e per GB**, or 0.148 g for a 1 MB page. `breakdown` returns each
segment separately so a published figure can be audited.

These inputs let you adapt it without forking:

```ts
trackPageview({
  route: "/pricing",
  bytesTransferred: 1_200_000,
  greenHostingFactor: 0.4,           // share of hosting on renewables, 0 to 1
  region: "FR",                      // hosting grid from the built-in table
  visitorRegion: "FR",               // visitor device grid
  gridIntensityGCO2ePerKWh: 56,      // or an explicit grid, which wins over region
  factorGPerGB: 360                  // or bypass the model entirely
});
```

Green hosting adjusts **data centre operational emissions only** — a renewable
host changes nothing about the network or the visitor's device. A fully green
host removes roughly 18% of the total, not half.

> **Versions before 0.6.0 used 0.5 g/GB**, a per-megabyte figure mislabelled as
> per-gigabyte. Web estimates from those versions understate emissions by more
> than two orders of magnitude and should be recomputed.

These helpers are intended for directional tracking, instrumentation, and reporting consistency over time. They are not a scientific truth machine and should not be interpreted as exact end-to-end infrastructure measurements.

## Release notes policy (required)

For every merged update:

1. Add a release note entry in `CHANGELOG.md`.
2. Update explanatory text in this `README.md` if behavior, API, or assumptions changed.
3. Keep examples and package READMEs aligned with the same PR.

## Roadmap

Phase 2+ (not included in this release):

- richer dashboards
- stronger provider adapters
- advanced reporting workflows
- Pro features and hosted workflows

## Contributing

See `CONTRIBUTING.md` and `RELEASING.md`.

## Community

- Issues: https://github.com/Clemsrec/carboncost/issues
- Discussions: https://github.com/Clemsrec/carboncost/discussions

## Contributors and developers

- Clément Tournier - Agence NuCom

## License

MIT

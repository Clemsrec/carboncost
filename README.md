# carbon-site-kit

Carbon Site Kit is a lightweight SDK for estimating the carbon impact of websites and AI-powered features. It is designed for developers, agencies, and product teams who want a practical way to instrument web delivery and token-based AI usage without adding heavy complexity.

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

- `carbone-cost`
- `@clemsrec/browser`
- `@clemsrec/script-tag`
- `@clemsrec/next`

## Installation

### npm / pnpm / yarn

```bash
npm install carbone-cost
```

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

```html
<script src="https://cdn.example.com/carbon-site-kit.min.js"></script>
<script>
  window.CarbonSiteKit.init({ endpoint: "/api/carbon" });
  window.CarbonSiteKit.trackPageview({ bytesTransferred: 1500000 });
</script>
```

## Quick start

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

### AI model factors

Token factors are resolved in three steps, and the `confidence` field on the
result tells you which one was used:

1. **Your own factor** — pass `factorGPer1kTokens` on the input to override
   everything. Reported as `benchmarked`.
2. **Known model** — an entry in the built-in table. Model names are normalized
   first, so `gpt-4o-mini-2024-07-18` resolves to the `gpt-4o-mini` factor.
   Reported as `benchmarked`.
3. **Size tier** — unknown models are bucketed by the size qualifier in their
   name (`mini`/`nano`/`haiku`/`flash` → small, `opus`/`pro`/`large`/`ultra` →
   large, otherwise medium). This is a naming heuristic, not a measurement, and
   is always reported as `estimated`.

Step 3 exists so that a model released after this package was published still
gets a sensible order of magnitude instead of one flat default. When accuracy
matters, supply your own factor:

```ts
const event = trackAIUsage({
  provider: "other",
  model: "in-house-llm",
  promptTokens: 1200,
  completionTokens: 400,
  factorGPer1kTokens: 0.31
});
```

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

`collectHandler` responds `405` to non-POST, `413` above `maxBodyBytes` (64 KB by
default), `400` on malformed JSON or an unsupported event type, `500` if your
`onEvent` throws, and `200 {"ok":true}` otherwise. It accepts both the
`{ event }` envelope sent by the browser SDK and a bare event object.

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
- `ai-token-estimation-v1`

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

Three inputs let you adapt it without forking:

```ts
trackPageview({
  route: "/pricing",
  bytesTransferred: 1_200_000,
  greenHostingFactor: 0.4,           // share of hosting on renewables, 0 to 1
  gridIntensityGCO2ePerKWh: 56,      // regional grid, for operational emissions
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

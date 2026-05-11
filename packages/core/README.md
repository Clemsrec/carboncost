# carbone-cost

Core estimation helpers and shared types.

## Includes

- shared types
- carbon result types
- methodology metadata object
- `trackPageview()`
- `trackAIUsage()`
- `aggregateEvents()`
- `formatForDisplay()`
- `toEquivalents()`
- `aggregateSession()`
- `diagnose()`
- `explain()`

## Install

```bash
pnpm add carbone-cost
```

## Example

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

const web = trackPageview({ route: "/", bytesTransferred: 850000 });
const ai = trackAIUsage({
  provider: "openai",
  model: "gpt-4o-mini",
  promptTokens: 600,
  completionTokens: 220
});

const summary = aggregateEvents([web, ai], { groupBy: "type" });
const display = formatForDisplay(web.result);
const session = aggregateSession([web]);
const equivalents = toEquivalents(session.totalGrams);
const details = explain();
```

## UI helpers

Use `formatForDisplay()` when you need a stable UI-oriented representation for badges, footers, or lightweight reporting cards.

```ts
import { formatForDisplay, trackPageview } from "carbone-cost";

const event = trackPageview({ route: "/carbon-test", bytesTransferred: 1200000 });
const display = formatForDisplay(event.result);

console.log(display.gramsPerViewRounded);
console.log(display.category);
```

Use `aggregateSession()` to combine several pageview events into a single session-level indicator.

```ts
import { aggregateSession, trackPageview } from "carbone-cost";

const session = aggregateSession([
  trackPageview({ route: "/", bytesTransferred: 900000 }),
  trackPageview({ route: "/pricing", bytesTransferred: 1300000 })
]);

console.log(session.totalGrams);
console.log(session.averageGramsPerView);
```

Use `toEquivalents()` for awareness-oriented comparisons in UI copy.

```ts
import { toEquivalents } from "carbone-cost";

const equivalents = toEquivalents(12.5);

console.log(equivalents.phoneCharges);
console.log(equivalents.phoneChargesDisplay);
console.log(equivalents.carKm);
console.log(equivalents.trainKm);
console.log(equivalents.trainKmDisplay);
console.log(equivalents.ledBulbHours);
console.log(equivalents.ledBulbHoursDisplay);
console.log(equivalents.laptopCharges);
console.log(equivalents.laptopChargesDisplay);
```

`toEquivalents()` returns both raw numeric values and UI-friendly display strings.

- Use raw fields (`phoneCharges`, `trainKm`, etc.) for custom formatting and localization.
- Use display fields (`phoneChargesDisplay`, `trainKmDisplay`, etc.) for quick UI output.

Display fields are approximate and intended for awareness, not formal LCA reporting.

```ts
const eq = toEquivalents(8.4);

console.log(eq.trainKmDisplay);
console.log(eq.phoneChargesDisplay);
```

## Coverage diagnostics

Use `diagnose()` to generate a transparent coverage view for what your integration currently measures.

```ts
import { diagnose, type DiagnosticsConfig, type AnyEvent } from "carbone-cost";

const config: DiagnosticsConfig = {
  expectsApiTracking: true,
  expectsAiTracking: false,
  hostingProvider: "vercel",
  region: "fra1",
  greenHosting: true
};

const recentEvents: AnyEvent[] = [
  { type: "web.pageview", input: { bytesTransferred: 1200000 } },
  { type: "web.pageview", input: { bytesTransferred: 980000 } }
];

const report = diagnose(config, recentEvents);
console.log(report.webPageviews.status);
console.log(report.clientDevice.notes);
```

The diagnostics report is high-level and intentionally explicit about missing or unknown dimensions.

## External consumer example (Next.js)

Use this when validating from a fresh app outside this monorepo.

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
  const equivalents = toEquivalents(pageview.result.gramsCO2e);

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

  const diagnostics = diagnose(config, recentEvents);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Carbon test</h1>
      <p>Raw estimate: {pageview.result.gramsCO2e} gCO2e</p>
      <p>Rounded display: {display.gramsPerViewRounded} gCO2e</p>
      <p>Category: {display.category}</p>
      <p>Equivalents: {equivalents.trainKmDisplay}, {equivalents.phoneChargesDisplay}</p>
      <p>Diagnostics summary: web={diagnostics.webPageviews.status}, api={diagnostics.webApiCalls.status}</p>
    </main>
  );
}
```

## Troubleshooting

If a fresh scaffold fails on `pnpm add` with a workspace error, check whether it generated a `pnpm-workspace.yaml` with an empty or invalid `packages` field. This is scaffold configuration behavior and unrelated to `carbone-cost` itself.

## Methodology

- `web-estimation-v1`
- `ai-token-estimation-v1`

This package provides estimation helpers for instrumentation, not exact physical emissions.

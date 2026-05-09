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
console.log(equivalents.carKm);
console.log(equivalents.trainKm);
console.log(equivalents.ledBulbHours);
console.log(equivalents.laptopCharges);
```

Equivalents are approximate and intended for communication, not detailed life-cycle assessment.

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

## Methodology

- `web-estimation-v1`
- `ai-token-estimation-v1`

This package provides estimation helpers for instrumentation, not exact physical emissions.

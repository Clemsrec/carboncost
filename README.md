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
pnpm add carbone-cost @clemsrec/browser @clemsrec/next
```

Or install only what you need:

```bash
pnpm add carbone-cost
```

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
- `toEquivalents()` maps grams CO2e to approximate human-readable comparisons such as phone charges and car distance.

These helpers are intended for awareness and reporting consistency. They do not change the underlying estimation formulas.

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
import { createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon({ endpoint: "/api/carbon" });

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}
```

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

- `web-estimation-v1`
- `ai-token-estimation-v1`

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

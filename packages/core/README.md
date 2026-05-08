# @carbon-site-kit/core

Core estimation helpers and shared types.

## Includes

- shared types
- carbon result types
- methodology metadata object
- `trackPageview()`
- `trackAIUsage()`
- `aggregateEvents()`
- `explain()`

## Install

```bash
pnpm add @carbon-site-kit/core
```

## Example

```ts
import { trackPageview, trackAIUsage, aggregateEvents, explain } from "@carbon-site-kit/core";

const web = trackPageview({ route: "/", bytesTransferred: 850000 });
const ai = trackAIUsage({
  provider: "openai",
  model: "gpt-4o-mini",
  promptTokens: 600,
  completionTokens: 220
});

const summary = aggregateEvents([web, ai], { groupBy: "type" });
const details = explain();
```

## Methodology

- `web-estimation-v1`
- `ai-token-estimation-v1`

This package provides estimation helpers for instrumentation, not exact physical emissions.

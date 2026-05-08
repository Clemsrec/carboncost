# @carbon-site-kit/next

Practical Next.js adapter for API/route handler integration.

## Install

```bash
pnpm add @carbon-site-kit/next
```

## App Router example

```ts
// app/api/carbon/route.ts
import { createNextCarbon } from "@carbon-site-kit/next";

const carbon = createNextCarbon({ endpoint: "https://example.com/carbon" });

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}
```

## AI usage example

```ts
import { createNextCarbon } from "@carbon-site-kit/next";

const carbon = createNextCarbon();

const event = carbon.trackAIUsage({
  provider: "openai",
  model: "gpt-4o",
  promptTokens: 1100,
  completionTokens: 500
});

await carbon.sendEvent(event);
```

# @clemsrec/next

Practical Next.js adapter for API/route handler integration.

## Install

```bash
pnpm add @clemsrec/next
```

## App Router example

```ts
// app/api/carbon/route.ts
import { createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon({ endpoint: "https://example.com/carbon" });

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}
```

## AI usage example

```ts
import { createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon();

const event = carbon.trackAIUsage({
  provider: "openai",
  model: "gpt-4o",
  promptTokens: 1100,
  completionTokens: 500
});

await carbon.sendEvent(event);
```

## What `collectHandler` accepts

The posted input is validated with a strict schema (`collectedEventSchema`,
exported): unknown fields, negative or absurd values and nested metadata are
answered with `400`. The result sent by the client is ignored and recomputed on
the server, and the event is dated on arrival, so `onEvent` only ever sees
numbers this package computed.

Pass `rateLimit` to answer `429` before the body is read.
`createMemoryRateLimiter()` counts in one process's memory; on serverless
platforms, plug a shared store into the same hook instead.

```ts
import { createMemoryRateLimiter, createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon({
  rateLimit: createMemoryRateLimiter({ limit: 60, windowMs: 60_000 }),
  onEvent: async (event) => saveToYourStore(event)
});
```

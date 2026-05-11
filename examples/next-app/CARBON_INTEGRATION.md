# Carbon Integration Guide (Next.js Example)

This example demonstrates a real-world integration of carbone-cost v0.4.1 in a Next.js 14+ App Router project.

## What is included

- **Home page** (`app/page.tsx`): displays current session carbon estimate and equivalent comparisons
- **Collection endpoint** (`app/api/carbon/route.ts`): captures pageview events from page navigation
- **AI tracking endpoint** (`app/api/chat/route.ts`): example endpoint for AI usage tracking
- **Event store** (`lib/carbon-events.ts`): in-memory FIFO buffer (100 events) for recent event history
- **Diagnostics page** (`app/carbon-diagnostics/page.tsx`): coverage report showing covered/partial/missing dimensions
- **Root layout** (`app/layout.tsx`): wraps the app with footer link to diagnostics

## Enable features

### Basic: Enable diagnostics page

```bash
NEXT_PUBLIC_CARBON_DIAGNOSTICS_ENABLED=true
```

### Hosting metadata (optional)

```bash
NEXT_PUBLIC_CARBON_HOSTING_PROVIDER=vercel
NEXT_PUBLIC_CARBON_REGION=fra1
NEXT_PUBLIC_CARBON_GREEN_HOSTING=true
```

Optional metadata for hosting diagnostics:

```bash
NEXT_PUBLIC_CARBON_HOSTING_PROVIDER=vercel
NEXT_PUBLIC_CARBON_REGION=fra1
NEXT_PUBLIC_CARBON_GREEN_HOSTING=true
```

Optional metadata for hosting diagnostics:

```bash
NEXT_PUBLIC_CARBON_HOSTING_PROVIDER=vercel
NEXT_PUBLIC_CARBON_REGION=fra1
NEXT_PUBLIC_CARBON_GREEN_HOSTING=true
```

### Hardening (optional)

Add server-side secret protection to `/carbon-diagnostics`:

```bash
CARBON_DIAGNOSTICS_SECRET=replace-with-long-random-value
```

When set, the page requires `?key=<secret>`:

```
http://localhost:3000/carbon-diagnostics?key=replace-with-long-random-value
```

## What is currently covered / partial / missing

### Covered
- **Web pageviews**: tracked when the home page loads (one pageview captured)

### Partial
- **Web API calls**: example endpoint exists but not actively called on page load
- **AI inference**: example endpoint exists but not actively called on page load
- **Hosting info**: metadata collected via environment variables if set; otherwise partial

### Missing
- **Client device**: not instrumented

This is a realistic demo state showing partial coverage. A production integration would wire more hooks to cover additional dimensions.

## How to extend

1. **Add more pageview tracking**: instrument other routes by calling `trackPageview()` and sending to `/api/carbon`
2. **Wire real API tracking**: if your app has internal API routes, add carbon events
3. **Wire real AI tracking**: if your app calls LLMs, add tracking to those routes
4. **Replace event store**: move from in-memory `lib/carbon-events.ts` to Redis or database for persistence
5. **Add custom styling**: adapt the session display component to your design system

## Recent events source

The `app/carbon-diagnostics` page uses an in-memory buffer implemented in `lib/carbon-events.ts`:

- `app/api/carbon/route.ts` appends valid inbound events from collection requests.
- `app/api/chat/route.ts` appends generated AI usage events.

The diagnostics report is computed via `diagnose(config, recentEvents)` from `carbone-cost` and summarizes:

- `webPageviews`
- `webApiCalls`
- `aiInference`
- `hostingInfo`
- `clientDevice`

## Production migration

For production:

1. **Replace in-memory store** with a proper persistence layer (Redis, database, analytics stream).
2. **Add real event capture** to all relevant routes (pageviews, API calls, AI usage).
3. **Secure the diagnostics page** with internal authentication or network isolation.
4. **Set hosting metadata** correctly for your deployment platform.
5. **Monitor diagnostics** to ensure all expected dimensions are being captured.

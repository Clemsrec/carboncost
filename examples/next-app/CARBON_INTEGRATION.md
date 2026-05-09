# Carbon Integration Notes (Next.js)

This example now includes a diagnostics page at `/carbon-diagnostics`.

## Enable diagnostics page

Set the environment variable below in your Next.js app:

```bash
NEXT_PUBLIC_CARBON_DIAGNOSTICS_ENABLED=true
```

Optional metadata for hosting diagnostics:

```bash
NEXT_PUBLIC_CARBON_HOSTING_PROVIDER=vercel
NEXT_PUBLIC_CARBON_REGION=fra1
NEXT_PUBLIC_CARBON_GREEN_HOSTING=true
```

Optional access hardening (server-only secret):

```bash
CARBON_DIAGNOSTICS_SECRET=replace-with-long-random-value
```

When this secret is set, `/carbon-diagnostics` requires `?key=<secret>`.

## Recent events source

The page uses an in-memory buffer implemented in `lib/carbon-events.ts`:

- `app/api/carbon/route.ts` appends valid inbound events from collection requests.
- `app/api/chat/route.ts` appends generated AI usage events.

The diagnostics report is computed via `diagnose(config, recentEvents)` from `carbone-cost` and summarizes:

- `webPageviews`
- `webApiCalls`
- `aiInference`
- `hostingInfo`
- `clientDevice`

## Production notes

- The in-memory buffer is intentionally minimal and process-local.
- For production, replace it with a persistent store (Redis, database, or analytics stream).
- Keep the diagnostics page behind feature flags and internal auth.
- If you keep the query-key approach, use a long random value and rotate it regularly.

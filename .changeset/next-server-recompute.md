---
"@clemsrec/next": minor
---

`collectHandler` no longer trusts the client. The input is validated with a strict zod schema, the result is recomputed on the server and the event is dated on arrival, so `onEvent` receives the recomputed event. Payloads with unknown fields, negative or out-of-range values, or nested metadata now get `400`. New `rateLimit` option (`429`) and `createMemoryRateLimiter()` for single-process servers.

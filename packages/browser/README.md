# @clemsrec/browser

Browser SDK for page-level estimation with optional network transport.

## Install

```bash
pnpm add @clemsrec/browser
```

## Usage

```ts
import { createCarbonBrowserSdk } from "@clemsrec/browser";

const sdk = createCarbonBrowserSdk({
  endpoint: "/api/carbon",
  useBeacon: true,
  defaultGreenHosting: "unknown"
});

sdk.trackPageview({
  route: "/docs",
  bytesTransferred: 1200000
});
```

## Notes

- zero runtime dependencies
- supports `navigator.sendBeacon` or `fetch`
- `bytesTransferred` can be provided manually

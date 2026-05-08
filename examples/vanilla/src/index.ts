import { createCarbonBrowserSdk } from "@carbon-site-kit/browser";
import { explain } from "@carbon-site-kit/core";

const sdk = createCarbonBrowserSdk({
  endpoint: "/api/carbon",
  useBeacon: true,
  defaultGreenHosting: "unknown"
});

const event = sdk.trackPageview({
  route: "/vanilla-example",
  bytesTransferred: 1500000
});

console.log("Estimated grams CO2e:", event.result.gramsCO2e);
console.log("Methodology:", explain());

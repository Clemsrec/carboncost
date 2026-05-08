import { createCarbonBrowserSdk, type BrowserSdkConfig } from "@clemsrec/browser";
import { explain, trackAIUsage, type AIUsageInput } from "carbone-cost";

const sdkState: { sdk: ReturnType<typeof createCarbonBrowserSdk> | null } = {
  sdk: null
};

function init(config: BrowserSdkConfig = {}): void {
  sdkState.sdk = createCarbonBrowserSdk(config);
}

function trackPageview(options?: {
  bytesTransferred?: number;
  route?: string;
  url?: string;
  greenHosting?: boolean | "unknown";
}): ReturnType<ReturnType<typeof createCarbonBrowserSdk>["trackPageview"]> {
  if (!sdkState.sdk) {
    sdkState.sdk = createCarbonBrowserSdk();
  }

  return sdkState.sdk.trackPageview(options);
}

function trackAI(options: AIUsageInput) {
  return trackAIUsage(options);
}

export { init, trackPageview, explain };
export { trackAI as trackAIUsage };

import { trackPageview, type CarbonEvent, type WebPageviewInput } from "@carbon-site-kit/core";

export type BrowserSdkConfig = {
  endpoint?: string;
  useBeacon?: boolean;
  defaultGreenHosting?: boolean | "unknown";
  defaultRoute?: string;
};

export type TrackPageviewOptions = Omit<WebPageviewInput, "bytesTransferred"> & {
  bytesTransferred?: number;
};

export class CarbonBrowserSdk {
  private readonly config: BrowserSdkConfig;

  public constructor(config: BrowserSdkConfig = {}) {
    this.config = config;
  }

  public trackPageview(options: TrackPageviewOptions = {}): CarbonEvent {
    const bytesTransferred = options.bytesTransferred ?? 0;
    const route = options.route ?? this.config.defaultRoute ?? this.safePathname();
    const url = options.url ?? this.safeHref();

    const event = trackPageview({
      bytesTransferred,
      ...(route ? { route } : {}),
      ...(url ? { url } : {}),
      greenHosting: options.greenHosting ?? this.config.defaultGreenHosting ?? "unknown",
      ...(options.metadata ? { metadata: options.metadata } : {}),
      ...(options.timestamp ? { timestamp: options.timestamp } : {})
    });

    void this.send(event);
    return event;
  }

  public async send(event: CarbonEvent): Promise<void> {
    if (!this.config.endpoint) {
      return;
    }

    const payload = JSON.stringify({ event });

    if (
      this.config.useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      navigator.sendBeacon(this.config.endpoint, payload);
      return;
    }

    if (typeof fetch === "function") {
      await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: payload,
        keepalive: true
      });
    }
  }

  private safeHref(): string | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }

    return window.location.href;
  }

  private safePathname(): string | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }

    return window.location.pathname;
  }
}

export function createCarbonBrowserSdk(config: BrowserSdkConfig = {}): CarbonBrowserSdk {
  return new CarbonBrowserSdk(config);
}

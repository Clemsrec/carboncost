import { trackAIUsage, trackPageview, type AIUsageInput, type CarbonEvent } from "@carbon-site-kit/core";

export type NextCarbonConfig = {
  endpoint?: string;
  defaultGreenHosting?: boolean | "unknown";
};

export function createNextCarbon(config: NextCarbonConfig = {}) {
  async function sendEvent(event: CarbonEvent): Promise<void> {
    if (!config.endpoint) {
      return;
    }

    await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ event })
    });
  }

  return {
    trackRouteBytes(route: string, bytesTransferred: number): CarbonEvent {
      return trackPageview({
        route,
        bytesTransferred,
        greenHosting: config.defaultGreenHosting ?? "unknown"
      });
    },

    trackAIUsage(input: AIUsageInput): CarbonEvent {
      return trackAIUsage(input);
    },

    async collectHandler(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json" }
        });
      }

      const body = (await request.json()) as { event?: CarbonEvent };
      if (!body.event) {
        return new Response(JSON.stringify({ error: "Missing event payload" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    },

    sendEvent
  };
}

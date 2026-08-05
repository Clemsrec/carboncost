import { trackAIUsage, trackPageview, type AIUsageInput, type CarbonEvent } from "carbone-cost";

export type NextCarbonConfig = {
  endpoint?: string;
  defaultGreenHosting?: boolean | "unknown";
  /** Max accepted body size for `collectHandler`, in bytes. Defaults to 64 KB. */
  maxBodyBytes?: number;
  /** Called with each accepted event. Use it to persist, forward, or log. */
  onEvent?: (event: CarbonEvent) => void | Promise<void>;
};

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

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

    /**
     * Route handler for the collection endpoint. It validates the payload and
     * hands it to `config.onEvent`; it does not persist anything on its own.
     */
    async collectHandler(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const maxBodyBytes = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
      const declaredLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
        return jsonResponse({ error: "Payload too large" }, 413);
      }

      let raw: string;
      try {
        raw = await request.text();
      } catch {
        return jsonResponse({ error: "Unreadable request body" }, 400);
      }

      // content-length can be absent or lie under chunked encoding, so re-check
      // the real byte length. Deployments needing a hard streaming cap should
      // still enforce one at the platform edge.
      if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
        return jsonResponse({ error: "Payload too large" }, 413);
      }

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      // Accept both the `{ event }` envelope sent by the browser SDK and a bare
      // event posted by hand-rolled clients.
      const envelope = body as { event?: CarbonEvent } | null;
      const event = (envelope?.event ?? envelope) as CarbonEvent | undefined;

      if (!event || (event.type !== "web.pageview" && event.type !== "ai.usage")) {
        return jsonResponse({ error: "Missing or unsupported event payload" }, 400);
      }

      if (config.onEvent) {
        try {
          await config.onEvent(event);
        } catch {
          return jsonResponse({ error: "Event handler failed" }, 500);
        }
      }

      return jsonResponse({ ok: true }, 200);
    },

    sendEvent
  };
}

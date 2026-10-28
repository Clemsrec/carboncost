import { trackAIUsage, trackPageview, type AIUsageInput, type CarbonEvent } from "carbone-cost";

import { collectedEventSchema } from "./schema.js";

export { aiUsageInputSchema, collectedEventSchema, webPageviewInputSchema } from "./schema.js";

export type NextCarbonConfig = {
  endpoint?: string;
  defaultGreenHosting?: boolean | "unknown";
  /** Max accepted body size for `collectHandler`, in bytes. Defaults to 64 KB. */
  maxBodyBytes?: number;
  /**
   * Called with each accepted event, whose result the server has recomputed
   * from the input. Use it to persist, forward, or log.
   */
  onEvent?: (event: CarbonEvent) => void | Promise<void>;
  /**
   * Checked before the body is read. Return `false` to answer 429. See
   * `createMemoryRateLimiter` for a single-instance default.
   */
  rateLimit?: (request: Request) => boolean | Promise<boolean>;
};

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

/** Drops keys whose value is `undefined`, so parsed input fits exact optional types. */
function compact<T extends object>(value: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Defined<T>;
}

export interface MemoryRateLimiterOptions {
  /** Requests allowed per key and window. Defaults to 60. */
  limit?: number;
  /** Window length in milliseconds. Defaults to one minute. */
  windowMs?: number;
  /** Groups requests. Defaults to the first `x-forwarded-for` address. */
  key?: (request: Request) => string;
}

/**
 * Fixed-window limiter held in this process's memory. It protects a single
 * long-running server; on serverless platforms each instance counts on its own,
 * so use a shared store (Redis, the platform's firewall) there instead.
 */
export function createMemoryRateLimiter(
  options: MemoryRateLimiterOptions = {}
): (request: Request) => boolean {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60_000;
  const keyOf =
    options.key ??
    ((request: Request) =>
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous");
  const windows = new Map<string, { start: number; count: number }>();

  return (request) => {
    const now = Date.now();
    if (windows.size > 10_000) {
      for (const [key, window] of windows) {
        if (now - window.start >= windowMs) {
          windows.delete(key);
        }
      }
    }

    const key = keyOf(request);
    const window = windows.get(key);
    if (!window || now - window.start >= windowMs) {
      windows.set(key, { start: now, count: 1 });
      return true;
    }

    window.count += 1;
    return window.count <= limit;
  };
}

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

      if (config.rateLimit && !(await config.rateLimit(request))) {
        return jsonResponse({ error: "Too many requests" }, 429);
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
      const candidate =
        body !== null && typeof body === "object" && "event" in body
          ? (body as { event: unknown }).event
          : body;
      const parsed = collectedEventSchema.safeParse(candidate);

      if (!parsed.success) {
        return jsonResponse(
          {
            error: "Missing or unsupported event payload",
            issues: parsed.error.issues.map((issue) => issue.path.join(".") || "event")
          },
          400
        );
      }

      // Never trust a result computed by the client: recompute it from the
      // validated input, and date the event on arrival.
      const event: CarbonEvent =
        parsed.data.type === "web.pageview"
          ? trackPageview(compact({ ...parsed.data.input, timestamp: undefined }))
          : trackAIUsage(compact({ ...parsed.data.input, timestamp: undefined }));

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

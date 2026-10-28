export type MethodologyBoundary = "web-delivery" | "ai-inference";

export type MethodologyMetadata = {
  methodologyVersion: string;
  source: string;
  boundaries: MethodologyBoundary[];
  notes: string[];
  updatedAt: string;
};

export type CarbonResult = {
  gramsCO2e: number;
  methodology: MethodologyMetadata;
  confidence: "estimated" | "benchmarked" | "measured";
  assumptions: string[];
  breakdown?: Record<string, number>;
  /**
   * The same calculation at the low and high bounds of its sourced assumptions,
   * around the central `gramsCO2e`. Absent when the model publishes no bounds,
   * which is not the same as no uncertainty.
   */
  range?: CarbonRange;
};

export type CarbonRange = {
  low: number;
  high: number;
};

export type WebPageviewInput = {
  url?: string;
  route?: string;
  bytesTransferred: number;
  /**
   * Coarse green hosting signal. `true` maps to a green hosting factor of 1,
   * `false` and `"unknown"` to 0. Use `greenHostingFactor` for anything partial.
   */
  greenHosting?: boolean | "unknown";
  /**
   * Share of hosting powered by renewable or zero-carbon energy, from 0 to 1.
   * A provider on a 40% renewable grid is 0.4; one verified by the Green Web
   * Foundation is 1. Only data centre operational emissions are adjusted.
   */
  greenHostingFactor?: number;
  /**
   * Grid carbon intensity in gCO2e per kWh, for operational emissions. Defaults
   * to the global average. Embodied emissions always use the global average,
   * since hardware manufacturing spans global supply chains.
   */
  gridIntensityGCO2ePerKWh?: number;
  /**
   * Where the site is hosted, as an ISO 3166 alpha-2 code (`"FR"`), `"EU"` or
   * `"WORLD"`. Sets the grid for data centre and network operational emissions.
   * Ignored when `gridIntensityGCO2ePerKWh` is given; an unknown code keeps the
   * model default.
   */
  region?: string;
  /**
   * Where the visitor is, same codes as `region`. Sets the grid for the user
   * device segment only. Defaults to the hosting grid.
   */
  visitorRegion?: string;
  /**
   * Optional override, in grams of CO2e per GB transferred. Bypasses the model
   * entirely. Use it when you have an intensity you trust more than the default.
   */
  factorGPerGB?: number;
  /**
   * Number of resources whose size could not be measured — typically opaque
   * cross-origin responses without `Timing-Allow-Origin`, which report a
   * `transferSize` of 0. Declaring them keeps the estimate an explicit
   * undercount instead of a silent one: they are excluded from the total and
   * surfaced by `diagnose()`.
   */
  unknownRequests?: number;
  /**
   * Origins behind `unknownRequests`, deduplicated. Lets a UI say "Firestore and
   * Algolia are not counted" rather than "4 requests are not counted", which is
   * the difference between a caveat a visitor can act on and one they cannot.
   */
  unknownOrigins?: string[];
  /**
   * Requests served from cache. Kept separate from `bytesTransferred` so that a
   * genuinely light page and a fully cached one stay distinguishable.
   *
   * Browsers disagree here: Chrome reports a flat ~300 bytes per cached resource
   * rather than 0, so cached bytes are counted as reported and surfaced rather
   * than silently subtracted. Subtracting a hardcoded constant would turn a
   * browser quirk into an invented number the moment Chrome changes it.
   */
  cachedRequests?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export type AIUsageInput = {
  provider: "openai" | "anthropic" | "google" | "mistral" | "other";
  model: string;
  promptTokens: number;
  completionTokens: number;
  /**
   * Part of `promptTokens` served from the provider's prefix cache, as OpenAI
   * reports it in `cached_tokens`. Not added to `promptTokens`.
   */
  cachedTokens?: number;
  /**
   * Where the request is computed: ISO 3166 alpha-2 code, `"EU"` or `"WORLD"`.
   * Defaults to the provider's main region; an unknown code counts at the world
   * average, never at the cleanest grid.
   */
  region?: string;
  /** Grid intensity in gCO2e per kWh. Wins over `region`. */
  gridIntensityGCO2ePerKWh?: number;
  /** Server energy per 1,000 generated tokens, before PUE, when you know the model better. */
  whPer1kOutputTokens?: number;
  /** Data centre power usage effectiveness, when the provider publishes it (1 to 3). */
  pue?: number;
  /**
   * Optional override, in grams of CO2e per 1,000 tokens, read and generated
   * alike. Bypasses the energy model entirely and is reported as `benchmarked`.
   */
  factorGPer1kTokens?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export type CarbonEvent =
  | {
      type: "web.pageview";
      input: WebPageviewInput;
      result: CarbonResult;
      timestamp: string;
    }
  | {
      type: "ai.usage";
      input: AIUsageInput;
      result: CarbonResult;
      timestamp: string;
    };

export type WebPageviewEvent = Extract<CarbonEvent, { type: "web.pageview" }>;
export type AIUsageEvent = Extract<CarbonEvent, { type: "ai.usage" }>;

export type AggregateOptions = {
  groupBy?: "type" | "route" | "model";
};

export type AggregateBucket = {
  key: string;
  gramsCO2e: number;
  events: number;
  /** Sum of the events' bounds; an event without bounds counts at its central value. */
  range?: CarbonRange;
};

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
   * Optional override, in grams of CO2e per GB transferred. Bypasses the model
   * entirely. Use it when you have an intensity you trust more than the default.
   */
  factorGPerGB?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export type AIUsageInput = {
  provider: "openai" | "anthropic" | "google" | "mistral" | "other";
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  /**
   * Optional override, in grams of CO2e per 1,000 tokens. Use it when you have a
   * factor you trust more than the built-in ones (provider disclosure, internal
   * measurement, a research paper). It bypasses model lookup entirely.
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
};

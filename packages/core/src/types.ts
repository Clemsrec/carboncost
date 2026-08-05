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
  greenHosting?: boolean | "unknown";
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

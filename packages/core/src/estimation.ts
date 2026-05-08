import { AI_METHODOLOGY, WEB_METHODOLOGY } from "./methodology.js";
import type {
  AIUsageInput,
  AIUsageEvent,
  AggregateBucket,
  AggregateOptions,
  CarbonEvent,
  CarbonResult,
  MethodologyMetadata,
  WebPageviewEvent,
  WebPageviewInput
} from "./types.js";

const WEB_GRAMS_PER_GB = 0.5;

const AI_MODEL_FACTORS_G_PER_1K_TOKENS: Record<string, number> = {
  "openai:gpt-4o": 0.42,
  "openai:gpt-4o-mini": 0.09,
  "anthropic:claude-3-5-sonnet": 0.18,
  "google:gemini-1.5-pro": 0.35,
  "mistral:mistral-large": 0.25
};

const AI_DEFAULT_FACTOR_G_PER_1K_TOKENS = 0.2;

function round(value: number, precision = 6): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function estimateWeb(input: WebPageviewInput): CarbonResult {
  const bytes = Math.max(0, input.bytesTransferred);
  const gigaBytes = bytes / (1024 * 1024 * 1024);

  const greenMultiplier =
    input.greenHosting === true ? 0.5 : input.greenHosting === false ? 1 : 1;

  const gramsCO2e = round(gigaBytes * WEB_GRAMS_PER_GB * greenMultiplier);

  return {
    gramsCO2e,
    methodology: WEB_METHODOLOGY,
    confidence: input.greenHosting === "unknown" ? "estimated" : "benchmarked",
    assumptions: [
      "Uses a fixed grams-per-GB coefficient for web delivery.",
      "Uses optional green hosting adjustment when provided."
    ],
    breakdown: {
      bytesTransferred: bytes,
      gigaBytes,
      gramsPerGB: WEB_GRAMS_PER_GB,
      greenMultiplier
    }
  };
}

export function estimateAI(input: AIUsageInput): CarbonResult {
  const promptTokens = Math.max(0, input.promptTokens);
  const completionTokens = Math.max(0, input.completionTokens);
  const cachedTokens = Math.max(0, input.cachedTokens ?? 0);

  const totalTokens = promptTokens + completionTokens;
  const uncachedTokens = Math.max(0, totalTokens - cachedTokens);

  const key = `${input.provider}:${input.model}`;
  const factor = AI_MODEL_FACTORS_G_PER_1K_TOKENS[key] ?? AI_DEFAULT_FACTOR_G_PER_1K_TOKENS;

  const gramsUncached = (uncachedTokens / 1000) * factor;
  const gramsCached = (cachedTokens / 1000) * factor * 0.1;
  const gramsCO2e = round(gramsUncached + gramsCached);

  return {
    gramsCO2e,
    methodology: AI_METHODOLOGY,
    confidence: AI_MODEL_FACTORS_G_PER_1K_TOKENS[key] ? "benchmarked" : "estimated",
    assumptions: [
      "Uses model token factor in grams per 1k tokens.",
      "Cached tokens use a reduced factor (10% of uncached)."
    ],
    breakdown: {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens,
      factorGPer1kTokens: factor,
      gramsUncached,
      gramsCached
    }
  };
}

export function trackPageview(input: WebPageviewInput): WebPageviewEvent {
  return {
    type: "web.pageview",
    input,
    result: estimateWeb(input),
    timestamp: input.timestamp ?? new Date().toISOString()
  };
}

export function trackAIUsage(input: AIUsageInput): AIUsageEvent {
  return {
    type: "ai.usage",
    input,
    result: estimateAI(input),
    timestamp: input.timestamp ?? new Date().toISOString()
  };
}

export function aggregateEvents(
  events: CarbonEvent[],
  options: AggregateOptions = {}
): { totalGramsCO2e: number; totalEvents: number; buckets: AggregateBucket[] } {
  const bucketMap = new Map<string, AggregateBucket>();

  for (const event of events) {
    let key: string = event.type;

    if (options.groupBy === "route" && event.type === "web.pageview") {
      key = event.input.route ?? "unknown-route";
    }

    if (options.groupBy === "model" && event.type === "ai.usage") {
      key = event.input.model;
    }

    const current = bucketMap.get(key);
    if (!current) {
      bucketMap.set(key, {
        key,
        gramsCO2e: event.result.gramsCO2e,
        events: 1
      });
      continue;
    }

    current.gramsCO2e += event.result.gramsCO2e;
    current.events += 1;
  }

  const buckets = [...bucketMap.values()].map((bucket) => ({
    ...bucket,
    gramsCO2e: round(bucket.gramsCO2e)
  }));

  return {
    totalGramsCO2e: round(events.reduce((sum, event) => sum + event.result.gramsCO2e, 0)),
    totalEvents: events.length,
    buckets
  };
}

export function explain(
  metadata?: MethodologyMetadata
): { methodology: MethodologyMetadata[]; assumptions: string[] } {
  if (metadata) {
    return {
      methodology: [metadata],
      assumptions: [
        "This SDK provides estimation helpers, not exact physical measurements.",
        "Inputs quality directly affects estimate quality.",
        "Methodology versions should be tracked over time."
      ]
    };
  }

  return {
    methodology: [WEB_METHODOLOGY, AI_METHODOLOGY],
    assumptions: [
      "Web estimation is based on transferred bytes and fixed coefficients.",
      "AI estimation is based on token activity and model factors.",
      "Results are directional estimates for instrumentation and reporting."
    ]
  };
}

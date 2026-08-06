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

/**
 * Sustainable Web Design Model energy intensities, in kWh per GB transferred,
 * split by system segment and by operational vs embodied energy.
 *
 * Source: https://sustainablewebdesign.org/estimating-digital-emissions/
 *
 * Totals 0.300 kWh/GB, which at the global average grid intensity works out to
 * roughly 148 gCO2e per GB. Earlier versions of this package used 0.5 g/GB —
 * a per-megabyte figure mislabelled as per-gigabyte, understating every web
 * estimate by more than two orders of magnitude.
 */
const SWD_ENERGY_KWH_PER_GB = {
  dataCenter: { operational: 0.055, embodied: 0.012 },
  network: { operational: 0.059, embodied: 0.013 },
  userDevice: { operational: 0.08, embodied: 0.081 }
} as const;

/** Global average grid intensity in gCO2e per kWh (Ember, via the SWD model). */
const GLOBAL_GRID_INTENSITY_G_PER_KWH = 494;

/** Data transfer is measured in decimal gigabytes, as the model intends. */
const BYTES_PER_GB = 1_000_000_000;

/**
 * Known per-model factors, in grams of CO2e per 1,000 tokens.
 *
 * Keys are `provider:model` after normalization (lowercase, trailing version or
 * date suffix removed), so `gpt-4o-mini-2024-07-18` resolves to `openai:gpt-4o-mini`.
 * A hit here is reported with confidence `benchmarked`.
 */
const AI_MODEL_FACTORS_G_PER_1K_TOKENS: Record<string, number> = {
  "openai:gpt-4o": 0.42,
  "openai:gpt-4o-mini": 0.09,
  "anthropic:claude-3-5-sonnet": 0.18,
  "google:gemini-1.5-pro": 0.35,
  "mistral:mistral-large": 0.25
};

/**
 * Size-class fallback for models absent from the table above.
 *
 * Model names go stale fast, so instead of a hardcoded list that rots, unknown
 * models are bucketed by the size qualifier vendors put in the name. This is a
 * naming-convention heuristic, not a measurement: results are always reported
 * with confidence `estimated`.
 */
export type AIModelTier = "small" | "medium" | "large";

const AI_TIER_FACTORS_G_PER_1K_TOKENS: Record<AIModelTier, number> = {
  small: 0.09,
  medium: 0.2,
  large: 0.42
};

const SMALL_TIER_HINTS = new Set(["mini", "nano", "small", "lite", "haiku", "flash", "tiny"]);
const LARGE_TIER_HINTS = new Set(["opus", "ultra", "large", "pro", "max", "heavy"]);

function round(value: number, precision = 6): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

/**
 * Strips casing plus trailing date/version suffixes: `-2024-08-06`, `-20250514`,
 * `@2.1`, `:v3`. Keeps the family name that the factor table is keyed on.
 */
function normalizeModelName(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/[@:]v?[\d.]+$/, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")
    .replace(/-\d{6,8}$/, "")
    .replace(/-latest$/, "");
}

export function resolveModelTier(model: string): AIModelTier {
  // Match whole segments, never substrings: "gemini" contains "mini" but is not
  // a small model.
  const segments = normalizeModelName(model).split(/[^a-z0-9]+/).filter(Boolean);

  if (segments.some((segment) => SMALL_TIER_HINTS.has(segment))) {
    return "small";
  }

  if (segments.some((segment) => LARGE_TIER_HINTS.has(segment))) {
    return "large";
  }

  return "medium";
}

type ResolvedFactor = {
  factor: number;
  confidence: CarbonResult["confidence"];
  source: "override" | "model-table" | "size-tier";
  tier?: AIModelTier;
};

function resolveAIFactor(input: AIUsageInput): ResolvedFactor {
  if (typeof input.factorGPer1kTokens === "number" && input.factorGPer1kTokens >= 0) {
    return {
      factor: input.factorGPer1kTokens,
      confidence: "benchmarked",
      source: "override"
    };
  }

  const key = `${input.provider}:${normalizeModelName(input.model)}`;
  const known = AI_MODEL_FACTORS_G_PER_1K_TOKENS[key];

  if (known !== undefined) {
    return { factor: known, confidence: "benchmarked", source: "model-table" };
  }

  const tier = resolveModelTier(input.model);

  return {
    factor: AI_TIER_FACTORS_G_PER_1K_TOKENS[tier],
    confidence: "estimated",
    source: "size-tier",
    tier
  };
}

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolves the share of hosting running on renewable energy. An explicit
 * numeric factor wins; otherwise the coarse boolean maps to 1 or 0. Neither
 * `"unknown"` nor an omitted field counts as a signal.
 */
function resolveGreenHostingFactor(input: WebPageviewInput): {
  factor: number;
  declared: boolean;
} {
  if (typeof input.greenHostingFactor === "number") {
    return { factor: clampUnitInterval(input.greenHostingFactor), declared: true };
  }

  if (typeof input.greenHosting === "boolean") {
    return { factor: input.greenHosting ? 1 : 0, declared: true };
  }

  return { factor: 0, declared: false };
}

export function estimateWeb(input: WebPageviewInput): CarbonResult {
  const bytes = Math.max(0, input.bytesTransferred);
  const gigaBytes = bytes / BYTES_PER_GB;

  if (typeof input.factorGPerGB === "number" && input.factorGPerGB >= 0) {
    return {
      gramsCO2e: round(gigaBytes * input.factorGPerGB),
      methodology: WEB_METHODOLOGY,
      confidence: "benchmarked",
      assumptions: ["Uses the caller-supplied intensity in grams of CO2e per GB."],
      breakdown: {
        bytesTransferred: bytes,
        gigaBytes,
        effectiveGramsPerGB: input.factorGPerGB
      }
    };
  }

  const gridIntensity = input.gridIntensityGCO2ePerKWh ?? GLOBAL_GRID_INTENSITY_G_PER_KWH;
  const green = resolveGreenHostingFactor(input);

  // Green hosting reduces data centre operational emissions only. Nothing about
  // a renewable-powered host changes what the network or the visitor's device
  // burns, and embodied emissions keep the global average either way.
  const dataCenterGrams =
    gigaBytes *
    (SWD_ENERGY_KWH_PER_GB.dataCenter.operational * gridIntensity * (1 - green.factor) +
      SWD_ENERGY_KWH_PER_GB.dataCenter.embodied * GLOBAL_GRID_INTENSITY_G_PER_KWH);

  const networkGrams =
    gigaBytes *
    (SWD_ENERGY_KWH_PER_GB.network.operational * gridIntensity +
      SWD_ENERGY_KWH_PER_GB.network.embodied * GLOBAL_GRID_INTENSITY_G_PER_KWH);

  const userDeviceGrams =
    gigaBytes *
    (SWD_ENERGY_KWH_PER_GB.userDevice.operational * gridIntensity +
      SWD_ENERGY_KWH_PER_GB.userDevice.embodied * GLOBAL_GRID_INTENSITY_G_PER_KWH);

  const gramsCO2e = round(dataCenterGrams + networkGrams + userDeviceGrams);

  return {
    gramsCO2e,
    methodology: WEB_METHODOLOGY,
    confidence: green.declared ? "benchmarked" : "estimated",
    assumptions: [
      "Applies Sustainable Web Design Model intensities per GB transferred, across data centre, network and user device.",
      "Includes both operational and embodied energy.",
      green.declared
        ? "Green hosting adjusts data centre operational emissions only."
        : "No hosting signal provided, so no green hosting adjustment was applied."
    ],
    breakdown: {
      bytesTransferred: bytes,
      gigaBytes,
      gridIntensityGCO2ePerKWh: gridIntensity,
      greenHostingFactor: green.factor,
      dataCenterGrams: round(dataCenterGrams),
      networkGrams: round(networkGrams),
      userDeviceGrams: round(userDeviceGrams),
      effectiveGramsPerGB: gigaBytes > 0 ? round(gramsCO2e / gigaBytes, 3) : 0
    }
  };
}

export function estimateAI(input: AIUsageInput): CarbonResult {
  const promptTokens = Math.max(0, input.promptTokens);
  const completionTokens = Math.max(0, input.completionTokens);
  const cachedTokens = Math.max(0, input.cachedTokens ?? 0);

  const totalTokens = promptTokens + completionTokens;
  const uncachedTokens = Math.max(0, totalTokens - cachedTokens);

  const resolved = resolveAIFactor(input);
  const factor = resolved.factor;

  const gramsUncached = (uncachedTokens / 1000) * factor;
  const gramsCached = (cachedTokens / 1000) * factor * 0.1;
  const gramsCO2e = round(gramsUncached + gramsCached);

  const factorAssumption =
    resolved.source === "override"
      ? "Uses the caller-supplied token factor in grams per 1k tokens."
      : resolved.source === "model-table"
        ? "Uses a known per-model token factor in grams per 1k tokens."
        : `Model is unknown, so a ${resolved.tier} size-tier factor was applied as a fallback.`;

  return {
    gramsCO2e,
    methodology: AI_METHODOLOGY,
    confidence: resolved.confidence,
    assumptions: [
      factorAssumption,
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

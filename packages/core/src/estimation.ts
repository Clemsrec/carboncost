import {
  AI_ENERGY_FACTORS,
  AI_PROVIDER_DEFAULT_REGION,
  gridIntensityForRegion,
  type AIEnergyFactors
} from "./factors.js";
import { AI_METHODOLOGY, WEB_METHODOLOGY } from "./methodology.js";
import { sumRanges } from "./range.js";
import type {
  AIUsageInput,
  AIUsageEvent,
  AggregateBucket,
  AggregateOptions,
  CarbonEvent,
  CarbonRange,
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
 * Size class read from a model name. A naming-convention heuristic, not a
 * measurement; the energy model does not use it, since only frontier-class chat
 * models have a sourced factor and the range already spans the others.
 */
export type AIModelTier = "small" | "medium" | "large";

const SMALL_TIER_HINTS = new Set(["mini", "nano", "small", "lite", "haiku", "flash", "tiny"]);
const LARGE_TIER_HINTS = new Set(["opus", "ultra", "large", "pro", "max", "heavy"]);

function round(value: number, precision = 6): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

/**
 * Strips casing plus trailing date/version suffixes: `-2024-08-06`, `-20250514`,
 * `@2.1`, `:v3`. Keeps the family name.
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

  const regionIntensity = input.region === undefined ? undefined : gridIntensityForRegion(input.region);
  const gridIntensity =
    input.gridIntensityGCO2ePerKWh ?? regionIntensity ?? GLOBAL_GRID_INTENSITY_G_PER_KWH;
  const visitorIntensity =
    input.visitorRegion === undefined ? undefined : gridIntensityForRegion(input.visitorRegion);
  const deviceGridIntensity = visitorIntensity ?? gridIntensity;
  const green = resolveGreenHostingFactor(input);
  const unknownRegions = [input.region, input.visitorRegion].filter(
    (code): code is string => code !== undefined && gridIntensityForRegion(code) === undefined
  );

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
    (SWD_ENERGY_KWH_PER_GB.userDevice.operational * deviceGridIntensity +
      SWD_ENERGY_KWH_PER_GB.userDevice.embodied * GLOBAL_GRID_INTENSITY_G_PER_KWH);

  const gramsCO2e = round(dataCenterGrams + networkGrams + userDeviceGrams);
  const unknownRequests = Math.max(0, input.unknownRequests ?? 0);

  return {
    gramsCO2e,
    methodology: WEB_METHODOLOGY,
    // Unmeasured requests make the total a known undercount, whatever else we know.
    confidence: unknownRequests > 0 ? "estimated" : green.declared ? "benchmarked" : "estimated",
    assumptions: [
      "Applies Sustainable Web Design Model intensities per GB transferred, across data centre, network and user device.",
      "Includes both operational and embodied energy.",
      green.declared
        ? "Green hosting adjusts data centre operational emissions only."
        : "No hosting signal provided, so no green hosting adjustment was applied.",
      ...(unknownRequests > 0
        ? [`${unknownRequests} requests could not be measured and are excluded, so this is a floor.`]
        : []),
      ...(unknownRegions.length > 0
        ? [`Unknown region code ${unknownRegions.join(", ")}, so the default grid was kept.`]
        : [])
    ],
    breakdown: {
      unknownRequests,
      bytesTransferred: bytes,
      gigaBytes,
      gridIntensityGCO2ePerKWh: gridIntensity,
      deviceGridIntensityGCO2ePerKWh: deviceGridIntensity,
      greenHostingFactor: green.factor,
      dataCenterGrams: round(dataCenterGrams),
      networkGrams: round(networkGrams),
      userDeviceGrams: round(userDeviceGrams),
      effectiveGramsPerGB: gigaBytes > 0 ? round(gramsCO2e / gigaBytes, 3) : 0
    }
  };
}


/** Inference energy and carbon for one set of factors, before rounding. */
function computeAI(
  tokens: { output: number; uncachedInput: number; cachedInput: number },
  factors: AIEnergyFactors,
  gridIntensity: number
): { computeEquivalentTokens: number; energyWh: number; operationalGrams: number; embodiedGrams: number } {
  const computeEquivalentTokens =
    tokens.output +
    factors.inputTokenEnergyRatio *
      (tokens.uncachedInput + factors.cacheReadCostRatio * tokens.cachedInput);
  const energyWh = factors.pue * factors.whPer1kOutputTokens * (computeEquivalentTokens / 1000);
  const operationalGrams = (energyWh / 1000) * gridIntensity;
  const embodiedGrams = factors.embodiedGPer1kTokens * (computeEquivalentTokens / 1000);
  return { computeEquivalentTokens, energyWh, operationalGrams, embodiedGrams };
}

function resolveAIGrid(input: AIUsageInput): { intensity: number; region: string; declared: boolean } {
  if (typeof input.gridIntensityGCO2ePerKWh === "number" && input.gridIntensityGCO2ePerKWh >= 0) {
    return { intensity: input.gridIntensityGCO2ePerKWh, region: "custom", declared: true };
  }

  const region = (input.region ?? AI_PROVIDER_DEFAULT_REGION[input.provider] ?? "WORLD")
    .trim()
    .toUpperCase();
  const known = gridIntensityForRegion(region);

  return known === undefined
    ? { intensity: gridIntensityForRegion("WORLD") ?? 458, region: "WORLD", declared: false }
    : { intensity: known, region, declared: input.region !== undefined };
}

export function estimateAI(input: AIUsageInput): CarbonResult {
  const promptTokens = Math.max(0, input.promptTokens);
  const completionTokens = Math.max(0, input.completionTokens);
  const cachedTokens = Math.min(promptTokens, Math.max(0, input.cachedTokens ?? 0));
  const totalTokens = promptTokens + completionTokens;

  if (typeof input.factorGPer1kTokens === "number" && input.factorGPer1kTokens >= 0) {
    return {
      gramsCO2e: round((totalTokens / 1000) * input.factorGPer1kTokens),
      methodology: AI_METHODOLOGY,
      confidence: "benchmarked",
      assumptions: [
        "Uses the caller-supplied factor in grams per 1k tokens, read and generated alike."
      ],
      breakdown: {
        promptTokens,
        completionTokens,
        cachedTokens,
        totalTokens,
        factorGPer1kTokens: input.factorGPer1kTokens
      }
    };
  }

  const tokens = {
    output: completionTokens,
    uncachedInput: promptTokens - cachedTokens,
    cachedInput: cachedTokens
  };
  const grid = resolveAIGrid(input);

  // A value the caller supplies is a fact about their deployment, not an
  // assumption: it holds on both bounds.
  const withOverrides = (factors: AIEnergyFactors): AIEnergyFactors => ({
    ...factors,
    ...(typeof input.whPer1kOutputTokens === "number" && input.whPer1kOutputTokens >= 0
      ? { whPer1kOutputTokens: input.whPer1kOutputTokens }
      : {}),
    ...(typeof input.pue === "number" && input.pue >= 1 && input.pue <= 3 ? { pue: input.pue } : {})
  });

  const central = computeAI(tokens, withOverrides(AI_ENERGY_FACTORS.central), grid.intensity);
  const low = computeAI(tokens, withOverrides(AI_ENERGY_FACTORS.low), grid.intensity);
  const high = computeAI(tokens, withOverrides(AI_ENERGY_FACTORS.high), grid.intensity);
  const total = (part: typeof central) => part.operationalGrams + part.embodiedGrams;

  return {
    gramsCO2e: round(total(central)),
    methodology: AI_METHODOLOGY,
    confidence: "estimated",
    range: { low: round(total(low)), high: round(total(high)) },
    assumptions: [
      "Converts tokens to server energy, then energy to carbon at the grid of the region where the request is computed.",
      "A token read costs a quarter of a token generated; a token read from the prefix cache, 6.5% of a token read.",
      "Data centre overhead is counted with a PUE of 1.2 unless the caller supplies one.",
      "Server manufacturing is amortised per token, as a bounded assumption.",
      grid.declared
        ? `Grid intensity of ${grid.intensity} gCO2e/kWh, as declared by the caller.`
        : `Grid intensity of ${grid.intensity} gCO2e/kWh, the default region (${grid.region}) for this provider.`,
      "Model size is unknown to the energy factor: the range covers small to frontier models. Hidden reasoning tokens are not counted unless included in completionTokens."
    ],
    breakdown: {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens,
      computeEquivalentTokens: round(central.computeEquivalentTokens),
      energyWh: round(central.energyWh),
      gridIntensityGCO2ePerKWh: grid.intensity,
      operationalGrams: round(central.operationalGrams),
      embodiedGrams: round(central.embodiedGrams)
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
): {
  totalGramsCO2e: number;
  totalEvents: number;
  buckets: AggregateBucket[];
  range?: CarbonRange;
} {
  const bucketMap = new Map<string, CarbonEvent[]>();

  for (const event of events) {
    let key: string = event.type;

    if (options.groupBy === "route" && event.type === "web.pageview") {
      key = event.input.route ?? "unknown-route";
    }

    if (options.groupBy === "model" && event.type === "ai.usage") {
      key = event.input.model;
    }

    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      bucketMap.set(key, [event]);
    }
  }

  const buckets = [...bucketMap.entries()].map(([key, bucketEvents]): AggregateBucket => {
    const range = sumRanges(bucketEvents.map((event) => event.result));
    return {
      key,
      gramsCO2e: round(bucketEvents.reduce((sum, event) => sum + event.result.gramsCO2e, 0)),
      events: bucketEvents.length,
      ...(range ? { range } : {})
    };
  });
  const range = sumRanges(events.map((event) => event.result));

  return {
    totalGramsCO2e: round(events.reduce((sum, event) => sum + event.result.gramsCO2e, 0)),
    totalEvents: events.length,
    buckets,
    ...(range ? { range } : {})
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

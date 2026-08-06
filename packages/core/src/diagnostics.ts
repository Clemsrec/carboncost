import type { CarbonEvent } from "./types.js";

export type CoverageStatus =
  | "covered"
  | "partial"
  | "missing"
  | "unknown"
  /** Nothing to measure here, by configuration. Distinct from "we could not measure". */
  | "not-applicable";

/**
 * Stable machine-readable reason behind a status. Use this for UI logic and
 * translation; `notes` is English prose for integrators and is not meant to be
 * shown to end users.
 */
export type CoverageReason =
  | "sufficient-samples"
  | "no-events"
  | "not-expected"
  | "below-sample-threshold"
  | "incomplete-fields"
  | "unmeasured-requests"
  | "config-complete"
  | "config-incomplete"
  | "config-missing"
  | "covered-by-model";

export interface CoverageDimension {
  status: CoverageStatus;
  reason: CoverageReason;
  /** The numbers behind the verdict, including the thresholds that were applied. */
  metrics: Record<string, number>;
  /** English prose for integrators. Not suitable for end users — translate from `reason`. */
  notes: string[];
  /** Origins whose size could not be measured, when the dimension has any. */
  unknownOrigins?: string[];
}

/** A dimension needs at least this many events before it can be "covered". */
export const MIN_SAMPLE_EVENTS = 3;

/** And at least this share of them must carry the fields the estimate needs. */
export const MIN_FIELD_COVERAGE_RATIO = 0.7;

export interface CoverageReport {
  webPageviews: CoverageDimension;
  webApiCalls: CoverageDimension;
  aiInference: CoverageDimension;
  hostingInfo: CoverageDimension;
  clientDevice: CoverageDimension;
  custom?: Record<string, CoverageDimension>;
}

export interface DiagnosticsConfig {
  expectsApiTracking?: boolean;
  expectsAiTracking?: boolean;
  hostingProvider?: string;
  region?: string;
  greenHosting?: boolean;
}

export interface DiagnosticsEvent {
  type: "web.pageview" | "web.api_call" | "ai.inference" | "ai.usage" | string;
  bytesTransferred?: number;
  bytesIn?: number;
  bytesOut?: number;
  model?: string;
  confidence?: "estimated" | "benchmarked" | "measured";
  route?: string;
  input?: Record<string, unknown>;
  breakdown?: Record<string, unknown>;
}

export type AnyEvent = CarbonEvent | DiagnosticsEvent;

function toCoverage(
  status: CoverageStatus,
  reason: CoverageReason,
  metrics: Record<string, number>,
  notes: string[]
): CoverageDimension {
  return { status, reason, metrics, notes };
}

/**
 * Classifies an event stream against the sample and field-completeness
 * thresholds, so every dimension reports the same way and the thresholds are
 * visible from the outside instead of being buried in the branch conditions.
 */
function classifySamples(
  observed: number,
  complete: number,
  expected: boolean | undefined,
  labels: { unit: string; field: string }
): CoverageDimension {
  const metrics = {
    observed,
    complete,
    minSampleEvents: MIN_SAMPLE_EVENTS,
    minFieldCoverageRatio: MIN_FIELD_COVERAGE_RATIO,
    fieldCoverageRatio: observed === 0 ? 0 : complete / observed
  };

  if (observed === 0 && expected === true) {
    return toCoverage("missing", "no-events", metrics, [
      `Tracking was expected but no ${labels.unit} events were found.`
    ]);
  }

  if (observed === 0 && expected === false) {
    return toCoverage("not-applicable", "not-expected", metrics, [
      `No ${labels.unit} events, and none are expected in this configuration.`
    ]);
  }

  if (observed === 0) {
    return toCoverage("unknown", "no-events", metrics, [
      `No expectation declared and no ${labels.unit} events; this traffic may simply not be tracked.`
    ]);
  }

  if (observed < MIN_SAMPLE_EVENTS) {
    return toCoverage("partial", "below-sample-threshold", metrics, [
      `${observed} ${labels.unit} events observed, below the ${MIN_SAMPLE_EVENTS} needed to judge coverage.`
    ]);
  }

  if (metrics.fieldCoverageRatio < MIN_FIELD_COVERAGE_RATIO) {
    return toCoverage("partial", "incomplete-fields", metrics, [
      `${complete}/${observed} ${labels.unit} events include ${labels.field}, below the ${MIN_FIELD_COVERAGE_RATIO} ratio required.`
    ]);
  }

  return toCoverage("covered", "sufficient-samples", metrics, [
    `${observed} ${labels.unit} events observed.`,
    `${complete}/${observed} include ${labels.field}.`
  ]);
}

function collectUnknownOrigins(events: AnyEvent[]): string[] {
  const origins = new Set<string>();

  for (const event of events) {
    const fromInput = (event as { input?: { unknownOrigins?: unknown } }).input?.unknownOrigins;
    const fromRoot = (event as { unknownOrigins?: unknown }).unknownOrigins;
    const list = fromInput ?? fromRoot;

    if (Array.isArray(list)) {
      for (const origin of list) {
        if (typeof origin === "string" && origin.length > 0) {
          origins.add(origin);
        }
      }
    }
  }

  return [...origins].sort();
}

function countUnknownRequests(events: AnyEvent[]): number {
  return events.reduce((total, event) => {
    const fromInput = getNumber(
      (event as { input?: { unknownRequests?: unknown } }).input?.unknownRequests
    );
    const fromRoot = getNumber((event as { unknownRequests?: unknown }).unknownRequests);
    return total + (fromInput ?? fromRoot ?? 0);
  }, 0);
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function hasPageviewBytes(event: AnyEvent): boolean {
  const fromInput = getNumber((event as { input?: { bytesTransferred?: unknown } }).input?.bytesTransferred);
  const fromRoot = getNumber((event as { bytesTransferred?: unknown }).bytesTransferred);
  return (fromInput ?? fromRoot ?? -1) >= 0;
}

function hasApiBytes(event: AnyEvent): boolean {
  const bytesIn = getNumber((event as { bytesIn?: unknown }).bytesIn);
  const bytesOut = getNumber((event as { bytesOut?: unknown }).bytesOut);
  return (bytesIn ?? -1) >= 0 || (bytesOut ?? -1) >= 0;
}

function hasAiModel(event: AnyEvent): boolean {
  const fromInput = (event as { input?: { model?: unknown } }).input?.model;
  const fromRoot = (event as { model?: unknown }).model;
  return typeof (fromInput ?? fromRoot) === "string";
}

function isEstimatedAi(event: AnyEvent): boolean {
  const confidence = (event as { result?: { confidence?: unknown }; confidence?: unknown }).result?.confidence
    ?? (event as { confidence?: unknown }).confidence;
  return confidence === "estimated";
}

export function diagnose(config: DiagnosticsConfig, recentEvents: AnyEvent[]): CoverageReport {
  const pageviews = recentEvents.filter((event) => event.type === "web.pageview");
  const apiCalls = recentEvents.filter((event) => event.type === "web.api_call");
  const aiEvents = recentEvents.filter(
    (event) => event.type === "ai.inference" || event.type === "ai.usage"
  );

  const pageviewsWithBytes = pageviews.filter(hasPageviewBytes).length;
  const apiCallsWithBytes = apiCalls.filter(hasApiBytes).length;
  const aiWithModel = aiEvents.filter(hasAiModel).length;
  const aiEstimated = aiEvents.filter(isEstimatedAi).length;

  const webPageviews = classifySamples(pageviews.length, pageviewsWithBytes, undefined, {
    unit: "web.pageview",
    field: "bytesTransferred"
  });

  // Opaque cross-origin resources report transferSize 0. An integrator that
  // counts them as zero silently undercounts, so a declared count of unmeasured
  // requests caps the verdict at "partial" and says so.
  const unknownRequests = countUnknownRequests(pageviews);
  const unknownOrigins = collectUnknownOrigins(pageviews);
  if (unknownRequests > 0) {
    webPageviews.metrics.unknownRequests = unknownRequests;
    webPageviews.unknownOrigins = unknownOrigins;
    webPageviews.notes.push(
      unknownOrigins.length > 0
        ? `${unknownRequests} requests could not be measured and are excluded from the estimate: ${unknownOrigins.join(", ")}.`
        : `${unknownRequests} requests could not be measured and are excluded from the estimate.`
    );
    if (webPageviews.status === "covered") {
      webPageviews.status = "partial";
      webPageviews.reason = "unmeasured-requests";
    }
  }

  const webApiCalls = classifySamples(
    apiCalls.length,
    apiCallsWithBytes,
    config.expectsApiTracking,
    { unit: "web.api_call", field: "bytes in/out fields" }
  );

  const aiInference = classifySamples(aiEvents.length, aiWithModel, config.expectsAiTracking, {
    unit: "AI",
    field: "model metadata"
  });

  if (aiEstimated > 0) {
    aiInference.metrics.estimatedConfidence = aiEstimated;
    aiInference.notes.push(
      `${aiEstimated}/${aiEvents.length} AI events are using estimated confidence (fallback model factors may apply).`
    );
  }

  const hostingKnown = [
    typeof config.hostingProvider === "string" ? "hostingProvider" : undefined,
    typeof config.region === "string" ? "region" : undefined,
    typeof config.greenHosting === "boolean" ? "greenHosting" : undefined
  ].filter(Boolean) as string[];

  const hostingMissing = ["hostingProvider", "region", "greenHosting"].filter(
    (key) => !hostingKnown.includes(key)
  );

  const hostingMetrics = {
    knownFields: hostingKnown.length,
    expectedFields: 3
  };

  let hostingInfo: CoverageDimension;
  if (hostingKnown.length === 3) {
    hostingInfo = toCoverage("covered", "config-complete", hostingMetrics, [
      `Known fields: ${hostingKnown.join(", ")}.`
    ]);
  } else if (hostingKnown.length > 0) {
    hostingInfo = toCoverage("partial", "config-incomplete", hostingMetrics, [
      `Known fields: ${hostingKnown.join(", ")}.`,
      `Unknown fields: ${hostingMissing.join(", ")}.`
    ]);
  } else {
    hostingInfo = toCoverage("missing", "config-missing", hostingMetrics, [
      "No hosting metadata was provided in diagnostics config."
    ]);
  }

  // The web model carries user device energy in its own segment, so this is no
  // longer an uncovered dimension.
  const clientDevice = toCoverage("covered", "covered-by-model", {}, [
    "End-user device energy is included in the web estimate as its own segment."
  ]);

  return {
    webPageviews,
    webApiCalls,
    aiInference,
    hostingInfo,
    clientDevice
  };
}

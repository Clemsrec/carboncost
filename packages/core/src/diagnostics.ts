import type { CarbonEvent } from "./types.js";

export type CoverageStatus = "covered" | "partial" | "missing" | "unknown";

export interface CoverageDimension {
  status: CoverageStatus;
  notes: string[];
}

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

function toCoverage(status: CoverageStatus, notes: string[]): CoverageDimension {
  return { status, notes };
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

  let webPageviews: CoverageDimension;
  if (pageviews.length === 0) {
    webPageviews = toCoverage("missing", ["No web.pageview events were found in recent samples."]);
  } else if (pageviews.length < 3 || pageviewsWithBytes / pageviews.length < 0.7) {
    webPageviews = toCoverage("partial", [
      `${pageviews.length} web.pageview events observed.`,
      `${pageviewsWithBytes}/${pageviews.length} include bytesTransferred.`
    ]);
  } else {
    webPageviews = toCoverage("covered", [
      `${pageviews.length} web.pageview events observed.`,
      `${pageviewsWithBytes}/${pageviews.length} include bytesTransferred.`
    ]);
  }

  let webApiCalls: CoverageDimension;
  if (apiCalls.length === 0 && config.expectsApiTracking === true) {
    webApiCalls = toCoverage("missing", [
      "API tracking was expected but no web.api_call events were found."
    ]);
  } else if (apiCalls.length === 0) {
    webApiCalls = toCoverage("unknown", [
      "No expectation and no web.api_call events; backend/API traffic may not be tracked."
    ]);
  } else if (apiCalls.length < 3 || apiCallsWithBytes / apiCalls.length < 0.7) {
    webApiCalls = toCoverage("partial", [
      `${apiCalls.length} web.api_call events observed.`,
      `${apiCallsWithBytes}/${apiCalls.length} include bytes in/out fields.`
    ]);
  } else {
    webApiCalls = toCoverage("covered", [
      `${apiCalls.length} web.api_call events observed.`,
      `${apiCallsWithBytes}/${apiCalls.length} include bytes in/out fields.`
    ]);
  }

  let aiInference: CoverageDimension;
  if (aiEvents.length === 0 && config.expectsAiTracking === true) {
    aiInference = toCoverage("missing", [
      "AI tracking was expected but no ai.inference/ai.usage events were found."
    ]);
  } else if (aiEvents.length === 0) {
    aiInference = toCoverage("unknown", [
      "No expectation and no AI events; inference traffic may not be tracked."
    ]);
  } else if (aiEvents.length < 3 || aiWithModel / aiEvents.length < 0.7) {
    aiInference = toCoverage("partial", [
      `${aiEvents.length} AI events observed.`,
      `${aiWithModel}/${aiEvents.length} include model metadata.`
    ]);
  } else {
    aiInference = toCoverage("covered", [
      `${aiEvents.length} AI events observed.`,
      `${aiWithModel}/${aiEvents.length} include model metadata.`
    ]);
  }

  if (aiEstimated > 0) {
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

  let hostingInfo: CoverageDimension;
  if (hostingKnown.length === 3) {
    hostingInfo = toCoverage("covered", [
      `Known fields: ${hostingKnown.join(", ")}.`,
      "Hosting context can be documented in diagnostics notes."
    ]);
  } else if (hostingKnown.length > 0) {
    hostingInfo = toCoverage("partial", [
      `Known fields: ${hostingKnown.join(", ")}.`,
      `Unknown fields: ${hostingMissing.join(", ")}.`
    ]);
  } else {
    hostingInfo = toCoverage("missing", ["No hosting metadata was provided in diagnostics config."]);
  }

  const clientDevice = toCoverage("missing", [
    "End-user device energy is not estimated in current methodology."
  ]);

  return {
    webPageviews,
    webApiCalls,
    aiInference,
    hostingInfo,
    clientDevice
  };
}

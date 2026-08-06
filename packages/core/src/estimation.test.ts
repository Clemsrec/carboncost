import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateEvents,
  aggregateSession,
  estimateAI,
  estimateWeb,
  formatForDisplay,
  resolveModelTier,
  toEquivalents,
  trackAIUsage,
  trackPageview
} from "./index.js";
import { WEB_METHODOLOGY } from "./methodology.js";

test("trackPageview returns a non-negative estimate", () => {
  const event = trackPageview({ bytesTransferred: 1250000, route: "/" });
  assert.equal(event.type, "web.pageview");
  assert.ok(event.result.gramsCO2e >= 0);
});

test("estimateWeb only claims benchmarked confidence with an explicit hosting signal", () => {
  const omitted = estimateWeb({ bytesTransferred: 1000000 });
  const unknown = estimateWeb({ bytesTransferred: 1000000, greenHosting: "unknown" });
  const declared = estimateWeb({ bytesTransferred: 1000000, greenHosting: false });

  assert.equal(omitted.confidence, "estimated");
  assert.equal(unknown.confidence, "estimated");
  assert.equal(declared.confidence, "benchmarked");
});

test("estimateWeb matches the Sustainable Web Design intensity for one GB", () => {
  const oneGigabyte = estimateWeb({ bytesTransferred: 1_000_000_000 });

  // 0.300 kWh/GB across all segments x 494 gCO2e/kWh.
  assert.ok(Math.abs(oneGigabyte.gramsCO2e - 148.2) < 0.1, `got ${oneGigabyte.gramsCO2e}`);
});

test("estimateWeb splits the estimate across segments", () => {
  const { breakdown } = estimateWeb({ bytesTransferred: 1_000_000_000 });
  const segments =
    (breakdown?.dataCenterGrams ?? 0) +
    (breakdown?.networkGrams ?? 0) +
    (breakdown?.userDeviceGrams ?? 0);

  assert.ok(Math.abs(segments - 148.2) < 0.1);
  // The user device dominates: it carries 54% of system energy in the model.
  assert.ok((breakdown?.userDeviceGrams ?? 0) > (breakdown?.dataCenterGrams ?? 0) * 2);
});

test("estimateWeb applies green hosting to data centre operational energy only", () => {
  const grey = estimateWeb({ bytesTransferred: 1_000_000_000, greenHosting: false });
  const green = estimateWeb({ bytesTransferred: 1_000_000_000, greenHosting: true });

  // 0.055 kWh/GB x 494 = 27.17 g removed, not half the total.
  assert.ok(Math.abs(grey.gramsCO2e - green.gramsCO2e - 27.17) < 0.1);
  assert.ok(green.gramsCO2e > grey.gramsCO2e * 0.8);
});

test("estimateWeb accepts a partial green hosting factor", () => {
  const half = estimateWeb({ bytesTransferred: 1_000_000_000, greenHostingFactor: 0.5 });
  const full = estimateWeb({ bytesTransferred: 1_000_000_000, greenHostingFactor: 1 });
  const none = estimateWeb({ bytesTransferred: 1_000_000_000, greenHostingFactor: 0 });

  assert.ok(half.gramsCO2e < none.gramsCO2e && half.gramsCO2e > full.gramsCO2e);
  assert.equal(half.confidence, "benchmarked");
});

test("estimateWeb honours a regional grid intensity", () => {
  const global = estimateWeb({ bytesTransferred: 1_000_000_000 });
  const lowCarbon = estimateWeb({
    bytesTransferred: 1_000_000_000,
    gridIntensityGCO2ePerKWh: 50
  });

  assert.ok(lowCarbon.gramsCO2e < global.gramsCO2e);
  // Embodied energy keeps the global average, so it cannot fall to a tenth.
  assert.ok(lowCarbon.gramsCO2e > global.gramsCO2e * 0.2);
});

test("estimateWeb honours a caller-supplied intensity per GB", () => {
  const custom = estimateWeb({ bytesTransferred: 1_000_000_000, factorGPerGB: 360 });

  assert.equal(custom.gramsCO2e, 360);
  assert.equal(custom.confidence, "benchmarked");
});

test("estimateAI resolves dated model names back to their known factor", () => {
  const dated = estimateAI({
    provider: "openai",
    model: "GPT-4o-mini-2024-07-18",
    promptTokens: 1000,
    completionTokens: 0
  });

  assert.equal(dated.confidence, "benchmarked");
  assert.equal(dated.breakdown?.factorGPer1kTokens, 0.09);
});

test("estimateAI falls back to a size tier for unknown models", () => {
  const large = estimateAI({
    provider: "anthropic",
    model: "claude-opus-9",
    promptTokens: 1000,
    completionTokens: 0
  });

  assert.equal(large.confidence, "estimated");
  assert.equal(large.breakdown?.factorGPer1kTokens, 0.42);
});

test("estimateAI honours a caller-supplied factor", () => {
  const custom = estimateAI({
    provider: "other",
    model: "in-house-llm",
    promptTokens: 2000,
    completionTokens: 0,
    factorGPer1kTokens: 1
  });

  assert.equal(custom.confidence, "benchmarked");
  assert.equal(custom.gramsCO2e, 2);
});

test("resolveModelTier buckets models by their size qualifier", () => {
  assert.equal(resolveModelTier("gemini-3-flash"), "small");
  assert.equal(resolveModelTier("claude-haiku-4-5"), "small");
  assert.equal(resolveModelTier("gemini-2.5-pro"), "large");
  assert.equal(resolveModelTier("mistral-large-latest"), "large");
  assert.equal(resolveModelTier("some-unlabelled-model"), "medium");
});

test("trackAIUsage returns a non-negative estimate", () => {
  const event = trackAIUsage({
    provider: "openai",
    model: "gpt-4o-mini",
    promptTokens: 1000,
    completionTokens: 500
  });
  assert.equal(event.type, "ai.usage");
  assert.ok(event.result.gramsCO2e >= 0);
});

test("aggregateEvents returns totals", () => {
  const events = [
    trackPageview({ bytesTransferred: 1000000 }),
    trackAIUsage({
      provider: "other",
      model: "unknown",
      promptTokens: 500,
      completionTokens: 500
    })
  ];

  const result = aggregateEvents(events, { groupBy: "type" });
  assert.equal(result.totalEvents, 2);
  assert.equal(result.buckets.length, 2);
});

test("formatForDisplay rounds very small values down to zero for UI", () => {
  const display = formatForDisplay(
    {
      gramsCO2e: 0.0004,
      methodology: WEB_METHODOLOGY,
      confidence: "benchmarked",
      assumptions: []
    },
    { minDisplayGrams: 0.001 }
  );

  assert.equal(display.gramsPerView, 0.0004);
  assert.equal(display.gramsPerViewRounded, 0);
  assert.equal(display.gramsPerThousandViews, 0.4);
  assert.equal(display.category, "very-low");
  assert.equal(display.methodologyVersion, WEB_METHODOLOGY.methodologyVersion);
});

test("formatForDisplay maps per-view thresholds to display categories", () => {
  const categoryFor = (gramsCO2e: number) =>
    formatForDisplay({
      gramsCO2e,
      methodology: WEB_METHODOLOGY,
      confidence: "benchmarked",
      assumptions: []
    }).category;

  assert.equal(categoryFor(0.05), "very-low");
  assert.equal(categoryFor(0.2), "low");
  assert.equal(categoryFor(0.5), "medium");
  assert.equal(categoryFor(1.2), "high");
});

test("a one megabyte page lands in a realistic display band", () => {
  const pageview = trackPageview({ route: "/", bytesTransferred: 1_000_000 });
  const display = formatForDisplay(pageview.result);

  // ~0.148 g per view. Under the old coefficient this was 0.0005 g and every
  // real page collapsed into "very-low".
  assert.equal(display.category, "low");
  assert.ok(display.gramsPerViewRounded > 0);
});

test("toEquivalents converts grams to multiple human-readable equivalents", () => {
  const equivalents = toEquivalents(160);

  assert.equal(equivalents.phoneCharges, 100);
  assert.equal(equivalents.carKm, 1.07);
  assert.equal(equivalents.trainKm, 11.43);
  assert.equal(equivalents.ledBulbHours, 40);
  assert.equal(equivalents.laptopCharges, 4.85);
  assert.equal(equivalents.phoneChargesDisplay, "100 charge");
  assert.equal(equivalents.trainKmDisplay, "11.43 km");
  assert.equal(equivalents.ledBulbHoursDisplay, "40 h");
  assert.equal(equivalents.laptopChargesDisplay, "4.9 charge");
  assert.equal(equivalents.assumptions.length, 6);
});

test("toEquivalents formats near-zero charge and hour displays", () => {
  const equivalents = toEquivalents(0.05);

  assert.equal(equivalents.phoneChargesDisplay, "< 0.1 charge");
  assert.equal(equivalents.laptopChargesDisplay, "< 0.1 charge");
  assert.equal(equivalents.ledBulbHoursDisplay, "< 0.1 h");
});

test("toEquivalents formats sub-kilometer train distances in meters", () => {
  const equivalents = toEquivalents(4.5);

  assert.equal(equivalents.trainKm, 0.32);
  assert.equal(equivalents.trainKmDisplay, "320 m");
});

test("toEquivalents formats tiny train distances as less than one meter", () => {
  const equivalents = toEquivalents(0.01);

  assert.equal(equivalents.trainKmDisplay, "< 1 m");
});

test("toEquivalents formats for the requested locale", () => {
  const english = toEquivalents(160);
  const french = toEquivalents(160, { locale: "fr" });

  assert.equal(english.trainKmDisplay, "11.43 km");
  assert.equal(french.trainKmDisplay, "11,43 km");
  assert.equal(french.laptopChargesDisplay, "4,9 charge");

  const tiny = toEquivalents(0.05, { locale: "fr" });
  assert.equal(tiny.phoneChargesDisplay, "< 0,1 charge");
});

test("toEquivalents accepts translated unit labels", () => {
  const german = toEquivalents(160, {
    locale: "de",
    labels: { charge: "Ladung", hour: "Std." }
  });

  assert.equal(german.phoneChargesDisplay, "100 Ladung");
  assert.equal(german.ledBulbHoursDisplay, "40 Std.");
});

test("estimateWeb marks an estimate with unmeasured requests as a floor", () => {
  const measured = estimateWeb({ bytesTransferred: 1_000_000, greenHosting: false });
  const partial = estimateWeb({
    bytesTransferred: 1_000_000,
    greenHosting: false,
    unknownRequests: 3
  });

  assert.equal(measured.confidence, "benchmarked");
  assert.equal(partial.confidence, "estimated");
  assert.equal(partial.breakdown?.unknownRequests, 3);
  assert.ok(partial.assumptions.some((line) => line.includes("floor")));
});

test("aggregateSession separates pageview and AI grams", () => {
  const events = [
    trackPageview({ bytesTransferred: 1_000_000, route: "/" }),
    trackAIUsage({
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 10_000,
      completionTokens: 5_000
    })
  ];

  const session = aggregateSession(events);

  assert.equal(session.totalViews, 1);
  assert.ok(session.aiGrams > 0);
  assert.ok(session.pageviewGrams > 0);
  assert.equal(round6(session.pageviewGrams + session.aiGrams), round6(session.totalGrams));
  // The average is per pageview, so AI must not inflate it.
  assert.equal(session.averageGramsPerView, session.pageviewGrams);
});

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

test("aggregateSession returns totals and averages for pageviews", () => {
  const events = [
    trackPageview({ bytesTransferred: 1000000, route: "/" }),
    trackPageview({ bytesTransferred: 2000000, route: "/pricing" })
  ];

  const session = aggregateSession(events);
  const expectedAverage = Math.round((session.totalGrams / 2) * 1_000_000) / 1_000_000;

  assert.equal(session.totalViews, 2);
  assert.ok(session.totalGrams > 0);
  assert.equal(session.averageGramsPerView, expectedAverage);
});

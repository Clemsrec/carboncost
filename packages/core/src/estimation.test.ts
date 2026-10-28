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

test("estimateAI converts tokens to energy, then carbon at the provider's region", () => {
  const result = estimateAI({
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    promptTokens: 10_000,
    cachedTokens: 8_000,
    completionTokens: 1_000
  });

  // 1,000 generated + 0.25 x (2,000 uncached + 0.065 x 8,000 cached) = 1,630
  // compute-equivalent tokens; x 0.7 Wh/1k x PUE 1.2 = 1.3692 Wh; x 384 g/kWh
  // (US) = 0.52577 g; plus 0.019 g/1k x 1.63 = 0.03097 g of manufacturing.
  assert.equal(result.breakdown?.computeEquivalentTokens, 1630);
  assert.ok(Math.abs((result.breakdown?.energyWh ?? 0) - 1.3692) < 1e-6);
  assert.equal(result.breakdown?.gridIntensityGCO2ePerKWh, 384);
  assert.ok(Math.abs(result.gramsCO2e - 0.556743) < 1e-6, `got ${result.gramsCO2e}`);
  assert.equal(result.confidence, "estimated");
});

test("estimateAI bills a token read below a token generated, and a cached one lower still", () => {
  const base = { provider: "openai" as const, model: "gpt-5" };
  const generated = estimateAI({ ...base, promptTokens: 0, completionTokens: 1000 });
  const read = estimateAI({ ...base, promptTokens: 1000, completionTokens: 0 });
  const cached = estimateAI({ ...base, promptTokens: 1000, cachedTokens: 1000, completionTokens: 0 });

  assert.ok(Math.abs(read.gramsCO2e / generated.gramsCO2e - 0.25) < 1e-3);
  assert.ok(cached.gramsCO2e < read.gramsCO2e * 0.1);
});

test("estimateAI never counts more cached tokens than prompt tokens", () => {
  const result = estimateAI({
    provider: "openai",
    model: "gpt-5",
    promptTokens: 100,
    cachedTokens: 5000,
    completionTokens: 0
  });

  assert.equal(result.breakdown?.cachedTokens, 100);
});

test("estimateAI uses the grid of the region where the request is computed", () => {
  const base = { model: "any", promptTokens: 0, completionTokens: 10_000 };
  const us = estimateAI({ ...base, provider: "openai" });
  const eu = estimateAI({ ...base, provider: "mistral" });
  const france = estimateAI({ ...base, provider: "mistral", region: "fr" });
  const unknown = estimateAI({ ...base, provider: "other", region: "XX" });
  const custom = estimateAI({ ...base, provider: "openai", gridIntensityGCO2ePerKWh: 0 });

  assert.equal(us.breakdown?.gridIntensityGCO2ePerKWh, 384);
  assert.equal(eu.breakdown?.gridIntensityGCO2ePerKWh, 210);
  assert.equal(france.breakdown?.gridIntensityGCO2ePerKWh, 51.9);
  // Never the cleanest grid for a region nobody knows.
  assert.equal(unknown.breakdown?.gridIntensityGCO2ePerKWh, 458);
  // Manufacturing does not depend on the grid.
  assert.equal(custom.gramsCO2e, custom.breakdown?.embodiedGrams);
  assert.ok(france.gramsCO2e < eu.gramsCO2e && eu.gramsCO2e < us.gramsCO2e);
});

test("estimateAI returns a range around the central value", () => {
  const result = estimateAI({
    provider: "anthropic",
    model: "claude-opus-4-5",
    promptTokens: 20_000,
    cachedTokens: 15_000,
    completionTokens: 2_000
  });

  assert.ok(result.range);
  assert.ok(result.range.low < result.gramsCO2e && result.gramsCO2e < result.range.high);
});

test("estimateAI keeps caller-supplied energy and PUE on both bounds", () => {
  const result = estimateAI({
    provider: "other",
    model: "in-house",
    promptTokens: 0,
    completionTokens: 1000,
    whPer1kOutputTokens: 1,
    pue: 1.1,
    gridIntensityGCO2ePerKWh: 100
  });

  // 1 Wh x 1.1 = 1.1 Wh x 100 g/kWh = 0.11 g, plus manufacturing.
  assert.ok(Math.abs((result.breakdown?.energyWh ?? 0) - 1.1) < 1e-9);
  assert.ok(Math.abs(result.gramsCO2e - (0.11 + 0.019)) < 1e-9);
  assert.ok(Math.abs(result.range!.low - (0.11 + 0.004)) < 1e-9);
  assert.ok(Math.abs(result.range!.high - (0.11 + 0.13)) < 1e-9);
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
  assert.equal(custom.range, undefined);
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

test("aggregateEvents sums bounds, counting an event without bounds at its central value", () => {
  const web = trackPageview({ bytesTransferred: 1_000_000 });
  const ai = trackAIUsage({ provider: "openai", model: "gpt-5", promptTokens: 0, completionTokens: 1000 });
  const result = aggregateEvents([web, ai], { groupBy: "type" });

  assert.ok(result.range);
  assert.ok(Math.abs(result.range.low - (web.result.gramsCO2e + ai.result.range!.low)) < 1e-6);
  assert.ok(Math.abs(result.range.high - (web.result.gramsCO2e + ai.result.range!.high)) < 1e-6);
  assert.equal(result.buckets.find((bucket) => bucket.key === "web.pageview")?.range, undefined);
  assert.deepEqual(aggregateEvents([web]).range, undefined);
});

test("estimateWeb takes the hosting grid from a region code", () => {
  const france = estimateWeb({ bytesTransferred: 1_000_000_000, region: "FR" });
  const explicit = estimateWeb({ bytesTransferred: 1_000_000_000, gridIntensityGCO2ePerKWh: 51.9 });

  assert.equal(france.gramsCO2e, explicit.gramsCO2e);
  // 0.194 kWh/GB of operational energy at 51.9 g, 0.106 of embodied at 494 g.
  assert.ok(Math.abs(france.gramsCO2e - 62.4326) < 1e-3, `got ${france.gramsCO2e}`);
  assert.equal(france.range, undefined);
});

test("estimateWeb lets an explicit intensity win over a region, and ignores unknown codes", () => {
  const both = estimateWeb({ bytesTransferred: 1_000_000_000, region: "FR", gridIntensityGCO2ePerKWh: 494 });
  const unknown = estimateWeb({ bytesTransferred: 1_000_000_000, region: "ZZ" });
  const defaults = estimateWeb({ bytesTransferred: 1_000_000_000 });

  assert.equal(both.gramsCO2e, defaults.gramsCO2e);
  assert.equal(unknown.gramsCO2e, defaults.gramsCO2e);
  assert.ok(unknown.assumptions.some((line) => line.includes("ZZ")));
});

test("estimateWeb applies the visitor region to the user device only", () => {
  const hostedInUs = estimateWeb({ bytesTransferred: 1_000_000_000, region: "US" });
  const visitorInFrance = estimateWeb({
    bytesTransferred: 1_000_000_000,
    region: "US",
    visitorRegion: "FR"
  });

  assert.equal(visitorInFrance.breakdown?.dataCenterGrams, hostedInUs.breakdown?.dataCenterGrams);
  assert.equal(visitorInFrance.breakdown?.networkGrams, hostedInUs.breakdown?.networkGrams);
  assert.equal(visitorInFrance.breakdown?.deviceGridIntensityGCO2ePerKWh, 51.9);
  assert.ok((visitorInFrance.breakdown?.userDeviceGrams ?? 0) < (hostedInUs.breakdown?.userDeviceGrams ?? 0));
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
  assert.ok(session.range && session.range.low < session.totalGrams && session.totalGrams < session.range.high);
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

import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateEvents,
  aggregateSession,
  formatForDisplay,
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

test("formatForDisplay maps thresholds to display categories", () => {
  const low = formatForDisplay({
    gramsCO2e: 0.003,
    methodology: WEB_METHODOLOGY,
    confidence: "benchmarked",
    assumptions: []
  });

  const medium = formatForDisplay({
    gramsCO2e: 0.01,
    methodology: WEB_METHODOLOGY,
    confidence: "benchmarked",
    assumptions: []
  });

  const high = formatForDisplay({
    gramsCO2e: 0.03,
    methodology: WEB_METHODOLOGY,
    confidence: "benchmarked",
    assumptions: []
  });

  assert.equal(low.category, "low");
  assert.equal(medium.category, "medium");
  assert.equal(high.category, "high");
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

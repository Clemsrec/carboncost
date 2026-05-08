import test from "node:test";
import assert from "node:assert/strict";

import { aggregateEvents, trackAIUsage, trackPageview } from "./index.js";

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

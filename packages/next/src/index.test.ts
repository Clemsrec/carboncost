import assert from "node:assert/strict";
import test from "node:test";
import type { CarbonEvent } from "carbone-cost";
import { createMemoryRateLimiter, createNextCarbon } from "./index.js";

function postRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/carbon", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body
  });
}

const validEvent = {
  type: "web.pageview",
  input: { route: "/", bytesTransferred: 1000 },
  result: { gramsCO2e: 0.1 },
  timestamp: "2026-01-01T00:00:00.000Z"
};

test("collectHandler rejects non-POST methods", async () => {
  const carbon = createNextCarbon();
  const response = await carbon.collectHandler(
    new Request("https://example.test/api/carbon", { method: "GET" })
  );

  assert.equal(response.status, 405);
});

test("collectHandler returns 400 on malformed JSON instead of throwing", async () => {
  const carbon = createNextCarbon();
  const response = await carbon.collectHandler(postRequest("{not json"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
});

test("collectHandler returns 400 when the event is missing", async () => {
  const carbon = createNextCarbon();
  const response = await carbon.collectHandler(postRequest(JSON.stringify({})));

  assert.equal(response.status, 400);
});

test("collectHandler returns 400 for an unsupported event type", async () => {
  const carbon = createNextCarbon();
  const response = await carbon.collectHandler(
    postRequest(JSON.stringify({ event: { type: "totally.unknown" } }))
  );

  assert.equal(response.status, 400);
});

test("collectHandler rejects an oversized declared payload with 413", async () => {
  const carbon = createNextCarbon({ maxBodyBytes: 32 });
  const response = await carbon.collectHandler(
    postRequest(JSON.stringify({ event: validEvent }), { "content-length": "5000" })
  );

  assert.equal(response.status, 413);
});

test("collectHandler rejects an oversized actual payload with 413", async () => {
  const carbon = createNextCarbon({ maxBodyBytes: 16 });
  const response = await carbon.collectHandler(postRequest(JSON.stringify({ event: validEvent })));

  assert.equal(response.status, 413);
});

test("collectHandler accepts a bare event without the envelope", async () => {
  const seen: unknown[] = [];
  const carbon = createNextCarbon({
    onEvent: (event) => {
      seen.push(event);
    }
  });

  const response = await carbon.collectHandler(postRequest(JSON.stringify(validEvent)));

  assert.equal(response.status, 200);
  assert.equal(seen.length, 1);
});

test("collectHandler forwards accepted events to onEvent", async () => {
  const seen: unknown[] = [];
  const carbon = createNextCarbon({
    onEvent: (event) => {
      seen.push(event);
    }
  });

  const response = await carbon.collectHandler(postRequest(JSON.stringify({ event: validEvent })));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(seen.length, 1);
});

test("collectHandler returns 500 when onEvent throws", async () => {
  const carbon = createNextCarbon({
    onEvent: () => {
      throw new Error("db down");
    }
  });

  const response = await carbon.collectHandler(postRequest(JSON.stringify({ event: validEvent })));

  assert.equal(response.status, 500);
});

test("collectHandler recomputes the result instead of trusting the client", async () => {
  const seen: CarbonEvent[] = [];
  const carbon = createNextCarbon({ onEvent: (event) => void seen.push(event) });
  const forged = {
    ...validEvent,
    input: { route: "/", bytesTransferred: 1_000_000_000 },
    result: { gramsCO2e: 0.0001 }
  };

  const response = await carbon.collectHandler(postRequest(JSON.stringify({ event: forged })));

  assert.equal(response.status, 200);
  assert.ok(Math.abs((seen[0]?.result.gramsCO2e ?? 0) - 148.2) < 0.1);
  assert.notEqual(seen[0]?.timestamp, validEvent.timestamp);
});

test("collectHandler recomputes AI events with the energy model", async () => {
  const seen: CarbonEvent[] = [];
  const carbon = createNextCarbon({ onEvent: (event) => void seen.push(event) });
  const event = {
    type: "ai.usage",
    input: { provider: "mistral", model: "mistral-medium", promptTokens: 0, completionTokens: 1000, region: "FR" }
  };

  const response = await carbon.collectHandler(postRequest(JSON.stringify({ event })));

  assert.equal(response.status, 200);
  assert.equal(seen[0]?.result.breakdown?.gridIntensityGCO2ePerKWh, 51.9);
  assert.ok(seen[0]?.result.range);
});

test("collectHandler rejects unknown fields and out-of-range values with 400", async () => {
  const carbon = createNextCarbon();
  const cases = [
    { ...validEvent, input: { ...validEvent.input, injected: true } },
    { ...validEvent, input: { ...validEvent.input, bytesTransferred: -1 } },
    { ...validEvent, input: { ...validEvent.input, bytesTransferred: "1000" } },
    { type: "ai.usage", input: { provider: "openai", model: "x", promptTokens: 1.5, completionTokens: 0 } },
    { type: "ai.usage", input: { provider: "evil", model: "x", promptTokens: 1, completionTokens: 0 } },
    { ...validEvent, extra: 1 }
  ];

  for (const event of cases) {
    const response = await carbon.collectHandler(postRequest(JSON.stringify({ event })));
    assert.equal(response.status, 400, JSON.stringify(event));
  }
});

test("collectHandler answers 429 when rateLimit refuses, before reading the body", async () => {
  const carbon = createNextCarbon({ rateLimit: () => false });
  const response = await carbon.collectHandler(postRequest("{not json"));

  assert.equal(response.status, 429);
});

test("createMemoryRateLimiter allows the limit per key and window", () => {
  const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000 });
  const from = (address: string) =>
    new Request("https://example.test/api/carbon", {
      method: "POST",
      headers: { "x-forwarded-for": `${address}, 10.0.0.1` }
    });

  assert.equal(limiter(from("192.0.2.1")), true);
  assert.equal(limiter(from("192.0.2.1")), true);
  assert.equal(limiter(from("192.0.2.1")), false);
  assert.equal(limiter(from("192.0.2.2")), true);
});

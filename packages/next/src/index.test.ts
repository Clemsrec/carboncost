import assert from "node:assert/strict";
import test from "node:test";
import { createNextCarbon } from "./index.js";

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

import assert from "node:assert/strict";
import test from "node:test";

import { classifyEntry, isOpaque, routeForStartTime } from "./index.js";

const ORIGIN = "https://example.test";

function entry(overrides: Partial<Parameters<typeof classifyEntry>[0]> = {}) {
  return {
    name: `${ORIGIN}/app.js`,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    ...overrides
  };
}

test("transferred bytes short-circuit every other case", () => {
  assert.equal(classifyEntry(entry({ transferSize: 4200 }), ORIGIN), "transferred");

  // Even a cross-origin entry: an opaque response reports 0 everywhere.
  assert.equal(
    classifyEntry(
      entry({ name: "https://cdn.other.test/x.js", transferSize: 900, responseStatus: 0 }),
      ORIGIN
    ),
    "transferred"
  );
});

test("a cross-origin resource with TAO served from cache is known, not opaque", () => {
  // The trap: transferSize 0 with a real body. Testing "is it cross-origin?"
  // alone would file this as unknown even though we know its size exactly.
  const cached = entry({
    name: "https://cdn.other.test/font.woff2",
    transferSize: 0,
    encodedBodySize: 18_000,
    decodedBodySize: 18_000
  });

  assert.equal(classifyEntry(cached, ORIGIN), "cached");
});

test("Chromium's flat cached figure is still classified as cached", () => {
  const chromeCached = entry({ transferSize: 300, encodedBodySize: 1350, decodedBodySize: 3610 });

  // transferSize wins, so the 300 bytes are counted as reported rather than
  // normalised away.
  assert.equal(classifyEntry(chromeCached, ORIGIN), "transferred");
});

test("responseStatus 0 marks an opaque response", () => {
  const opaque = entry({ name: "https://firestore.googleapis.com/v1/x", responseStatus: 0 });

  assert.equal(classifyEntry(opaque, ORIGIN), "opaque");
});

test("a same-origin empty response is not opaque", () => {
  // 204, preflight, redirect. The naive "both body sizes are zero" test files
  // these as opaque and silently inflates the unknown count.
  const preflight = entry({ responseStatus: 204 });

  assert.equal(classifyEntry(preflight, ORIGIN), "empty");
});

test("without responseStatus, opacity falls back to comparing origins", () => {
  const sameOrigin = entry();
  const crossOrigin = entry({ name: "https://algolia.net/query" });

  assert.equal(isOpaque(sameOrigin, ORIGIN), false);
  assert.equal(isOpaque(crossOrigin, ORIGIN), true);
  assert.equal(classifyEntry(crossOrigin, ORIGIN), "opaque");
});

test("routeForStartTime attributes by timestamp, not by arrival order", () => {
  const timeline = [
    { route: "/", at: 0 },
    { route: "/petitions", at: 1000 }
  ];

  // A resource that started before the navigation belongs to the old route,
  // even though the observer delivers it after the route changed.
  assert.equal(routeForStartTime(timeline, 950), "/");
  assert.equal(routeForStartTime(timeline, 1000), "/petitions");
  assert.equal(routeForStartTime(timeline, 1200), "/petitions");

  // Anything predating the first mark falls to the first route.
  assert.equal(routeForStartTime(timeline, -5), "/");
  assert.equal(routeForStartTime([], 10), undefined);
});

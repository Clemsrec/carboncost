import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { observePage, type Measurement } from "./index.js";

const ORIGIN = "https://example.test";

interface FakeEntry {
  name: string;
  startTime: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  responseStatus?: number;
}

/**
 * Drives the collector without a browser: a fake observer we can feed entries
 * into, a clock we control, and an optional navigation entry.
 */
function withFakeBrowser(navigation?: FakeEntry) {
  const originals = {
    PerformanceObserver: globalThis.PerformanceObserver,
    performance: globalThis.performance,
    location: (globalThis as { location?: unknown }).location
  };

  let deliver: (entries: FakeEntry[]) => void = () => {};
  let now = 0;

  class FakeObserver {
    constructor(callback: (list: { getEntries: () => FakeEntry[] }) => void) {
      deliver = (entries) => callback({ getEntries: () => entries });
    }
    observe() {}
    disconnect() {}
  }

  (globalThis as { PerformanceObserver: unknown }).PerformanceObserver = FakeObserver;
  (globalThis as { performance: unknown }).performance = {
    now: () => now,
    getEntriesByType: (type: string) => (type === "navigation" && navigation ? [navigation] : [])
  };
  (globalThis as { location: unknown }).location = { origin: ORIGIN };

  return {
    deliver: (entries: FakeEntry[]) => deliver(entries),
    advanceClock: (to: number) => {
      now = to;
    },
    restore: () => {
      (globalThis as { PerformanceObserver: unknown }).PerformanceObserver =
        originals.PerformanceObserver;
      (globalThis as { performance: unknown }).performance = originals.performance;
      (globalThis as { location: unknown }).location = originals.location;
    }
  };
}

function entry(overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    name: `${ORIGIN}/app.js`,
    startTime: 0,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    ...overrides
  };
}

let running: { stop: () => void } | null = null;
afterEach(() => {
  running?.stop();
  running = null;
});

test("measurements are cumulative per route and debounced", async () => {
  const browser = withFakeBrowser();
  const seen: Measurement[] = [];

  try {
    const collector = observePage({ onMeasure: (m) => seen.push(m), debounceMs: 5 });
    running = collector;
    collector.setRoute("/");

    browser.deliver([
      entry({ transferSize: 1000 }),
      entry({ transferSize: 500 }),
      entry({ name: "https://algolia.net/q", responseStatus: 0 })
    ]);

    await new Promise((resolve) => setTimeout(resolve, 20));

    // One call, not three: the burst collapses into a single report.
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.bytesTransferred, 1500);
    assert.equal(seen[0]?.unknownRequests, 1);
    assert.deepEqual(seen[0]?.unknownOrigins, ["https://algolia.net"]);
    assert.equal(seen[0]?.requests, 3);
  } finally {
    browser.restore();
  }
});

test("a resource in flight during a navigation stays with the route it started in", async () => {
  const browser = withFakeBrowser();

  try {
    const collector = observePage({ onMeasure: () => {}, debounceMs: 1 });
    running = collector;

    collector.setRoute("/");
    browser.advanceClock(1000);
    collector.setRoute("/petitions");

    // Started at 900, delivered after the route changed at 1000.
    browser.deliver([
      entry({ startTime: 900, transferSize: 700 }),
      entry({ startTime: 1100, transferSize: 300 })
    ]);

    assert.equal(collector.read("/")?.bytesTransferred, 700);
    assert.equal(collector.read("/petitions")?.bytesTransferred, 300);
  } finally {
    browser.restore();
  }
});

test("the document is billed to the route in its own URL, not the open one", async () => {
  const navigation = entry({ name: `${ORIGIN}/petitions`, transferSize: 34_999 });
  const browser = withFakeBrowser(navigation);

  try {
    const collector = observePage({ onMeasure: () => {}, debounceMs: 1 });
    running = collector;

    // A late start: the collector opens "/" although the document was /petitions.
    collector.setRoute("/");

    assert.equal(collector.read("/")?.bytesTransferred, 0);
    assert.equal(collector.read("/petitions")?.bytesTransferred, 34_999);
  } finally {
    browser.restore();
  }
});

test("the navigation entry is counted once across soft navigations", async () => {
  const navigation = entry({ name: `${ORIGIN}/`, transferSize: 34_999 });
  const browser = withFakeBrowser(navigation);

  try {
    const collector = observePage({ onMeasure: () => {}, debounceMs: 1 });
    running = collector;

    collector.setRoute("/");
    browser.advanceClock(500);
    collector.setRoute("/petitions");
    browser.advanceClock(900);
    collector.setRoute("/");

    assert.equal(collector.read("/")?.bytesTransferred, 34_999);
  } finally {
    browser.restore();
  }
});

test("stop is idempotent and releases the single-collector lock", () => {
  const browser = withFakeBrowser();

  try {
    const first = observePage({ onMeasure: () => {}, debounceMs: 1 });
    assert.throws(() => observePage({ onMeasure: () => {} }), /already running/);

    first.stop();
    first.stop();

    const second = observePage({ onMeasure: () => {}, debounceMs: 1 });
    running = second;
    assert.ok(second);
  } finally {
    browser.restore();
  }
});

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
  deliveryType?: string;
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

test("revisiting a route opens a separate measurement instead of repeating the first", () => {
  const navigation = entry({ name: `${ORIGIN}/`, transferSize: 34_999 });
  const browser = withFakeBrowser(navigation);

  try {
    const collector = observePage({ onMeasure: () => {}, debounceMs: 1 });
    running = collector;

    collector.setRoute("/");
    browser.advanceClock(500);
    collector.setRoute("/petitions");
    browser.deliver([entry({ startTime: 600, transferSize: 7_131 })]);
    browser.advanceClock(900);
    collector.setRoute("/");
    browser.deliver([entry({ startTime: 950, transferSize: 1_200 })]);

    const all = collector.readAll();

    // Three openings, three measurements. Keying by route name made the second
    // visit re-emit the first one's running total and inflated the session.
    assert.equal(all.length, 3);
    assert.deepEqual(
      all.map((m) => [m.route, m.bytesTransferred]),
      [
        ["/", 34_999],
        ["/petitions", 7_131],
        ["/", 1_200]
      ]
    );

    // The session total is the real one, not the first visit counted twice.
    assert.equal(
      all.reduce((sum, m) => sum + m.bytesTransferred, 0),
      43_330
    );

    // And coming back is visibly cheaper, which deduplicating by route hides.
    assert.ok(all[2]!.bytesTransferred < all[0]!.bytesTransferred);
  } finally {
    browser.restore();
  }
});

test("the navigation entry is counted once, on its own route", () => {
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

    const total = collector
      .readAll()
      .reduce((sum, measurement) => sum + measurement.bytesTransferred, 0);

    assert.equal(total, 34_999);
  } finally {
    browser.restore();
  }
});

test("a Chromium cache hit is counted as cached even though it reports bytes", () => {
  const browser = withFakeBrowser();

  try {
    const collector = observePage({ onMeasure: () => {}, debounceMs: 1 });
    running = collector;
    collector.setRoute("/");

    browser.deliver([
      // Chromium: a flat ~300 bytes with deliveryType "cache".
      entry({ transferSize: 300, encodedBodySize: 1350, decodedBodySize: 3610, deliveryType: "cache" }),
      entry({ transferSize: 300, encodedBodySize: 900, decodedBodySize: 2400, deliveryType: "cache" }),
      // A real network fetch reports an empty deliveryType.
      entry({ transferSize: 5_000, encodedBodySize: 4_800, decodedBodySize: 12_000, deliveryType: "" }),
      // An engine without deliveryType, reporting a true zero transfer.
      entry({ transferSize: 0, encodedBodySize: 2_048, decodedBodySize: 6_000 })
    ]);

    const measurement = collector.read("/");

    // Folding cache into the byte-class enum made this structurally zero on the
    // one engine the behaviour was documented against.
    assert.equal(measurement?.cachedRequests, 3);
    // Bytes are still counted exactly as reported, including Chromium's 300s.
    assert.equal(measurement?.bytesTransferred, 5_600);
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

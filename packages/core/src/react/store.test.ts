import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { getServerSnapshot, getSnapshot, resetStoreForTests, setRoute, subscribe } from "./store.js";

const ORIGIN = "https://example.test";

interface FakeEntry {
  name: string;
  startTime: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  responseStatus?: number;
}

let deliver: (entries: FakeEntry[]) => void = () => {};
let disconnects = 0;

function installFakeBrowser() {
  disconnects = 0;

  class FakeObserver {
    constructor(callback: (list: { getEntries: () => FakeEntry[] }) => void) {
      deliver = (entries) => callback({ getEntries: () => entries });
    }
    observe() {}
    disconnect() {
      disconnects += 1;
    }
  }

  (globalThis as { PerformanceObserver: unknown }).PerformanceObserver = FakeObserver;
  (globalThis as { performance: unknown }).performance = {
    now: () => 0,
    getEntriesByType: () => []
  };
  (globalThis as { location: unknown }).location = { origin: ORIGIN };
}

afterEach(() => {
  resetStoreForTests();
});

test("the server snapshot is stable, so hydration has nothing to mismatch on", () => {
  assert.equal(getServerSnapshot(), getServerSnapshot());
  assert.deepEqual(getServerSnapshot(), { current: undefined, routes: [] });
});

test("several subscribers share one collector", async () => {
  installFakeBrowser();

  const first = subscribe(() => {}, { debounceMs: 1 });
  const second = subscribe(() => {}, { debounceMs: 1 });
  const third = subscribe(() => {}, { debounceMs: 1 });

  // The primitive throws on a second observePage(). Three badges in three
  // layouts must not be able to trigger that.
  setRoute("/");
  deliver([
    {
      name: `${ORIGIN}/app.js`,
      startTime: 0,
      transferSize: 1200,
      encodedBodySize: 1200,
      decodedBodySize: 3000
    }
  ]);

  // The snapshot updates on the debounced flush, not on delivery.
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(getSnapshot().current?.bytesTransferred, 1200);

  first();
  second();
  // Still one subscriber, so the collector is still running.
  assert.equal(disconnects, 0);

  third();
  assert.equal(disconnects, 1);
});

test("releasing the same subscription twice does not double-decrement", () => {
  installFakeBrowser();

  const release = subscribe(() => {}, { debounceMs: 1 });
  const other = subscribe(() => {}, { debounceMs: 1 });

  release();
  release();

  // If the double release had counted twice, the collector would already be
  // stopped and the remaining subscriber would be reading a dead store.
  assert.equal(disconnects, 0);

  other();
  assert.equal(disconnects, 1);
});

test("subscribers are notified when a route is opened", () => {
  installFakeBrowser();

  let notifications = 0;
  const release = subscribe(() => {
    notifications += 1;
  }, { debounceMs: 1 });

  setRoute("/");
  setRoute("/petitions");

  assert.ok(notifications >= 2);
  assert.equal(getSnapshot().routes.length, 2);
  assert.equal(getSnapshot().current?.route, "/petitions");

  release();
});

test("the snapshot keeps its identity between reads", () => {
  installFakeBrowser();

  const release = subscribe(() => {}, { debounceMs: 1 });
  setRoute("/");

  // useSyncExternalStore compares by reference and loops forever on a snapshot
  // that is rebuilt on every read.
  assert.equal(getSnapshot(), getSnapshot());

  release();
});

/**
 * A single shared collector for the whole app, reference counted.
 *
 * `observePage()` refuses to run twice, because `buffered: true` replays history
 * and a second collector would count everything twice. That is the right rule
 * for the primitive, but a React app puts badges in several places at once — a
 * footer per layout, say — and each of them wants the numbers. So the React
 * layer owns exactly one collector and hands every subscriber the same snapshot.
 *
 * Nothing here runs at import time.
 */
import { observePage, type Measurement, type PageCollector } from "../browser/index.js";

export interface CarbonSnapshot {
  /** Measurement for the route currently open, if any. */
  current: Measurement | undefined;
  /** Every route measured since the collector started. */
  routes: Measurement[];
}

const EMPTY: CarbonSnapshot = { current: undefined, routes: [] };

let collector: PageCollector | null = null;
let subscribers = 0;
let snapshot: CarbonSnapshot = EMPTY;
const listeners = new Set<() => void>();

function publish(): void {
  const routes = collector?.readAll() ?? [];
  // useSyncExternalStore compares snapshots by reference, so a new object is
  // only created when something actually changed.
  snapshot = { current: routes[routes.length - 1], routes };
  for (const listener of listeners) {
    listener();
  }
}

export function getSnapshot(): CarbonSnapshot {
  return snapshot;
}

/** Server snapshot: stable and empty, so hydration has nothing to mismatch on. */
export function getServerSnapshot(): CarbonSnapshot {
  return EMPTY;
}

export interface AcquireOptions {
  debounceMs?: number;
}

/**
 * Starts the collector on the first subscriber and stops it when the last one
 * leaves. Returns an unsubscribe function.
 */
export function subscribe(listener: () => void, options: AcquireOptions = {}): () => void {
  listeners.add(listener);
  subscribers += 1;

  if (!collector && typeof PerformanceObserver !== "undefined") {
    collector = observePage({
      onMeasure: publish,
      ...(options.debounceMs === undefined ? {} : { debounceMs: options.debounceMs })
    });
  }

  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;
    listeners.delete(listener);
    subscribers -= 1;

    if (subscribers <= 0) {
      subscribers = 0;
      collector?.stop();
      collector = null;
      snapshot = EMPTY;
    }
  };
}

export function setRoute(route: string): void {
  collector?.setRoute(route);
  publish();
}

/** Test seam: drops all state so cases can run independently. */
export function resetStoreForTests(): void {
  collector?.stop();
  collector = null;
  subscribers = 0;
  snapshot = EMPTY;
  listeners.clear();
}

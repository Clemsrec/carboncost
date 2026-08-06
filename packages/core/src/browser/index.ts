/**
 * Browser-side measurement collector.
 *
 * This module observes what the page actually transferred and reports it. It
 * sends nothing, writes no cookie, and touches no storage — the tally lives in
 * memory and disappears with the tab. Nothing here runs at import time either,
 * so the module is safe to import from code that also renders on a server.
 *
 * Its output maps onto `trackPageview()` without transformation.
 */
import { classifyEntry, isCached, originOf, type TimingLike } from "./classify.js";

export { classifyEntry, isCached, isOpaque, originOf } from "./classify.js";
export type { EntryClass, TimingLike } from "./classify.js";

export interface Measurement {
  route: string;
  /** Bytes observed crossing the network, cumulative for this route. */
  bytesTransferred: number;
  /** Resources whose size the browser refused to disclose. */
  unknownRequests: number;
  /** Which origins those were, deduplicated — "Firestore", not "4 requests". */
  unknownOrigins: string[];
  /**
   * Resources served from cache.
   *
   * Counted as the browser reports them, never normalised: Chromium returns a
   * flat ~300 bytes per cached resource where other engines return 0. Those
   * bytes are included in `bytesTransferred` as reported. Subtracting a
   * hardcoded constant would turn a browser quirk into an invented number the
   * day Chromium changes it, so the divergence is surfaced instead.
   */
  cachedRequests: number;
  /** Every entry attributed to this route, whatever its class. */
  requests: number;
}

export interface ObservePageOptions {
  /**
   * Called with the cumulative measurement for a route whenever it changes.
   * Debounced, so a burst of resources produces one call rather than dozens.
   */
  onMeasure: (measurement: Measurement) => void;
  /** Quiet period before reporting, in milliseconds. Defaults to 250. */
  debounceMs?: number;
  /** Route to open immediately. Otherwise the first `setRoute()` opens one. */
  initialRoute?: string;
}

export interface PageCollector {
  /**
   * Opens a route. Push, not pull: the collector cannot know when a client-side
   * navigation happens, and in frameworks that swap the path during render a
   * getter read on resource arrival would be consulted at arbitrary moments.
   */
  setRoute: (route: string) => void;
  /** Current measurement for a route, or for the open one if omitted. */
  read: (route?: string) => Measurement | undefined;
  /** All routes measured so far, in the order they were opened. */
  readAll: () => Measurement[];
  /** Idempotent. Safe to call from a component cleanup that may run twice. */
  stop: () => void;
}

interface RouteMark {
  route: string;
  at: number;
}

function emptyMeasurement(route: string): Measurement {
  return {
    route,
    bytesTransferred: 0,
    unknownRequests: 0,
    unknownOrigins: [],
    cachedRequests: 0,
    requests: 0
  };
}

/**
 * Finds which route opening was current when an entry started.
 *
 * Returns an index into the timeline, not a route name: revisiting a route
 * opens a new entry in the timeline, and its bytes must accumulate separately
 * from the earlier visit. Keying by route name instead made every revisit
 * re-emit the first visit's running total.
 *
 * Attribution goes by the entry's own `startTime`, not by arrival order in the
 * observer callback. The callback is batched, so crediting "the currently open
 * route" misfiles every resource still in flight when a navigation happens.
 */
export function visitIndexForStartTime(timeline: RouteMark[], startTime: number): number {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const mark = timeline[index];
    if (mark && mark.at <= startTime) {
      return index;
    }
  }

  return timeline.length > 0 ? 0 : -1;
}

/** Route name for a start time. Thin wrapper over {@link visitIndexForStartTime}. */
export function routeForStartTime(timeline: RouteMark[], startTime: number): string | undefined {
  const index = visitIndexForStartTime(timeline, startTime);
  return index < 0 ? undefined : timeline[index]?.route;
}

let active: PageCollector | null = null;

/**
 * Starts observing. Only one collector may run at a time: `buffered: true`
 * replays history, so a second collector would count everything twice. This is
 * enforced explicitly rather than silently — call `stop()` before starting
 * another.
 */
export function observePage(options: ObservePageOptions): PageCollector {
  if (active) {
    throw new Error(
      "carbone-cost: a page collector is already running. Call stop() on it before starting another, or reuse it."
    );
  }

  if (typeof performance === "undefined" || typeof PerformanceObserver === "undefined") {
    throw new Error(
      "carbone-cost: observePage() requires a browser environment with PerformanceObserver."
    );
  }

  const debounceMs = options.debounceMs ?? 250;
  const pageOrigin = typeof location !== "undefined" ? location.origin : "http://localhost";

  const timeline: RouteMark[] = [];
  // One measurement per route opening, parallel to the timeline. A second visit
  // to the same route is a separate measurement, which is what makes "coming
  // back costs less" observable at all.
  const visits: Measurement[] = [];
  const dirty = new Set<number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let observer: PerformanceObserver | null = null;
  let navigationCounted = false;
  let stopped = false;

  function copy(measurement: Measurement): Measurement {
    return { ...measurement, unknownOrigins: [...measurement.unknownOrigins] };
  }

  function flush(): void {
    timer = null;
    for (const index of dirty) {
      const measurement = visits[index];
      if (measurement) {
        options.onMeasure(copy(measurement));
      }
    }
    dirty.clear();
  }

  function schedule(index: number): void {
    dirty.add(index);
    if (timer === null) {
      timer = setTimeout(flush, debounceMs);
    }
  }

  function record(entry: TimingLike & { startTime: number }, forcedIndex?: number): void {
    const index = forcedIndex ?? visitIndexForStartTime(timeline, entry.startTime);
    const measurement = index < 0 ? undefined : visits[index];
    if (!measurement) {
      return;
    }

    measurement.requests += 1;

    // Cache is an independent axis from byte accounting: on Chromium a cache hit
    // reports ~300 transferred bytes, so it counts as transferred *and* cached.
    if (isCached(entry)) {
      measurement.cachedRequests += 1;
    }

    switch (classifyEntry(entry, pageOrigin)) {
      case "transferred":
      case "cached":
        // Counted as reported, never normalised.
        measurement.bytesTransferred += entry.transferSize;
        break;
      case "opaque": {
        measurement.unknownRequests += 1;
        const origin = originOf(entry.name, pageOrigin);
        if (origin && !measurement.unknownOrigins.includes(origin)) {
          measurement.unknownOrigins.push(origin);
          measurement.unknownOrigins.sort();
        }
        break;
      }
      case "empty":
        break;
    }

    schedule(index);
  }

  /**
   * The document itself is not a "resource": it has its own entry type, which
   * `buffered: true` does not replay, so it has to be fetched explicitly.
   *
   * It is billed to the route in its own URL rather than to whichever route
   * happens to be open, so a collector that starts late — lazy hydration, a
   * client redirect before the first setRoute — does not charge the document's
   * bytes to the wrong page. It is counted once: a client-side navigation
   * produces no navigation entry, and neither does a bfcache restore.
   */
  function countNavigation(): void {
    if (navigationCounted) {
      return;
    }

    const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (!navigation) {
      return;
    }

    navigationCounted = true;
    const documentRoute = (() => {
      try {
        return new URL(navigation.name, pageOrigin).pathname;
      } catch {
        return undefined;
      }
    })();

    if (documentRoute === undefined) {
      return;
    }

    // Opened at t=0 so it precedes every route change and every resource.
    record(navigation, openVisit(documentRoute, 0));
  }

  function openVisit(route: string, at: number): number {
    timeline.push({ route, at });
    visits.push(emptyMeasurement(route));
    return timeline.length - 1;
  }

  const collector: PageCollector = {
    setRoute(route: string) {
      if (stopped) {
        return;
      }

      // Seed the document's own route first, at t=0, so its bytes land on the
      // page that was actually loaded even if the first setRoute names another.
      countNavigation();

      if (timeline[timeline.length - 1]?.route === route) {
        schedule(timeline.length - 1);
        return;
      }

      schedule(openVisit(route, performance.now()));
    },

    read(route?: string) {
      if (route === undefined) {
        const current = visits[visits.length - 1];
        return current ? copy(current) : undefined;
      }

      for (let index = visits.length - 1; index >= 0; index -= 1) {
        const visit = visits[index];
        if (visit?.route === route) {
          return copy(visit);
        }
      }

      return undefined;
    },

    readAll() {
      return visits.map(copy);
    },

    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      observer?.disconnect();
      observer = null;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (active === collector) {
        active = null;
      }
    }
  };

  // PerformanceObserver rather than getEntriesByType for resources: the resource
  // buffer is capped and evicts its oldest entries without warning.
  observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      record(entry as PerformanceResourceTiming);
    }
  });
  observer.observe({ type: "resource", buffered: true });

  active = collector;

  if (options.initialRoute !== undefined) {
    collector.setRoute(options.initialRoute);
  }

  return collector;
}

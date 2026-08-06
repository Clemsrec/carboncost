/**
 * React bindings.
 *
 * React is an optional peer dependency: importing `carbone-cost` or
 * `carbone-cost/browser` never pulls it in. Only this subpath needs it.
 *
 * The route is passed in rather than read from a router, so nothing here is tied
 * to a particular framework. In the Next.js App Router that means
 * `useCarbon({ route: usePathname() })`.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { trackPageview } from "../estimation.js";
import { aggregateSession, type SessionAggregation } from "../display.js";
import type { WebPageviewEvent, WebPageviewInput } from "../types.js";
import type { Measurement } from "../browser/index.js";
import {
  getServerSnapshot,
  getSnapshot,
  setRoute as setStoreRoute,
  subscribe as subscribeToStore
} from "./store.js";

export type { CarbonSnapshot } from "./store.js";

export interface UseCarbonOptions
  extends Pick<
    WebPageviewInput,
    "greenHosting" | "greenHostingFactor" | "gridIntensityGCO2ePerKWh" | "factorGPerGB"
  > {
  /** Current route. Pass your router's value, e.g. `usePathname()`. */
  route: string;
  /** Quiet period before a measurement is reported, in milliseconds. */
  debounceMs?: number;
}

export interface UseCarbonResult {
  /** Raw measurement for the current route, before any estimation. */
  measurement: Measurement | undefined;
  /** Estimated event for the current route. */
  event: WebPageviewEvent | undefined;
  /** One event per route measured this session. */
  events: WebPageviewEvent[];
  /** Session totals across those events. */
  session: SessionAggregation;
  /** Requests whose size the browser hid, across the session. */
  unknownRequests: number;
  /** Which origins those were, deduplicated across routes. */
  unknownOrigins: string[];
}

/**
 * Measures the current route and estimates its footprint.
 *
 * Several components may call this at once — a badge in each layout, a detail
 * page — and they share one collector rather than each starting their own.
 */
export function useCarbon(options: UseCarbonOptions): UseCarbonResult {
  const { route, debounceMs } = options;

  const subscribe = useCallback(
    (listener: () => void) =>
      subscribeToStore(listener, debounceMs === undefined ? {} : { debounceMs }),
    [debounceMs]
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The route is pushed, never polled: the collector cannot know when a
  // client-side navigation happens, and reading a router value on resource
  // arrival would sample it at arbitrary moments.
  useEffect(() => {
    setStoreRoute(route);
  }, [route]);

  const estimationInputs = {
    ...(options.greenHosting === undefined ? {} : { greenHosting: options.greenHosting }),
    ...(options.greenHostingFactor === undefined
      ? {}
      : { greenHostingFactor: options.greenHostingFactor }),
    ...(options.gridIntensityGCO2ePerKWh === undefined
      ? {}
      : { gridIntensityGCO2ePerKWh: options.gridIntensityGCO2ePerKWh }),
    ...(options.factorGPerGB === undefined ? {} : { factorGPerGB: options.factorGPerGB })
  };

  const serialisedInputs = JSON.stringify(estimationInputs);

  return useMemo(() => {
    const inputs = JSON.parse(serialisedInputs) as Partial<WebPageviewInput>;

    const events = snapshot.routes.map((measurement) =>
      trackPageview({
        route: measurement.route,
        bytesTransferred: measurement.bytesTransferred,
        unknownRequests: measurement.unknownRequests,
        unknownOrigins: measurement.unknownOrigins,
        cachedRequests: measurement.cachedRequests,
        ...inputs
      })
    );

    const unknownOrigins = [
      ...new Set(snapshot.routes.flatMap((measurement) => measurement.unknownOrigins))
    ].sort();

    return {
      measurement: snapshot.current,
      event: events[events.length - 1],
      events,
      session: aggregateSession(events),
      unknownRequests: snapshot.routes.reduce(
        (total, measurement) => total + measurement.unknownRequests,
        0
      ),
      unknownOrigins
    };
  }, [snapshot, serialisedInputs]);
}

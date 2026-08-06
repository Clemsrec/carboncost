/**
 * Classification of a single Resource Timing entry.
 *
 * Nothing here touches a global, so it is safe to import on a server and easy
 * to test without a DOM.
 */

export type EntryClass =
  /** Bytes actually crossed the network and we know how many. */
  | "transferred"
  /** Served from cache. Size known, network cost nil. */
  | "cached"
  /** Cross-origin without Timing-Allow-Origin. Size hidden from us. */
  | "opaque"
  /** A legitimately empty response: 204, preflight, redirect. Costs nothing. */
  | "empty";

/** The subset of PerformanceResourceTiming this module reads. */
export interface TimingLike {
  name: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  /** Chromium exposes this; Safari does not. 0 means an opaque response. */
  responseStatus?: number;
  /** `""` on a real network fetch, `"cache"` on a cache hit. Not everywhere yet. */
  deliveryType?: string;
}

/**
 * Whether a resource came from cache.
 *
 * This is a separate axis from `classifyEntry`, not one of its cases. "Served
 * from cache" and "reported transferred bytes" do not exclude each other:
 * Chromium reports a flat ~300 bytes for a cache hit, so a cache-hit entry
 * classifies as `transferred` for byte accounting while still being cached.
 * Folding the two into one enum made the cached count structurally zero on the
 * one engine the behaviour was documented against.
 *
 * `deliveryType` is authoritative where present. The fallback covers engines
 * that do not expose it yet, where a cache hit really does report zero transfer
 * alongside a non-empty body.
 */
export function isCached(entry: TimingLike): boolean {
  if (typeof entry.deliveryType === "string" && entry.deliveryType !== "") {
    return entry.deliveryType === "cache";
  }

  return entry.transferSize === 0 && (entry.encodedBodySize > 0 || entry.decodedBodySize > 0);
}

/**
 * Decides whether a resource was hidden from us.
 *
 * `responseStatus === 0` is the precise signal, but Safari does not expose the
 * field at all. The fallback compares origins, which is enough because callers
 * only reach this branch once the cached case has been excluded — a
 * cross-origin resource with a valid Timing-Allow-Origin header served from
 * cache reports a body size, so it never gets here.
 */
export function isOpaque(entry: TimingLike, pageOrigin: string): boolean {
  if (typeof entry.responseStatus === "number") {
    return entry.responseStatus === 0;
  }

  try {
    return new URL(entry.name, pageOrigin).origin !== pageOrigin;
  } catch {
    // A name that is not a parseable URL (some blob: and data: forms).
    return false;
  }
}

/**
 * Four cases, in this order. `transferSize > 0` short-circuits safely: an
 * opaque response reports 0 everywhere, by definition of the masking, so a
 * resource that reports transferred bytes cannot be opaque.
 *
 * The order matters for one case in particular: a cross-origin resource with
 * Timing-Allow-Origin, served from cache. It reports `transferSize: 0` with a
 * non-zero body, and an opacity test reduced to "is it cross-origin?" would
 * file it as unknown even though its size is known and its network cost is nil.
 */
export function classifyEntry(entry: TimingLike, pageOrigin: string): EntryClass {
  if (entry.transferSize > 0) {
    return "transferred";
  }

  if (entry.encodedBodySize > 0 || entry.decodedBodySize > 0) {
    return "cached";
  }

  return isOpaque(entry, pageOrigin) ? "opaque" : "empty";
}

export function originOf(name: string, pageOrigin: string): string | undefined {
  try {
    return new URL(name, pageOrigin).origin;
  } catch {
    return undefined;
  }
}

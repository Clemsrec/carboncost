import type { CarbonRange, CarbonResult } from "./types.js";

function round(value: number, precision = 6): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

/**
 * Adds up the bounds of several results. A result without bounds counts at its
 * central value on both sides; when none has bounds there is no range to report.
 * Summing bounds assumes they move together, which they do: every event shares
 * the same factors.
 */
export function sumRanges(results: CarbonResult[]): CarbonRange | undefined {
  if (!results.some((result) => result.range)) {
    return undefined;
  }

  let low = 0;
  let high = 0;
  for (const result of results) {
    low += result.range?.low ?? result.gramsCO2e;
    high += result.range?.high ?? result.gramsCO2e;
  }

  return { low: round(low), high: round(high) };
}

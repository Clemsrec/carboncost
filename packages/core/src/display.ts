import type { CarbonResult, WebPageviewEvent } from "./types.js";

export type CarbonDisplayCategory = "very-low" | "low" | "medium" | "high";

export interface CarbonDisplay {
  gramsPerView: number;
  gramsPerViewRounded: number;
  gramsPerThousandViews: number;
  category: CarbonDisplayCategory;
  methodologyVersion: string;
}

export interface FormatOptions {
  minDisplayGrams?: number;
}

export interface SessionAggregation {
  totalGrams: number;
  totalViews: number;
  averageGramsPerView: number;
}

const DEFAULT_MIN_DISPLAY_GRAMS = 0.001;

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

/**
 * Indicative bands in grams of CO2e per single pageview. At the model's default
 * intensity these correspond to page weights of roughly 700 KB, 2.4 MB and
 * 4.7 MB. They are a readability aid for UI surfaces, not a certification scale.
 *
 * The previous thresholds were expressed per 1,000 views and calibrated against
 * an intensity that was wrong by more than two orders of magnitude, so every
 * real page landed in "very-low".
 */
function getDisplayCategory(gramsPerView: number): CarbonDisplayCategory {
  if (gramsPerView < 0.1) {
    return "very-low";
  }

  if (gramsPerView < 0.35) {
    return "low";
  }

  if (gramsPerView < 0.7) {
    return "medium";
  }

  return "high";
}

export function formatForDisplay(
  result: CarbonResult,
  options: FormatOptions = {}
): CarbonDisplay {
  const minDisplayGrams = options.minDisplayGrams ?? DEFAULT_MIN_DISPLAY_GRAMS;
  const gramsPerView = result.gramsCO2e;
  const gramsPerViewRounded = gramsPerView < minDisplayGrams ? 0 : round(gramsPerView, 3);
  const gramsPerThousandViews = round(gramsPerView * 1000, 3);

  return {
    gramsPerView,
    gramsPerViewRounded,
    gramsPerThousandViews,
    category: getDisplayCategory(gramsPerView),
    methodologyVersion: result.methodology.methodologyVersion
  };
}

export function aggregateSession(events: WebPageviewEvent[]): SessionAggregation {
  const totalViews = events.length;
  const totalGrams = round(
    events.reduce((sum, event) => sum + event.result.gramsCO2e, 0),
    6
  );

  return {
    totalGrams,
    totalViews,
    averageGramsPerView: totalViews === 0 ? 0 : round(totalGrams / totalViews, 6)
  };
}
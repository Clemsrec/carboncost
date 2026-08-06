import type { CarbonEvent, CarbonResult, WebPageviewEvent } from "./types.js";

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
  /** Every event in the session, web and AI. */
  totalGrams: number;
  /** Pageview events only. */
  pageviewGrams: number;
  /** Everything that is not a pageview. */
  aiGrams: number;
  totalViews: number;
  /** `pageviewGrams` divided by `totalViews`. */
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

/**
 * Sums a session's events. Accepts any `CarbonEvent`, so AI usage counts toward
 * the session total, while `totalViews` and the per-view average stay based on
 * pageviews alone — dividing a total that includes inference by a pageview count
 * would be meaningless.
 */
export function aggregateSession(events: CarbonEvent[]): SessionAggregation {
  const pageviews = events.filter(
    (event): event is WebPageviewEvent => event.type === "web.pageview"
  );

  const totalGrams = round(
    events.reduce((sum, event) => sum + event.result.gramsCO2e, 0),
    6
  );
  const pageviewGrams = round(
    pageviews.reduce((sum, event) => sum + event.result.gramsCO2e, 0),
    6
  );

  const totalViews = pageviews.length;

  return {
    totalGrams,
    totalViews,
    pageviewGrams,
    aiGrams: round(totalGrams - pageviewGrams, 6),
    averageGramsPerView: totalViews === 0 ? 0 : round(pageviewGrams / totalViews, 6)
  };
}
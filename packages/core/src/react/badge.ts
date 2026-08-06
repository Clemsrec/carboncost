/**
 * A minimal footer badge.
 *
 * Written with `createElement` rather than JSX on purpose: the package needs no
 * JSX transform anywhere else, and adding one would put a build-time dependency
 * on React types in front of every consumer, including those who never import
 * this subpath.
 *
 * It ships no styles beyond a couple of inline defaults. A carbon badge lives in
 * someone else's footer, and a library that arrives with opinions about borders
 * and colours gets reimplemented rather than used.
 */
import { createElement, type ReactElement } from "react";

import { formatForDisplay, type CarbonDisplayCategory } from "../display.js";
import { toEquivalents } from "../equivalents.js";
import { useCarbon, type UseCarbonOptions } from "./index.js";

export interface CarbonBadgeProps extends UseCarbonOptions {
  /** BCP 47 locale for number formatting. Defaults to "en". */
  locale?: string;
  /** Where the badge links to, typically a page explaining the method. */
  href?: string;
  /** Rendered before the figure. Defaults to nothing. */
  label?: string;
  className?: string;
  /**
   * Full control over the text. Receives the session total in grams, its
   * display category, and the same equivalents the default rendering uses.
   */
  children?: (state: {
    grams: number;
    category: CarbonDisplayCategory;
    trainDisplay: string;
    unknownRequests: number;
  }) => ReactElement | string | null;
}

const DOT_COLOURS: Record<CarbonDisplayCategory, string> = {
  "very-low": "#1a7f37",
  low: "#3fb950",
  medium: "#d29922",
  high: "#cf222e"
};

export function CarbonBadge(props: CarbonBadgeProps): ReactElement | null {
  const { locale = "en", href, label, className, children, ...carbonOptions } = props;
  const { session, event, unknownRequests } = useCarbon(carbonOptions);

  // Render nothing until there is something true to say.
  if (!event || session.totalGrams <= 0) {
    return null;
  }

  const display = formatForDisplay(event.result);
  const equivalents = toEquivalents(session.totalGrams, { locale });
  const grams = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
    session.totalGrams
  );

  if (children) {
    const rendered = children({
      grams: session.totalGrams,
      category: display.category,
      trainDisplay: equivalents.trainKmDisplay,
      unknownRequests
    });
    return createElement(
      "span",
      { className, "data-carbon-category": display.category },
      rendered
    );
  }

  const dot = createElement("span", {
    "aria-hidden": true,
    style: {
      display: "inline-block",
      width: "0.5em",
      height: "0.5em",
      marginInlineEnd: "0.4em",
      borderRadius: "50%",
      background: DOT_COLOURS[display.category]
    }
  });

  const text = `${label ? `${label} ` : ""}${grams} g CO2e`;
  const content = [dot, text];

  return createElement(
    "span",
    { className, "data-carbon-category": display.category },
    href
      ? createElement("a", { href, style: { color: "inherit" } }, content)
      : createElement("span", null, content)
  );
}

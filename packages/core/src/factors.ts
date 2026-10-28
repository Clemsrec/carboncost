/**
 * Every constant that turns activity into energy or carbon, with where it comes
 * from. Values that change the result for the same input must bump the
 * methodology version in `methodology.ts`.
 */

export interface SourcedValue {
  value: number;
  unit: string;
  source: string;
  url: string;
  /** Year the value describes. */
  year: string;
  /** Day the value was read from the source. */
  retrievedAt: string;
}

export interface GridRegion {
  code: string;
  label: string;
  gCO2ePerKWh: number;
}

/**
 * Lifecycle carbon intensity of electricity by country, rounded to the unit:
 * combustion plus fuel supply and plant construction, all greenhouse gases,
 * production-based. Same table as Carbon Watch, so both tools bill a kilowatt
 * hour in a given country identically.
 *
 * France is the exception: it uses the ADEME Base Carbone factor, the reference
 * a French audience will be checked against.
 */
export const GRID_INTENSITY_SOURCE: SourcedValue = {
  value: 458,
  unit: "gCO2e/kWh",
  source:
    "Ember yearly electricity data (21 April 2026 edition), lifecycle intensity, via Our World in Data (30 June 2026 release)",
  url: "https://ourworldindata.org/grapher/carbon-intensity-electricity",
  year: "2025",
  retrievedAt: "2026-09-30"
};

export const FRANCE_GRID_INTENSITY: SourcedValue = {
  value: 51.9,
  unit: "gCO2e/kWh",
  source:
    "ADEME Base Carbone open data (updated 3 July 2025), electricity mix France 2024, lifecycle: combustion 35, upstream 13.1, transport and distribution 3.8",
  url: "https://data.ademe.fr/datasets/base-carboner",
  year: "2024",
  retrievedAt: "2026-10-28"
};

export const GRID_REGIONS: readonly GridRegion[] = [
  { code: "FR", label: "France", gCO2ePerKWh: FRANCE_GRID_INTENSITY.value },
  { code: "NO", label: "Norway", gCO2ePerKWh: 28 },
  { code: "SE", label: "Sweden", gCO2ePerKWh: 35 },
  { code: "CH", label: "Switzerland", gCO2ePerKWh: 39 },
  { code: "FI", label: "Finland", gCO2ePerKWh: 57 },
  { code: "BR", label: "Brazil", gCO2ePerKWh: 110 },
  { code: "DK", label: "Denmark", gCO2ePerKWh: 114 },
  { code: "AT", label: "Austria", gCO2ePerKWh: 117 },
  { code: "BE", label: "Belgium", gCO2ePerKWh: 150 },
  { code: "ES", label: "Spain", gCO2ePerKWh: 154 },
  { code: "CA", label: "Canada", gCO2ePerKWh: 191 },
  { code: "EU", label: "European Union", gCO2ePerKWh: 210 },
  { code: "GB", label: "United Kingdom", gCO2ePerKWh: 217 },
  { code: "NL", label: "Netherlands", gCO2ePerKWh: 254 },
  { code: "IE", label: "Ireland", gCO2ePerKWh: 257 },
  { code: "IT", label: "Italy", gCO2ePerKWh: 285 },
  { code: "DE", label: "Germany", gCO2ePerKWh: 330 },
  { code: "US", label: "United States", gCO2ePerKWh: 384 },
  { code: "KR", label: "South Korea", gCO2ePerKWh: 417 },
  { code: "AE", label: "United Arab Emirates", gCO2ePerKWh: 468 },
  { code: "JP", label: "Japan", gCO2ePerKWh: 477 },
  { code: "SG", label: "Singapore", gCO2ePerKWh: 497 },
  { code: "AU", label: "Australia", gCO2ePerKWh: 525 },
  { code: "CN", label: "China", gCO2ePerKWh: 525 },
  { code: "PL", label: "Poland", gCO2ePerKWh: 589 },
  { code: "IN", label: "India", gCO2ePerKWh: 670 },
  { code: "SA", label: "Saudi Arabia", gCO2ePerKWh: 692 },
  { code: "WORLD", label: "World", gCO2ePerKWh: GRID_INTENSITY_SOURCE.value }
];

const GRID_BY_CODE = new Map(GRID_REGIONS.map((region) => [region.code, region.gCO2ePerKWh]));

/** Intensity for a region code (ISO 3166 alpha-2, `EU` or `WORLD`), case-insensitive. */
export function gridIntensityForRegion(code: string): number | undefined {
  return GRID_BY_CODE.get(code.trim().toUpperCase());
}

/**
 * Where an AI request is computed when the caller does not say. A region the
 * table does not know falls back to the world average, never to the cleanest
 * grid. Same defaults as the Carbon Watch registry.
 */
export const AI_PROVIDER_DEFAULT_REGION: Record<string, string> = {
  openai: "US",
  anthropic: "US",
  google: "US",
  mistral: "EU",
  other: "WORLD"
};

/**
 * Inference energy, carried over from Carbon Watch (method of 2026-10-27), where
 * each value and bound is sourced in `docs/03-produit-methode/sensibilite.md`.
 *
 * - `whPer1kOutputTokens`: server energy per 1,000 generated tokens, before PUE,
 *   for a frontier-class chat model. Geometric middle of four sources (CLEER
 *   2026, Elsworth et al. arXiv:2508.15734, EcoLogits 0.11.3, Jegham et al.
 *   arXiv:2505.09598).
 * - `inputTokenEnergyRatio` (c): energy of a token read relative to a token
 *   generated, in a loaded production server.
 * - `cacheReadCostRatio` (r): energy of a token read from the prefix cache
 *   relative to a token read without it.
 * - `pue`: data centre power usage effectiveness, top of the EcoLogits provider
 *   range.
 * - `embodiedGPer1kTokens`: server manufacturing amortised per 1,000 compute
 *   equivalent tokens, from BoaviztAPI 2.5.0 (8 x H100 incl. HBM). A bounded
 *   assumption, not a measurement.
 */
export interface AIEnergyFactors {
  whPer1kOutputTokens: number;
  inputTokenEnergyRatio: number;
  cacheReadCostRatio: number;
  pue: number;
  embodiedGPer1kTokens: number;
}

export const AI_ENERGY_FACTORS: { central: AIEnergyFactors; low: AIEnergyFactors; high: AIEnergyFactors } = {
  central: {
    whPer1kOutputTokens: 0.7,
    inputTokenEnergyRatio: 0.25,
    cacheReadCostRatio: 0.065,
    pue: 1.2,
    embodiedGPer1kTokens: 0.019
  },
  low: {
    whPer1kOutputTokens: 0.17,
    inputTokenEnergyRatio: 1 / 21,
    cacheReadCostRatio: 0.045,
    pue: 1.09,
    embodiedGPer1kTokens: 0.004
  },
  high: {
    whPer1kOutputTokens: 5.1,
    inputTokenEnergyRatio: 0.35,
    cacheReadCostRatio: 0.37,
    pue: 1.27,
    embodiedGPer1kTokens: 0.13
  }
};

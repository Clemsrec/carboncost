export interface CarbonEquivalents {
  phoneCharges: number;
  carKm: number;
  assumptions: string[];
}

// Approximate awareness-only factors used for simple consumer-facing equivalents.
const PHONE_CHARGE_GRAMS = 1.6;
const CAR_KM_GRAMS = 150;

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function toEquivalents(gramsCO2e: number): CarbonEquivalents {
  const safeGrams = Math.max(0, gramsCO2e);

  return {
    phoneCharges: round(safeGrams / PHONE_CHARGE_GRAMS, 2),
    carKm: round(safeGrams / CAR_KM_GRAMS, 2),
    assumptions: [
      "Assumes ~1.6 gCO2e per full smartphone charge (typical estimate).",
      "Assumes ~150 gCO2e per km for an average petrol car.",
      "Equivalents are approximate and for awareness only."
    ]
  };
}
export interface CarbonEquivalents {
  phoneCharges: number;
  carKm: number;
  trainKm: number;
  ledBulbHours: number;
  laptopCharges: number;
  assumptions: string[];
}

// Approximate awareness-only factors used for simple consumer-facing equivalents.
const PHONE_CHARGE_GRAMS = 1.6;
const CAR_KM_GRAMS = 150;
const TRAIN_KM_GRAMS = 14;
const LED_BULB_HOUR_GRAMS = 4;
const LAPTOP_CHARGE_GRAMS = 33;

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function toEquivalents(gramsCO2e: number): CarbonEquivalents {
  const safeGrams = Math.max(0, gramsCO2e);

  return {
    phoneCharges: round(safeGrams / PHONE_CHARGE_GRAMS, 2),
    carKm: round(safeGrams / CAR_KM_GRAMS, 2),
    trainKm: round(safeGrams / TRAIN_KM_GRAMS, 2),
    ledBulbHours: round(safeGrams / LED_BULB_HOUR_GRAMS, 2),
    laptopCharges: round(safeGrams / LAPTOP_CHARGE_GRAMS, 2),
    assumptions: [
      "Assumes ~1.6 gCO2e per full smartphone charge (typical estimate).",
      "Assumes ~150 gCO2e per km for an average petrol car.",
      "Assumes ~14 gCO2e per passenger-km for electric rail transit (typical estimate).",
      "Assumes ~4 gCO2e per hour for a 10W LED bulb at average grid intensity.",
      "Assumes ~33 gCO2e per full laptop charge (typical estimate).",
      "Equivalents are approximate and for awareness only."
    ]
  };
}
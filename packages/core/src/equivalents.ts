export interface CarbonEquivalents {
  phoneCharges: number;
  carKm: number;
  trainKm: number;
  ledBulbHours: number;
  laptopCharges: number;
  phoneChargesDisplay: string;
  laptopChargesDisplay: string;
  trainKmDisplay: string;
  ledBulbHoursDisplay: string;
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

function toDisplayNumber(value: number, maxDecimals: number): string {
  const rounded = round(value, maxDecimals);
  return rounded.toFixed(maxDecimals).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1");
}

function formatChargeDisplay(value: number): string {
  if (value < 0.1) {
    return "< 0.1 charge";
  }

  return `${toDisplayNumber(value, 1)} charge`;
}

function formatTrainKmDisplay(km: number): string {
  if (km < 0.001) {
    return "< 1 m";
  }

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }

  return `${toDisplayNumber(km, 2)} km`;
}

function formatLedHoursDisplay(hours: number): string {
  if (hours < 0.1) {
    return "< 0.1 h";
  }

  return `${toDisplayNumber(hours, 1)} h`;
}

export function toEquivalents(gramsCO2e: number): CarbonEquivalents {
  const safeGrams = Math.max(0, gramsCO2e);
  const phoneCharges = round(safeGrams / PHONE_CHARGE_GRAMS, 2);
  const carKm = round(safeGrams / CAR_KM_GRAMS, 2);
  const trainKm = round(safeGrams / TRAIN_KM_GRAMS, 2);
  const ledBulbHours = round(safeGrams / LED_BULB_HOUR_GRAMS, 2);
  const laptopCharges = round(safeGrams / LAPTOP_CHARGE_GRAMS, 2);

  return {
    phoneCharges,
    carKm,
    trainKm,
    ledBulbHours,
    laptopCharges,
    phoneChargesDisplay: formatChargeDisplay(phoneCharges),
    laptopChargesDisplay: formatChargeDisplay(laptopCharges),
    trainKmDisplay: formatTrainKmDisplay(trainKm),
    ledBulbHoursDisplay: formatLedHoursDisplay(ledBulbHours),
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
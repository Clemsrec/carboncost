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

/**
 * Unit words used by the `*Display` fields. Only `charge` is really a word; the
 * rest are symbols that travel across languages, but they are all overridable
 * so callers are never stuck with an English string in their UI.
 */
export interface EquivalentLabels {
  charge: string;
  hour: string;
  kilometre: string;
  metre: string;
  /** Prefix for below-threshold values, rendered as `${lessThan} 0.1 charge`. */
  lessThan: string;
}

export interface EquivalentsOptions {
  /** BCP 47 locale driving number formatting, e.g. "fr" gives "0,4". Defaults to "en". */
  locale?: string;
  labels?: Partial<EquivalentLabels>;
}

const DEFAULT_LABELS: EquivalentLabels = {
  charge: "charge",
  hour: "h",
  kilometre: "km",
  metre: "m",
  lessThan: "<"
};

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function makeNumberFormatter(locale: string) {
  return (value: number, maxDecimals: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(
      round(value, maxDecimals)
    );
}

export function toEquivalents(
  gramsCO2e: number,
  options: EquivalentsOptions = {}
): CarbonEquivalents {
  const locale = options.locale ?? "en";
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  const formatNumber = makeNumberFormatter(locale);

  const formatChargeDisplay = (value: number): string =>
    value < 0.1
      ? `${labels.lessThan} ${formatNumber(0.1, 1)} ${labels.charge}`
      : `${formatNumber(value, 1)} ${labels.charge}`;

  const formatTrainKmDisplay = (km: number): string => {
    if (km < 0.001) {
      return `${labels.lessThan} 1 ${labels.metre}`;
    }

    if (km < 1) {
      return `${formatNumber(km * 1000, 0)} ${labels.metre}`;
    }

    return `${formatNumber(km, 2)} ${labels.kilometre}`;
  };

  const formatLedHoursDisplay = (hours: number): string =>
    hours < 0.1
      ? `${labels.lessThan} ${formatNumber(0.1, 1)} ${labels.hour}`
      : `${formatNumber(hours, 1)} ${labels.hour}`;

  return buildEquivalents(gramsCO2e, {
    formatChargeDisplay,
    formatTrainKmDisplay,
    formatLedHoursDisplay
  });
}

function buildEquivalents(
  gramsCO2e: number,
  format: {
    formatChargeDisplay: (value: number) => string;
    formatTrainKmDisplay: (km: number) => string;
    formatLedHoursDisplay: (hours: number) => string;
  }
): CarbonEquivalents {
  const { formatChargeDisplay, formatTrainKmDisplay, formatLedHoursDisplay } = format;
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
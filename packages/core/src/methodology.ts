import type { MethodologyMetadata } from "./types.js";

export const WEB_METHODOLOGY: MethodologyMetadata = {
  methodologyVersion: "web-estimation-v2",
  source: "sustainable-web-design-model",
  boundaries: ["web-delivery"],
  notes: [
    "Applies Sustainable Web Design Model energy intensities per GB transferred: https://sustainablewebdesign.org/estimating-digital-emissions/",
    "Covers data centre, network and user device, including operational and embodied energy.",
    "Grid intensity defaults to the global average of 494 gCO2e/kWh and can be overridden per event.",
    "Green hosting adjusts data centre operational emissions only.",
    "Not a full lifecycle assessment of all infrastructure layers."
  ],
  updatedAt: "2026-08-06"
};

export const AI_METHODOLOGY: MethodologyMetadata = {
  methodologyVersion: "ai-token-estimation-v1",
  source: "token-activity-factor-model",
  boundaries: ["ai-inference"],
  notes: [
    "Estimation based on prompt and completion tokens.",
    "Model coefficients are defaults and should be customized when possible.",
    "Token-based estimates are not exact hardware power measurements."
  ],
  updatedAt: "2026-05-08"
};

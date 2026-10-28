import type { MethodologyMetadata } from "./types.js";

export const WEB_METHODOLOGY: MethodologyMetadata = {
  methodologyVersion: "web-estimation-v2",
  source: "sustainable-web-design-model",
  boundaries: ["web-delivery"],
  notes: [
    "Applies Sustainable Web Design Model energy intensities per GB transferred: https://sustainablewebdesign.org/estimating-digital-emissions/",
    "Covers data centre, network and user device, including operational and embodied energy.",
    "Grid intensity defaults to the global average of 494 gCO2e/kWh; a region code or an explicit intensity overrides it per event, for hosting and for the visitor device separately.",
    "Green hosting adjusts data centre operational emissions only.",
    "Not a full lifecycle assessment of all infrastructure layers."
  ],
  updatedAt: "2026-08-06"
};

export const AI_METHODOLOGY: MethodologyMetadata = {
  methodologyVersion: "ai-token-estimation-v2",
  source: "token-energy-model",
  boundaries: ["ai-inference"],
  notes: [
    "Tokens are converted to server energy: 0.7 Wh per 1,000 generated tokens before PUE, a token read at 0.25 of a token generated, a token read from cache at 6.5% of a token read.",
    "Energy includes a data centre PUE of 1.2 and is converted at the grid of the region where the request is computed (Ember 2025 lifecycle intensities, ADEME Base Carbone 2024 for France); an unknown region counts at the world average.",
    "Server manufacturing is amortised at 0.019 g per 1,000 compute-equivalent tokens (BoaviztAPI 2.5.0), a bounded assumption.",
    "Low and high values repeat the calculation at the bounds of each sourced assumption. Factors are shared with Carbon Watch.",
    "Out of scope: model training, network transfer, end of life, the user's device, and reasoning tokens a provider does not report.",
    "Token-based estimates are not hardware power measurements."
  ],
  updatedAt: "2026-10-28"
};

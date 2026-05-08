import type { MethodologyMetadata } from "./types.js";

export const WEB_METHODOLOGY: MethodologyMetadata = {
  methodologyVersion: "web-estimation-v1",
  source: "swdm-inspired-bytes-model",
  boundaries: ["web-delivery"],
  notes: [
    "Estimation based on transferred bytes and a fixed intensity coefficient.",
    "Not a full lifecycle assessment of all infrastructure layers.",
    "Green hosting input is optional and should be provided by integrators."
  ],
  updatedAt: "2026-05-08"
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

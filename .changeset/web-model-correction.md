---
"carbone-cost": minor
---

Correct the web intensity coefficient, which was wrong by more than two orders
of magnitude, and replace it with the full Sustainable Web Design Model.

`WEB_GRAMS_PER_GB` was 0.5. The model the package claimed to follow gives
roughly 148 gCO2e per GB (0.300 kWh/GB across all segments, at 494 gCO2e/kWh) —
0.5 is a plausible per-megabyte figure mislabelled as per-gigabyte. Every web
estimate produced before this release understates emissions by ~300x, and every
real page collapsed into the "very-low" display band.

**Every web number this package produces changes.** Anything published from an
earlier version should be recomputed.

- `estimateWeb` now applies per-segment intensities for data centre, network and
  user device, covering operational and embodied energy, and reports each
  segment in `breakdown` so a published figure can be audited.
- Green hosting adjusts data centre operational emissions only, per the model,
  instead of halving the whole result on an unsourced constant. A fully green
  host now removes ~18% rather than 50%.
- New `greenHostingFactor` input accepts a share between 0 and 1, for hosts that
  are partly renewable.
- New `gridIntensityGCO2ePerKWh` input overrides the global average for
  operational emissions. Embodied emissions keep the global average, since
  hardware manufacturing spans global supply chains.
- New `factorGPerGB` input bypasses the model entirely, mirroring
  `factorGPer1kTokens` on the AI side. Integrators who dispute the coefficient
  no longer have to fork.
- Data transfer is now divided by 1e9 rather than 1024^3, matching the model's
  definition of a gigabyte.
- `formatForDisplay` thresholds are recalibrated on grams per view. The previous
  bands were derived from the incorrect coefficient.
- Methodology version is now `web-estimation-v2`, source
  `sustainable-web-design-model`.
- Published tarballs no longer ship compiled test files.

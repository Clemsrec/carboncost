---
"carbone-cost": minor
---

Method: AI estimates move to `ai-token-estimation-v2`. Tokens are converted to server energy (0.7 Wh per 1,000 generated tokens, a token read at 0.25 of a token generated, a cached token at 6.5% of a token read), multiplied by a PUE of 1.2, converted at the grid of the region where the request is computed, plus server manufacturing at 0.019 g per 1,000 compute-equivalent tokens. Factors are shared with Carbon Watch.

- `result.range` gives `{ low, high }` at the bounds of each sourced assumption; `aggregateEvents` and `aggregateSession` sum them.
- New inputs: `region`, `gridIntensityGCO2ePerKWh`, `whPer1kOutputTokens` and `pue` for AI; `region` and `visitorRegion` for web pageviews.
- New exports: `GRID_REGIONS`, `gridIntensityForRegion`, `AI_ENERGY_FACTORS`, `AI_PROVIDER_DEFAULT_REGION`, `sumRanges`.
- France uses ADEME Base Carbone 2024 (51.9 gCO2e/kWh); other countries, Ember 2025 lifecycle intensities.
- Breaking for AI figures: the per-model table (gpt-4o, claude-3-5-sonnet...) is removed, as it had no published source, and AI results are now `estimated` unless `factorGPer1kTokens` is supplied. Web figures are unchanged when no region is given.

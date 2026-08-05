---
"carbone-cost": minor
---

Make estimation confidence honest and stop the AI factor table from going stale.

- `estimateWeb` now reports `confidence: "estimated"` whenever no explicit
  hosting signal was given. Previously an omitted `greenHosting` field was
  reported as `benchmarked` even though nothing was known about the host; only
  the literal string `"unknown"` downgraded it.
- AI model names are normalized before lookup, so dated or versioned aliases
  such as `gpt-4o-mini-2024-07-18` resolve to their known factor instead of
  falling through to the default.
- Unknown models now fall back to a size tier derived from the qualifier in the
  model name (small / medium / large) rather than a single flat default, and are
  always reported as `estimated`. Exposed as `resolveModelTier()`.
- New `factorGPer1kTokens` input overrides factor resolution entirely, for
  callers who have a factor they trust more than the built-in ones.
- Factor lookup no longer uses a truthiness check, so a legitimate factor of `0`
  is treated as known.

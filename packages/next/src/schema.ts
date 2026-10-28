import { z } from "zod";

const MAX_BYTES = 1e12;
const MAX_TOKENS = 1e9;

const nonNegative = (max: number) => z.number().finite().min(0).max(max);
const regionCode = z.string().trim().min(2).max(8);

const metadata = z
  .record(z.string().max(64), z.union([z.string().max(256), z.number().finite(), z.boolean(), z.null()]))
  .refine((value) => Object.keys(value).length <= 32, "At most 32 metadata keys");

export const webPageviewInputSchema = z.strictObject({
  url: z.string().max(2048).optional(),
  route: z.string().max(512).optional(),
  bytesTransferred: nonNegative(MAX_BYTES),
  greenHosting: z.union([z.boolean(), z.literal("unknown")]).optional(),
  greenHostingFactor: nonNegative(1).optional(),
  gridIntensityGCO2ePerKWh: nonNegative(2000).optional(),
  region: regionCode.optional(),
  visitorRegion: regionCode.optional(),
  factorGPerGB: nonNegative(1e5).optional(),
  unknownRequests: nonNegative(1e5).int().optional(),
  unknownOrigins: z.array(z.string().max(256)).max(100).optional(),
  cachedRequests: nonNegative(1e5).int().optional(),
  timestamp: z.string().max(64).optional(),
  metadata: metadata.optional()
});

export const aiUsageInputSchema = z.strictObject({
  provider: z.enum(["openai", "anthropic", "google", "mistral", "other"]),
  model: z.string().min(1).max(128),
  promptTokens: nonNegative(MAX_TOKENS).int(),
  completionTokens: nonNegative(MAX_TOKENS).int(),
  cachedTokens: nonNegative(MAX_TOKENS).int().optional(),
  region: regionCode.optional(),
  gridIntensityGCO2ePerKWh: nonNegative(2000).optional(),
  whPer1kOutputTokens: nonNegative(1000).optional(),
  pue: z.number().finite().min(1).max(3).optional(),
  factorGPer1kTokens: nonNegative(1e4).optional(),
  timestamp: z.string().max(64).optional(),
  metadata: metadata.optional()
});

/**
 * What a client may post. `result` and `timestamp` are accepted so the browser
 * SDK's events validate as they are, then discarded: the server recomputes the
 * result from the input and dates the event itself.
 */
export const collectedEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("web.pageview"),
    input: webPageviewInputSchema,
    result: z.unknown().optional(),
    timestamp: z.unknown().optional()
  }),
  z.strictObject({
    type: z.literal("ai.usage"),
    input: aiUsageInputSchema,
    result: z.unknown().optional(),
    timestamp: z.unknown().optional()
  })
]);

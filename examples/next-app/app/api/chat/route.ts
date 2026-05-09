import { createNextCarbon } from "@clemsrec/next";
import { addRecentEvent } from "../../../lib/carbon-events";

const carbon = createNextCarbon({ endpoint: "https://example.com/api/carbon" });

export async function POST() {
  const event = carbon.trackAIUsage({
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 1200,
    completionTokens: 420
  });

  addRecentEvent(event);

  await carbon.sendEvent(event);

  return new Response(JSON.stringify({ ok: true, event }), {
    headers: { "content-type": "application/json" }
  });
}

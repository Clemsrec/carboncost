import { createNextCarbon } from "@clemsrec/next";
import { addRecentEvent } from "../../../lib/carbon-events";
import type { AnyEvent } from "carbone-cost";

const carbon = createNextCarbon();

export async function POST(request: Request) {
  const clonedRequest = request.clone();
  try {
    const body = (await clonedRequest.json()) as AnyEvent;
    if (body && typeof body === "object" && typeof body.type === "string") {
      addRecentEvent(body);
    }
  } catch {
    // Ignore invalid bodies and keep collection handler behavior unchanged.
  }

  return carbon.collectHandler(request);
}

import { createNextCarbon } from "@clemsrec/next";
import { addRecentEvent } from "../../../lib/carbon-events";

// `onEvent` receives events the handler has already validated, so the route no
// longer needs to clone and re-parse the request body itself.
const carbon = createNextCarbon({
  onEvent: (event) => {
    addRecentEvent(event);
  }
});

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}

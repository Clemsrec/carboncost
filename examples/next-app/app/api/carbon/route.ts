import { createNextCarbon } from "@clemsrec/next";

const carbon = createNextCarbon();

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}

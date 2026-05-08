import { createNextCarbon } from "@carbon-site-kit/next";

const carbon = createNextCarbon();

export async function POST(request: Request) {
  return carbon.collectHandler(request);
}

import test from "node:test";
import assert from "node:assert/strict";

import { diagnose } from "./diagnostics.js";
import { trackPageview } from "./index.js";

test("diagnose marks webPageviews as covered when pageviews have bytes", () => {
  const events = [
    trackPageview({ bytesTransferred: 1000, route: "/" }),
    trackPageview({ bytesTransferred: 2000, route: "/pricing" }),
    trackPageview({ bytesTransferred: 3000, route: "/docs" })
  ];

  const report = diagnose({}, events);
  assert.equal(report.webPageviews.status, "covered");
});

test("diagnose marks webApiCalls as missing when expected but not tracked", () => {
  const report = diagnose({ expectsApiTracking: true }, [
    trackPageview({ bytesTransferred: 1000, route: "/" })
  ]);

  assert.equal(report.webApiCalls.status, "missing");
});

test("diagnose marks aiInference as unknown when not expected and absent", () => {
  const report = diagnose({ expectsAiTracking: false }, [
    trackPageview({ bytesTransferred: 1000, route: "/" })
  ]);

  assert.equal(report.aiInference.status, "unknown");
});

test("diagnose marks hostingInfo as covered when provider region and green flag exist", () => {
  const report = diagnose(
    {
      hostingProvider: "vercel",
      region: "fra1",
      greenHosting: true
    },
    []
  );

  assert.equal(report.hostingInfo.status, "covered");
});

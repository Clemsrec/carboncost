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

test("diagnose distinguishes 'nothing to measure' from 'could not measure'", () => {
  const pageview = [trackPageview({ bytesTransferred: 1000, route: "/" })];

  // Declared as not applicable: there is genuinely nothing to track.
  const declared = diagnose({ expectsAiTracking: false }, pageview);
  assert.equal(declared.aiInference.status, "not-applicable");
  assert.equal(declared.aiInference.reason, "not-expected");

  // No expectation either way: we really do not know.
  const undeclared = diagnose({}, pageview);
  assert.equal(undeclared.aiInference.status, "unknown");
  assert.equal(undeclared.aiInference.reason, "no-events");
});

test("diagnose reports the threshold that produced a partial verdict", () => {
  const report = diagnose({}, [trackPageview({ bytesTransferred: 1000, route: "/" })]);

  assert.equal(report.webPageviews.status, "partial");
  assert.equal(report.webPageviews.reason, "below-sample-threshold");
  assert.equal(report.webPageviews.metrics.observed, 1);
  assert.equal(report.webPageviews.metrics.minSampleEvents, 3);
});

test("diagnose caps coverage at partial when requests could not be measured", () => {
  const events = [
    trackPageview({ bytesTransferred: 1000, route: "/", unknownRequests: 4 }),
    trackPageview({ bytesTransferred: 2000, route: "/pricing" }),
    trackPageview({ bytesTransferred: 3000, route: "/docs" })
  ];

  const report = diagnose({}, events);

  assert.equal(report.webPageviews.status, "partial");
  assert.equal(report.webPageviews.reason, "unmeasured-requests");
  assert.equal(report.webPageviews.metrics.unknownRequests, 4);
});

test("diagnose surfaces which origins could not be measured", () => {
  const report = diagnose({}, [
    trackPageview({
      bytesTransferred: 1000,
      route: "/",
      unknownRequests: 3,
      unknownOrigins: ["https://firestore.googleapis.com", "https://algolia.net"]
    }),
    trackPageview({
      bytesTransferred: 2000,
      route: "/a",
      unknownRequests: 1,
      unknownOrigins: ["https://algolia.net"]
    })
  ]);

  // Deduplicated and sorted, so a UI can name them instead of counting them.
  assert.deepEqual(report.webPageviews.unknownOrigins, [
    "https://algolia.net",
    "https://firestore.googleapis.com"
  ]);
  assert.ok(report.webPageviews.notes.some((note) => note.includes("algolia")));
});

test("diagnose reports client device as covered by the model", () => {
  const report = diagnose({}, []);

  assert.equal(report.clientDevice.status, "covered");
  assert.equal(report.clientDevice.reason, "covered-by-model");
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

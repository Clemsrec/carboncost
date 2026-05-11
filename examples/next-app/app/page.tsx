"use client";

import { useEffect, useState } from "react";
import { aggregateSession, toEquivalents, trackPageview } from "carbone-cost";

export default function HomePage() {
  const [sessionStats, setSessionStats] = useState({
    totalGrams: 0,
    estimatedTrainKm: "",
    estimatedCharges: ""
  });

  useEffect(() => {
    // Track initial pageview
    const event = trackPageview({
      route: "/",
      bytesTransferred: 850000
    });

    // Send to collection endpoint
    fetch("/api/carbon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event)
    }).catch(() => {
      // Silently fail if collection endpoint is not available
    });

    // Update local session estimate (naive demo: just this pageview)
    const session = aggregateSession([event]);
    const equiv = toEquivalents(session.totalGrams);

    setSessionStats({
      totalGrams: Math.round(session.totalGrams * 100) / 100,
      estimatedTrainKm: equiv.trainKmDisplay,
      estimatedCharges: equiv.phoneChargesDisplay
    });
  }, []);

  return (
    <main style={{ flex: 1, padding: "40px 20px", maxWidth: 800, margin: "0 auto" }}>
      <h1>Carbon Site Kit Demo</h1>
      <p>
        This is a real-world integration example showcasing carbone-cost v0.4.1 in a Next.js project.
      </p>

      <section
        style={{
          marginTop: 32,
          padding: 20,
          backgroundColor: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: 8
        }}
      >
        <h2 style={{ marginTop: 0 }}>Current session carbon estimate</h2>
        <p style={{ margin: "12px 0" }}>
          <strong>{sessionStats.totalGrams} g CO2e</strong> for this page load
        </p>
        <p style={{ margin: "12px 0", fontSize: 14, color: "#4b5563" }}>
          Equivalent to:
          <br />≈ {sessionStats.estimatedTrainKm} of electric train travel
          <br />≈ {sessionStats.estimatedCharges} of mobile phone charging
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Features</h2>
        <ul>
          <li>Real-time page carbon tracking via <code>/api/carbon</code></li>
          <li>In-session estimation and equivalents display</li>
          <li>Coverage diagnostics at <code>/carbon-diagnostics</code></li>
          <li>Minimal, non-intrusive carbon tracking hooks</li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>What this integration includes</h2>
        <ul>
          <li><code>lib/carbon-events.ts</code> — in-memory event store (100-event buffer)</li>
          <li><code>app/api/carbon/route.ts</code> — collection endpoint that captures pageview events</li>
          <li><code>app/api/chat/route.ts</code> — example AI event tracking (mock)</li>
          <li><code>app/carbon-diagnostics/page.tsx</code> — coverage diagnostics dashboard</li>
          <li>This page — inline session estimate display</li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Next steps for production</h2>
        <ul>
          <li>Replace in-memory event store with Redis or database</li>
          <li>Enable <code>NEXT_PUBLIC_CARBON_DIAGNOSTICS_ENABLED=true</code> and <code>CARBON_DIAGNOSTICS_SECRET</code> in production</li>
          <li>Wire actual AI tracking into real LLM API routes</li>
          <li>Integrate session display into your own footer or UI component</li>
          <li>Set up real hosting metadata: <code>NEXT_PUBLIC_CARBON_HOSTING_PROVIDER</code>, <code>NEXT_PUBLIC_CARBON_REGION</code>, etc.</li>
        </ul>
      </section>

      <section style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Carbon estimates are directional approximations for awareness. Not suitable for formal LCA or compliance reporting.
        </p>
      </section>
    </main>
  );
}

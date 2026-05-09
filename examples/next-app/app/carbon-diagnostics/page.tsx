import { diagnose, type CoverageDimension } from "carbone-cost";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { getRecentEvents } from "../../lib/carbon-events";

const enabled = process.env.NEXT_PUBLIC_CARBON_DIAGNOSTICS_ENABLED === "true";
const diagnosticsSecret = process.env.CARBON_DIAGNOSTICS_SECRET;

function statusLabel(status: CoverageDimension["status"]): string {
  switch (status) {
    case "covered":
      return "Covered";
    case "partial":
      return "Partial";
    case "missing":
      return "Missing";
    default:
      return "Unknown";
  }
}

function statusStyle(status: CoverageDimension["status"]): CSSProperties {
  switch (status) {
    case "covered":
      return { backgroundColor: "#dcfce7", color: "#166534" };
    case "partial":
      return { backgroundColor: "#fef3c7", color: "#92400e" };
    case "missing":
      return { backgroundColor: "#fee2e2", color: "#991b1b" };
    default:
      return { backgroundColor: "#e5e7eb", color: "#374151" };
  }
}

function DimensionCard(props: { title: string; dimension: CoverageDimension }) {
  const { title, dimension } = props;
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <span
          style={{
            ...statusStyle(dimension.status),
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase"
          }}
        >
          {statusLabel(dimension.status)}
        </span>
      </div>
      <ul style={{ marginTop: 12, paddingLeft: 18 }}>
        {dimension.notes.map((note) => (
          <li key={note} style={{ marginBottom: 6 }}>
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CarbonDiagnosticsPage({
  searchParams
}: {
  searchParams?: { key?: string };
}) {
  if (diagnosticsSecret && searchParams?.key !== diagnosticsSecret) {
    notFound();
  }

  if (!enabled) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
        <h1 style={{ marginBottom: 12 }}>Carbon diagnostics disabled</h1>
        <p>
          Set <code>NEXT_PUBLIC_CARBON_DIAGNOSTICS_ENABLED=true</code> to expose this page.
        </p>
        <p>
          Optional hardening: set <code>CARBON_DIAGNOSTICS_SECRET</code> and access with
          <code>?key=...</code>.
        </p>
      </main>
    );
  }

  const recentEvents = getRecentEvents(100);

  const report = diagnose(
    {
      expectsApiTracking: true,
      expectsAiTracking: true,
      hostingProvider: process.env.NEXT_PUBLIC_CARBON_HOSTING_PROVIDER,
      region: process.env.NEXT_PUBLIC_CARBON_REGION,
      greenHosting:
        typeof process.env.NEXT_PUBLIC_CARBON_GREEN_HOSTING === "string"
          ? process.env.NEXT_PUBLIC_CARBON_GREEN_HOSTING === "true"
          : undefined
    },
    recentEvents
  );

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px", color: "#111827" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Carbon Coverage Diagnostics</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Last {recentEvents.length} captured event(s) are analyzed to show covered, partial, missing, and
          unknown dimensions.
        </p>
      </header>

      <div style={{ display: "grid", gap: 16 }}>
        <DimensionCard title="Web pageviews" dimension={report.webPageviews} />
        <DimensionCard title="Web API calls" dimension={report.webApiCalls} />
        <DimensionCard title="AI inference" dimension={report.aiInference} />
        <DimensionCard title="Hosting info" dimension={report.hostingInfo} />
        <DimensionCard title="Client device" dimension={report.clientDevice} />
      </div>
    </main>
  );
}

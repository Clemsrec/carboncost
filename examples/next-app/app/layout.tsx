import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carbon Site Kit Demo",
  description: "Real-world integration example for carbone-cost v0.4.1"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {children}
          <footer
            style={{
              marginTop: "auto",
              padding: "20px",
              borderTop: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              textAlign: "center",
              fontSize: "14px",
              color: "#4b5563"
            }}
          >
            <p style={{ margin: "0 0 8px 0" }}>
              🌱 This site estimates its carbon footprint •{" "}
              <a href="/carbon-diagnostics" style={{ color: "#0066cc", textDecoration: "underline" }}>
                View diagnostics
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

import { useState } from "react";

type DemoResult = {
  property?: string;
  reservationId?: string;
  grantId?: string;
  startsAt?: string;
  endsAt?: string;
  activatedGrant?: any;
  error?: string;
};

export default function AdminDemoCenterPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const runDemo = async () => {
    setLoading(true);
    setResult(null);

    try {
      const apiBase = (import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(/\/$/, "");

      const res = await fetch(`${apiBase}/api/internal/admin/demo/run`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setResult({
          error:
            data?.error ??
            data?.message ??
            `Demo failed with status ${res.status}`,
        });
        return;
      }

      setResult(data.data);
    } catch (err: any) {
      setResult({
        error: err?.message ?? "Demo request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleString();
  };

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        display: "grid",
        gap: 24,
      }}
    >
      <section
        style={{
          borderRadius: 24,
          padding: 32,
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 55%, #1d4ed8 100%)",
          color: "#fff",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#bfdbfe",
            marginBottom: 12,
          }}
        >
          Internal Sales Tool
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 42,
            lineHeight: 1.05,
            fontWeight: 900,
          }}
        >
          Pin&Go Live Demo Center
        </h1>

        <p
          style={{
            marginTop: 14,
            maxWidth: 620,
            fontSize: 16,
            lineHeight: 1.6,
            color: "#dbeafe",
          }}
        >
          Create a real demo reservation, generate an access grant, and trigger
          the same activation flow used in production.
        </p>

        <button
          onClick={runDemo}
          disabled={loading}
          style={{
            marginTop: 24,
            padding: "14px 22px",
            borderRadius: 999,
            border: "none",
            background: loading ? "#93c5fd" : "#ffffff",
            color: "#0f172a",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
          }}
        >
          {loading ? "Running Live Demo..." : "Run Live Demo"}
        </button>
      </section>

      {loading && (
        <section
          style={{
            borderRadius: 20,
            padding: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Creating demo access...</h2>
          <p style={{ color: "#6b7280", marginBottom: 0 }}>
            Pin&Go is creating the demo reservation, access grant, and TTLock
            activation. If this takes too long, check backend logs or Network
            tab.
          </p>
        </section>
      )}

      {result?.error && (
        <section
          style={{
            borderRadius: 20,
            padding: 24,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Demo failed</h2>
          <p style={{ marginBottom: 0, fontWeight: 700 }}>{result.error}</p>
        </section>
      )}

      {result && !result.error && (
        <section
          style={{
            borderRadius: 20,
            padding: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#dcfce7",
              color: "#166534",
              fontWeight: 900,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            Access Ready
          </div>

          <h2 style={{ marginTop: 0 }}>Demo Created Successfully</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            <InfoCard label="Property" value={result.property ?? "—"} />
            <InfoCard label="Reservation ID" value={result.reservationId ?? "—"} />
            <InfoCard label="Access Grant ID" value={result.grantId ?? "—"} />
            <InfoCard label="Valid From" value={formatDate(result.startsAt)} />
            <InfoCard label="Valid Until" value={formatDate(result.endsAt)} />
          </div>

          <details style={{ marginTop: 24 }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 800,
                color: "#1d4ed8",
              }}
            >
              View raw activation response
            </summary>

            <pre
              style={{
                marginTop: 12,
                padding: 16,
                borderRadius: 14,
                background: "#0f172a",
                color: "#dbeafe",
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(result.activatedGrant ?? result, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#111827",
          fontWeight: 800,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
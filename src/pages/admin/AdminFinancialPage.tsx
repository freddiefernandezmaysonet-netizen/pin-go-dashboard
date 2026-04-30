import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

type AdminFinancialData = any;

function money(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function number(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(n);
}

function percent(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${n.toFixed(2)}%`;
}

function shortId(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export default function AdminFinancialPage() {
  const [data, setData] = useState<AdminFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (!API) return null;
    return `${API}/api/internal/financial/overview`;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!endpoint) throw new Error("Missing VITE_API_BASE");

        const res = await fetch(endpoint, {
          credentials: "include",
        });

        const json = await res.json();

        if (!res.ok) throw new Error(json?.error);

        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (loading) return <PageState text="Loading financial data..." />;
  if (error) return <PageError error={error} />;

  const organizations = data?.organizations ?? [];

  return (
    <div style={{ padding: 24 }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Admin Financial</h2>

        <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
          <Badge text="Last 30 Days" />
          <span style={{ color: "#64748b" }}>
            Platform-wide financial overview
          </span>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={grid4}>
        <Card title="MRR" value={money(data?.revenue?.total)} />
        <Card title="Costs" value={money(data?.costs?.total)} />
        <Card title="Net" value={money(data?.profit?.net)} />
        <Card title="Margin" value={percent(data?.profit?.margin)} />
      </div>

      {/* SUMMARY */}
      <Section title="Platform">
        <Grid>
          <Metric label="Organizations" value={number(data?.summary?.totalOrgs)} />
          <Metric label="Subscribed" value={number(data?.summary?.subscribedOrgs)} />
          <Metric label="Reservations" value={number(data?.summary?.totalReservations)} />
          <Metric label="SMS Sent" value={number(data?.summary?.totalSmsMessages)} />
          <Metric label="Automations" value={number(data?.summary?.totalAutomationExecutions)} />
        </Grid>
      </Section>

      {/* COSTS */}
      <Section title="Costs Breakdown">
        <Grid>
          <Metric label="Stripe" value={money(data?.costs?.stripe)} />
          <Metric label="Twilio" value={money(data?.costs?.twilio)} />
          <Metric label="Tuya" value={money(data?.costs?.tuya)} />
        </Grid>
      </Section>

      {/* TABLE */}
      <Section title="Organizations">
        <table style={table}>
          <thead>
            <tr>
              <Th>Org</Th>
              <Th>MRR</Th>
              <Th>Locks</Th>
              <Th>Smart</Th>
              <Th>SMS</Th>
              <Th>Automation</Th>
              <Th>Reservations</Th>
              <Th>Stripe</Th>
            </tr>
          </thead>

          <tbody>
            {organizations.map((org: any) => (
              <tr key={org.organizationId}>
                <Td>{org.organizationName}</Td>
                <Td>{money(org.revenue?.estimatedMonthly)}</Td>

                <Td>
                  {org.usage?.locksUsed} /{" "}
                  {org.subscription?.entitledLocks ?? 0}
                </Td>

                <Td>
                  {org.usage?.smartPropertiesUsed} /{" "}
                  {org.subscription?.entitledSmartProperties ?? 0}
                </Td>

                <Td>{number(org.usage?.smsUsed)}</Td>
                <Td>{number(org.usage?.automationExecutions)}</Td>
                <Td>{number(org.usage?.reservations)}</Td>

                <Td>
                  {shortId(org.subscription?.stripeSubscriptionId)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function PageState({ text }: { text: string }) {
  return <div style={{ padding: 24 }}>{text}</div>;
}

function PageError({ error }: { error: string }) {
  return (
    <div style={{ padding: 24, color: "#991b1b" }}>
      Error: {error}
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div style={card}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={section}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: any) {
  return <div style={grid}>{children}</div>;
}

function Metric({ label, value }: any) {
  return (
    <div style={metric}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        background: "#e0f2fe",
        color: "#0369a1",
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}

function Th({ children }: any) {
  return <th style={th}>{children}</th>;
}

function Td({ children }: any) {
  return <td style={td}>{children}</td>;
}

/* ---------- STYLES ---------- */

const grid4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const card = {
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#fff",
};

const section = {
  marginTop: 24,
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#fff",
};

const metric = {
  padding: 12,
  background: "#f8fafc",
  borderRadius: 10,
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const th = {
  textAlign: "left" as const,
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
};

const td = {
  padding: "10px",
  borderBottom: "1px solid #f1f5f9",
};
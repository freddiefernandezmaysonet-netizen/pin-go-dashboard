import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

type AdminFinancialData = {
  ok?: boolean;
  pricing?: {
    lockPrice?: number;
    smartPrice?: number;
  };
  summary?: {
    totalOrgs?: number;
    subscribedOrgs?: number;
    totalReservations?: number;
    entitledLocks?: number;
    entitledSmartProperties?: number;
    activeLocks?: number;
    activeSmartProperties?: number;
  };
  revenue?: {
    locks?: number;
    smart?: number;
    total?: number;
  };
  costs?: {
    stripe?: number;
    twilio?: number;
    tuya?: number;
    total?: number;
  };
  profit?: {
    net?: number;
    margin?: number;
  };
  organizations?: Array<{
    organizationId: string;
    organizationName: string | null;
    createdAt?: string;
    subscription: null | {
      id: string;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      entitledLocks: number;
      entitledSmartProperties: number;
      createdAt?: string;
      updatedAt?: string;
    };
    usage: {
      locksUsed: number;
      smartPropertiesUsed: number;
      reservations: number;
    };
    revenue: {
      estimatedMonthly: number;
      locks: number;
      smart: number;
    };
  }>;
};

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
    return `${API}/api/admin/financial/overview`;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!endpoint) {
          throw new Error("Missing VITE_API_BASE");
        }

        const res = await fetch(endpoint, {
          credentials: "include",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || `Request failed: ${res.status}`);
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load admin financial data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const organizations = data?.organizations ?? [];

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Admin Financial Dashboard</h2>
        <p>Loading financial data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Admin Financial Dashboard</h2>
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Admin Financial Dashboard</h2>
        <p style={{ marginTop: 8, color: "#64748b" }}>
          Read-only platform financial overview based on subscription
          entitlements and current usage.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Card title="Estimated MRR" value={money(data?.revenue?.total)} />
        <Card title="Estimated Costs" value={money(data?.costs?.total)} />
        <Card title="Estimated Net" value={money(data?.profit?.net)} />
        <Card title="Margin" value={percent(data?.profit?.margin)} />
      </div>

      <Section title="Platform Summary">
        <Grid>
          <Metric label="Organizations" value={number(data?.summary?.totalOrgs)} />
          <Metric
            label="Subscribed Orgs"
            value={number(data?.summary?.subscribedOrgs)}
          />
          <Metric
            label="Reservations"
            value={number(data?.summary?.totalReservations)}
          />
          <Metric
            label="Entitled Locks"
            value={number(data?.summary?.entitledLocks)}
          />
          <Metric
            label="Active Locks"
            value={number(data?.summary?.activeLocks)}
          />
          <Metric
            label="Entitled Smart Properties"
            value={number(data?.summary?.entitledSmartProperties)}
          />
          <Metric
            label="Active Smart Properties"
            value={number(data?.summary?.activeSmartProperties)}
          />
        </Grid>
      </Section>

      <Section title="Revenue Breakdown">
        <Grid>
          <Metric
            label={`Locks @ ${money(data?.pricing?.lockPrice)} / mo`}
            value={money(data?.revenue?.locks)}
          />
          <Metric
            label={`Smart Properties @ ${money(data?.pricing?.smartPrice)} / mo`}
            value={money(data?.revenue?.smart)}
          />
          <Metric label="Total Estimated MRR" value={money(data?.revenue?.total)} />
        </Grid>
      </Section>

      <Section title="Estimated Cost Breakdown">
        <Grid>
          <Metric label="Stripe Fees" value={money(data?.costs?.stripe)} />
          <Metric label="Twilio SMS" value={money(data?.costs?.twilio)} />
          <Metric label="Tuya" value={money(data?.costs?.tuya)} />
          <Metric label="Total Costs" value={money(data?.costs?.total)} />
        </Grid>
      </Section>

      <Section title="Organizations">
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <Th>Organization</Th>
                <Th>MRR</Th>
                <Th>Entitled</Th>
                <Th>Usage</Th>
                <Th>Reservations</Th>
                <Th>Stripe Customer</Th>
                <Th>Stripe Subscription</Th>
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16, color: "#64748b" }}>
                    No organizations found.
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr
                    key={org.organizationId}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <Td>{org.organizationName || "Unnamed organization"}</Td>
                    <Td>{money(org.revenue?.estimatedMonthly)}</Td>
                    <Td>
                      {number(org.subscription?.entitledLocks)} locks /{" "}
                      {number(org.subscription?.entitledSmartProperties)} smart
                    </Td>
                    <Td>
                      {number(org.usage?.locksUsed)} locks /{" "}
                      {number(org.usage?.smartPropertiesUsed)} smart
                    </Td>
                    <Td>{number(org.usage?.reservations)}</Td>
                    <Td>{shortId(org.subscription?.stripeCustomerId)}</Td>
                    <Td>{shortId(org.subscription?.stripeSubscriptionId)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        padding: 18,
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#ffffff",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 24,
        padding: 18,
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#ffffff",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid #f1f5f9",
        borderRadius: 12,
        background: "#f8fafc",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#475569" }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "12px", whiteSpace: "nowrap", color: "#0f172a" }}>
      {children}
    </td>
  );
}
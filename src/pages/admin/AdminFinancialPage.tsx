import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

type StripeActuals = {
  saasRevenueActual?: number;
  connectPlatformFeesActual?: number;
  guestBookingGmv?: number;
  hostTransfers?: number;
  refunds?: number;
  disputes?: number;
  stripeProcessingFeesActual?: number | null;
  netPlatformRevenue?: number | null;
  reconciliationStatus?: string;
  ledgerEventCount?: number;
  livemode?: boolean | null;
};

type AdminFinancialData = {
  stripeActuals?: StripeActuals;
  [key: string]: any;
};

function money(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function moneyOrPending(value: unknown) {
  return value === null || value === undefined
    ? "Pending reconciliation"
    : money(value);
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

function reconciliationLabel(value?: string) {
  switch (value) {
    case "NO_FINANCIAL_ACTIVITY":
      return "No financial activity";
    case "REQUIRES_BALANCE_TRANSACTION_RECONCILIATION":
      return "Balance transaction reconciliation required";
    case "REQUIRES_CURRENCY_RECONCILIATION":
      return "Currency reconciliation required";
    case "REQUIRES_LIVEMODE_RECONCILIATION":
      return "Live/test reconciliation required";
    default:
      return "Reconciliation status unavailable";
  }
}

function livemodeLabel(value?: boolean | null) {
  if (value === true) return "Stripe Live";
  if (value === false) return "Stripe Test";
  return "Stripe Mode Unknown";
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
  const stripeActuals = data?.stripeActuals;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Admin Financial</h2>

        <div
          style={{
            marginTop: 6,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Badge text="Last 30 Days" />
          <Badge text="Actual + Estimated" tone="neutral" />
          <span style={{ color: "#64748b" }}>
            Platform-wide financial overview
          </span>
        </div>
      </div>

      <div style={grid4}>
        <Card title="Estimated MRR" value={money(data?.revenue?.total)} />
        <Card title="Estimated Costs" value={money(data?.costs?.total)} />
        <Card title="Estimated Net" value={money(data?.profit?.net)} />
        <Card title="Estimated Margin" value={percent(data?.profit?.margin)} />
      </div>

      <Section title="Stripe Actuals (Last 30 Days)">
        <div style={statusRow}>
          <Badge text={livemodeLabel(stripeActuals?.livemode)} tone="neutral" />
          <Badge
            text={reconciliationLabel(stripeActuals?.reconciliationStatus)}
            tone="warning"
          />
          <span style={{ color: "#64748b", fontSize: 13 }}>
            Ledger events: {number(stripeActuals?.ledgerEventCount)}
          </span>
        </div>

        <Grid>
          <Metric
            label="SaaS Revenue — Actual"
            value={money(stripeActuals?.saasRevenueActual)}
          />
          <Metric
            label="Connect Platform Fees — Actual"
            value={money(stripeActuals?.connectPlatformFeesActual)}
          />
          <Metric
            label="Guest Booking GMV"
            value={money(stripeActuals?.guestBookingGmv)}
          />
          <Metric
            label="Host Transfers"
            value={money(stripeActuals?.hostTransfers)}
          />
          <Metric label="Refunds" value={money(stripeActuals?.refunds)} />
          <Metric label="Disputes" value={money(stripeActuals?.disputes)} />
          <Metric
            label="Stripe Processing Fees — Actual"
            value={moneyOrPending(stripeActuals?.stripeProcessingFeesActual)}
          />
          <Metric
            label="Net Platform Revenue — Actual"
            value={moneyOrPending(stripeActuals?.netPlatformRevenue)}
          />
        </Grid>

        <div style={actualsNote}>
          Guest Booking GMV is guest payment volume, not Pin&Go revenue. Host
          transfers are pass-through to hosts. Stripe processing fees and net
          platform revenue remain pending until exact balance transaction fees
          are reconciled.
        </div>
      </Section>

      <Section title="Platform">
        <Grid>
          <Metric label="Organizations" value={number(data?.summary?.totalOrgs)} />
          <Metric label="Subscribed" value={number(data?.summary?.subscribedOrgs)} />
          <Metric label="Reservations" value={number(data?.summary?.totalReservations)} />
          <Metric label="SMS Sent" value={number(data?.summary?.totalSmsMessages)} />
          <Metric label="Automations" value={number(data?.summary?.totalAutomationExecutions)} />
        </Grid>
      </Section>

      <Section title="Estimated Cost Breakdown">
        <Grid>
          <Metric label="Stripe — Estimated" value={money(data?.costs?.stripe)} />
          <Metric label="Twilio — Estimated" value={money(data?.costs?.twilio)} />
          <Metric label="Tuya — Estimated" value={money(data?.costs?.tuya)} />
        </Grid>
      </Section>

      <Section title="Organizations">
        <table style={table}>
          <thead>
            <tr>
              <Th>Org</Th>
              <Th>Est. MRR</Th>
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

                <Td>{shortId(org.subscription?.stripeSubscriptionId)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function PageState({ text }: { text: string }) {
  return <div style={{ padding: 24 }}>{text}</div>;
}

function PageError({ error }: { error: string }) {
  return <div style={{ padding: 24, color: "#991b1b" }}>Error: {error}</div>;
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
      <div style={{ fontWeight: 700, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Badge({
  text,
  tone = "info",
}: {
  text: string;
  tone?: "info" | "neutral" | "warning";
}) {
  const tones = {
    info: { background: "#e0f2fe", color: "#0369a1" },
    neutral: { background: "#f1f5f9", color: "#334155" },
    warning: { background: "#fef3c7", color: "#92400e" },
  };

  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 600,
        ...tones[tone],
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

const statusRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
  alignItems: "center",
  marginBottom: 14,
};

const actualsNote = {
  marginTop: 14,
  padding: 12,
  borderRadius: 10,
  background: "#f8fafc",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
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

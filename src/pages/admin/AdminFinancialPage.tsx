import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

export default function AdminFinancialPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const endpoint = useMemo(() => {
    if (!API) return null;
    return `${API}/api/internal/financial/overview`;
  }, []);

  async function load() {
    if (!endpoint) return;

    setLoading(true);

    const res = await fetch(endpoint, {
      credentials: "include",
    });

    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading financial data...</div>;
  }

  const orgs = data?.organizations ?? [];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* HEADER */}
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>
          Admin Financial
        </h1>
        <p style={{ color: "#666", marginTop: 8 }}>
          Platform financial overview (Last 30 Days)
        </p>
      </div>

      {/* KPI */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        }}
      >
        <Stat title="MRR" value={data?.revenue?.total} money />
        <Stat title="Costs" value={data?.costs?.total} money />
        <Stat title="Net" value={data?.profit?.net} money />
        <Stat title="Margin" value={data?.profit?.margin} percent />
      </div>

      {/* SUMMARY */}
      <SectionCard title="Platform Summary">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(5,1fr)" }}>
          <StatSmall label="Organizations" value={data?.summary?.totalOrgs} />
          <StatSmall label="Subscribed" value={data?.summary?.subscribedOrgs} />
          <StatSmall label="Reservations" value={data?.summary?.totalReservations} />
          <StatSmall label="SMS" value={data?.summary?.totalSmsMessages} />
          <StatSmall label="Automation" value={data?.summary?.totalAutomationExecutions} />
        </div>
      </SectionCard>

      {/* COSTS */}
      <SectionCard title="Cost Breakdown">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3,1fr)" }}>
          <StatSmall label="Stripe" value={data?.costs?.stripe} money />
          <StatSmall label="Twilio" value={data?.costs?.twilio} money />
          <StatSmall label="Tuya" value={data?.costs?.tuya} money />
        </div>
      </SectionCard>

      {/* ORGS TABLE */}
      <SectionCard
        title={`Organizations (${orgs.length})`}
        right={
          <button onClick={load} style={refreshButton}>
            Refresh
          </button>
        }
      >
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <Th>Org</Th>
                <Th>MRR</Th>
                <Th>Locks</Th>
                <Th>Smart</Th>
                <Th>SMS</Th>
                <Th>Automation</Th>
                <Th>Reservations</Th>
              </tr>
            </thead>

            <tbody>
              {orgs.map((o: any, i: number) => (
                <tr key={o.organizationId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <Td>{o.organizationName}</Td>
                  <Td>{money(o.revenue?.estimatedMonthly)}</Td>

                  <Td>
                    {o.usage?.locksUsed} / {o.subscription?.entitledLocks ?? 0}
                  </Td>

                  <Td>
                    {o.usage?.smartPropertiesUsed} /{" "}
                    {o.subscription?.entitledSmartProperties ?? 0}
                  </Td>

                  <Td>{o.usage?.smsUsed}</Td>
                  <Td>{o.usage?.automationExecutions}</Td>
                  <Td>{o.usage?.reservations}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------- COMPONENTS ---------- */

function Stat({ title, value, money, percent }: any) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: "#6b7280" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        {money ? formatMoney(value) : percent ? `${value?.toFixed(2)}%` : value}
      </div>
    </div>
  );
}

function StatSmall({ label, value, money }: any) {
  return (
    <div style={metric}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>
        {money ? formatMoney(value) : value}
      </div>
    </div>
  );
}

function SectionCard({ title, children, right }: any) {
  return (
    <div style={section}>
      <div style={sectionHeader}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Th({ children }: any) {
  return <th style={th}>{children}</th>;
}

function Td({ children }: any) {
  return <td style={td}>{children}</td>;
}

/* ---------- STYLES ---------- */

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
};

const section = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const metric = {
  padding: 12,
  background: "#f8fafc",
  borderRadius: 10,
};

const th = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  padding: "14px 16px",
  color: "#6b7280",
};

const td = {
  padding: "14px 16px",
  fontSize: 14,
};

const refreshButton = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}
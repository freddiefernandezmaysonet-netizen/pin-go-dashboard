import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  createHostPayoutOnboardingLink,
  getHostPayoutStatus,
  getHostPayoutTransactions,
  syncHostPayoutStatus,
} from "../../api/payouts";
import type {
  HostPayoutTransaction,
  OrganizationPayoutStatus,
} from "../../api/payouts";

type LoadState = "idle" | "loading" | "ready" | "error";

function getStatusCopy(status?: OrganizationPayoutStatus | null) {
  if (!status) {
    return {
      label: "Loading",
      tone: "neutral",
      title: "Checking payout status",
      description: "Pin&Go is checking whether this host can receive Direct Booking payouts.",
    };
  }

  if (status.canAcceptDirectBookingPayments) {
    return {
      label: "Ready",
      tone: "success",
      title: "Ready to receive payouts",
      description:
        "Direct Booking payments can be accepted and routed to the host payout account.",
    };
  }

  if (status.status === "NOT_CONNECTED") {
    return {
      label: "Not connected",
      tone: "warning",
      title: "Payout account not connected",
      description:
        "Connect Stripe payouts before allowing Direct Booking payments for this organization.",
    };
  }

  if (status.status === "ONBOARDING_REQUIRED") {
    return {
      label: "Setup required",
      tone: "warning",
      title: "Payout setup required",
      description:
        "The host needs to finish Stripe onboarding before Pin&Go can route Direct Booking payouts.",
    };
  }

  if (status.status === "PENDING_VERIFICATION") {
    return {
      label: "Pending verification",
      tone: "warning",
      title: "Stripe verification pending",
      description:
        "Stripe has the payout account, but verification is still pending before payouts are ready.",
    };
  }

  if (status.status === "RESTRICTED") {
    return {
      label: "Action required",
      tone: "danger",
      title: "Payout account restricted",
      description:
        "Stripe requires action before this host can receive Direct Booking payouts.",
    };
  }

  return {
    label: status.status,
    tone: "neutral",
    title: "Payout status unavailable",
    description:
      "Pin&Go could not determine whether this host is ready to receive payouts.",
  };
}

function getToneStyles(tone: string) {
  if (tone === "success") {
    return {
      badge: {
        background: "rgba(22, 163, 74, 0.12)",
        border: "1px solid rgba(22, 163, 74, 0.24)",
        color: "#166534",
      },
      dot: "#16a34a",
    };
  }

  if (tone === "danger") {
    return {
      badge: {
        background: "rgba(220, 38, 38, 0.12)",
        border: "1px solid rgba(220, 38, 38, 0.24)",
        color: "#991b1b",
      },
      dot: "#dc2626",
    };
  }

  if (tone === "warning") {
    return {
      badge: {
        background: "rgba(245, 158, 11, 0.14)",
        border: "1px solid rgba(245, 158, 11, 0.26)",
        color: "#92400e",
      },
      dot: "#f59e0b",
    };
  }

  return {
    badge: {
      background: "rgba(100, 116, 139, 0.12)",
      border: "1px solid rgba(100, 116, 139, 0.24)",
      color: "#334155",
    },
    dot: "#64748b",
  };
}

function formatMoney(amount: number | null, currency: string) {
  if (amount === null || !Number.isFinite(amount)) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function transactionReference(transaction: HostPayoutTransaction) {
  return transaction.reservationNumber || transaction.reservationId;
}

function TransactionFinancials({
  transaction,
}: {
  transaction: HostPayoutTransaction;
}) {
  const actualStripeFee = transaction.stripeProcessingFeeActual;

  return (
    <article
      style={{
        border: "1px solid rgba(148, 163, 184, 0.24)",
        borderRadius: 16,
        padding: 14,
        background: "rgba(255, 255, 255, 0.88)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ display: "block", color: "#0f172a", fontSize: 14 }}>
            {transaction.property.name}
          </strong>
          <span
            style={{
              display: "block",
              marginTop: 3,
              color: "#64748b",
              fontSize: 12,
            }}
          >
            {transactionReference(transaction)} · {new Date(transaction.createdAt).toLocaleDateString()}
          </span>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 11,
            fontWeight: 800,
            background: actualStripeFee
              ? "rgba(22, 163, 74, 0.1)"
              : "rgba(100, 116, 139, 0.1)",
            border: actualStripeFee
              ? "1px solid rgba(22, 163, 74, 0.22)"
              : "1px solid rgba(100, 116, 139, 0.2)",
            color: actualStripeFee ? "#166534" : "#475569",
          }}
        >
          {actualStripeFee ? "Stripe actual" : "Actual fee unavailable"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        <div style={transactionMetricStyle}>
          <span style={transactionMetricLabelStyle}>Guest paid</span>
          <strong style={transactionMetricValueStyle}>
            {formatMoney(transaction.guestPaidAmount, transaction.currency)}
          </strong>
        </div>

        <div style={transactionMetricStyle}>
          <span style={transactionMetricLabelStyle}>Pin&Go fees</span>
          <strong style={transactionMetricValueStyle}>
            {formatMoney(transaction.totalPinGoFeeAmount, transaction.currency)}
          </strong>
        </div>

        <div style={transactionMetricStyle}>
          <span style={transactionMetricLabelStyle}>Stripe processing</span>
          <strong style={transactionMetricValueStyle}>
            {actualStripeFee
              ? formatMoney(transaction.stripeProcessingFeeAmount, transaction.currency)
              : "—"}
          </strong>
        </div>

        <div style={transactionMetricStyle}>
          <span style={transactionMetricLabelStyle}>Host net</span>
          <strong style={transactionMetricValueStyle}>
            {transaction.hostNetAmount !== null
              ? formatMoney(transaction.hostNetAmount, transaction.currency)
              : formatMoney(transaction.recordedHostPayoutAmount, transaction.currency)}
          </strong>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 10,
          color: "#64748b",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        <span>
          {actualStripeFee
            ? "Stripe processing is sourced from Stripe balance-transaction evidence."
            : "Pin&Go does not estimate Stripe processing fees when actual Stripe evidence is unavailable."}
        </span>
        {transaction.lastSyncedAt ? (
          <span>Reconciled {new Date(transaction.lastSyncedAt).toLocaleString()}</span>
        ) : null}
      </div>
    </article>
  );
}

export function HostPayoutsCard() {
  const [status, setStatus] = useState<OrganizationPayoutStatus | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<HostPayoutTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const copy = useMemo(() => getStatusCopy(status), [status]);
  const toneStyles = useMemo(() => getToneStyles(copy.tone), [copy.tone]);

  async function loadStatus(options?: { sync?: boolean }) {
    try {
      setError(null);
      setLoadState("loading");

      const response = options?.sync
        ? await syncHostPayoutStatus()
        : await getHostPayoutStatus();

      setStatus(response.payoutStatus);
      setLoadState("ready");
    } catch (err: any) {
      setLoadState("error");
      setError(err?.message || "Unable to load payout status.");
    }
  }

  async function loadTransactions() {
    try {
      setTransactionsError(null);
      setTransactionsLoading(true);
      const response = await getHostPayoutTransactions(10);
      setTransactions(response.items);
    } catch {
      setTransactionsError(
        "Detailed Stripe financial evidence is not available from the current backend environment."
      );
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function handleSetupPayouts() {
    try {
      setError(null);
      setActionLoading(true);

      const response = await createHostPayoutOnboardingLink();

      window.location.assign(response.onboardingLink.url);
    } catch (err: any) {
      setError(err?.message || "Unable to create Stripe onboarding link.");
      setActionLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      setActionLoading(true);
      await Promise.all([loadStatus({ sync: true }), loadTransactions()]);
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    loadTransactions();
  }, []);

  const isReady = Boolean(status?.canAcceptDirectBookingPayments);
  const showSetupButton = !isReady;

  return (
    <section
      style={{
        border: "1px solid rgba(148, 163, 184, 0.28)",
        borderRadius: 20,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Host Payouts
          </p>

          <h3
            style={{
              margin: "8px 0 0",
              fontSize: 20,
              lineHeight: 1.2,
              color: "#0f172a",
            }}
          >
            {copy.title}
          </h3>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.55,
              color: "#475569",
              maxWidth: 640,
            }}
          >
            {copy.description}
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
            ...toneStyles.badge,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: toneStyles.dot,
            }}
          />
          {copy.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginTop: 18,
        }}
      >
        <div style={metricBoxStyle}>
          <span style={metricLabelStyle}>Charges</span>
          <strong style={metricValueStyle}>
            {status?.chargesEnabled ? "Enabled" : "Disabled"}
          </strong>
        </div>

        <div style={metricBoxStyle}>
          <span style={metricLabelStyle}>Payouts</span>
          <strong style={metricValueStyle}>
            {status?.payoutsEnabled ? "Enabled" : "Disabled"}
          </strong>
        </div>

        <div style={metricBoxStyle}>
          <span style={metricLabelStyle}>Direct Booking</span>
          <strong style={metricValueStyle}>{isReady ? "Allowed" : "Blocked"}</strong>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          borderRadius: 16,
          padding: "14px 16px",
          background: "rgba(248, 250, 252, 0.92)",
          border: "1px solid rgba(148, 163, 184, 0.24)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 480px" }}>
            <strong
              style={{
                display: "block",
                color: "#0f172a",
                fontSize: 14,
              }}
            >
              Stripe reference pricing
            </strong>
            <p
              style={{
                margin: "6px 0 0",
                color: "#475569",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Stripe standard pricing for successful domestic card transactions is{" "}
              <strong>2.9% + $0.30</strong>. Additional Stripe fees may apply for
              international cards, currency conversion, or other payment methods.
            </p>
            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              This is reference pricing only. Exact processing fees are shown below only when
              Pin&Go has actual Stripe balance-transaction evidence.
            </p>
          </div>

          <a
            href="https://stripe.com/pricing"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            View Stripe pricing ↗
          </a>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          borderRadius: 16,
          padding: "16px",
          background: "rgba(248, 250, 252, 0.72)",
          border: "1px solid rgba(148, 163, 184, 0.24)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ display: "block", color: "#0f172a", fontSize: 15 }}>
              Recent Direct Booking financials
            </strong>
            <p
              style={{
                margin: "5px 0 0",
                color: "#64748b",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Guest payment, Pin&Go fees, actual Stripe processing cost, and host net are kept
              separate so the host can see the real transaction economics.
            </p>
          </div>
        </div>

        {transactionsLoading ? (
          <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 13 }}>
            Loading financial evidence…
          </p>
        ) : transactionsError ? (
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              padding: "11px 12px",
              background: "rgba(241, 245, 249, 0.86)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              color: "#475569",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {transactionsError}
          </div>
        ) : transactions.length === 0 ? (
          <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 13 }}>
            No Direct Booking financial transactions are available yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {transactions.map((transaction) => (
              <TransactionFinancials
                key={transaction.reservationId}
                transaction={transaction}
              />
            ))}
          </div>
        )}
      </div>

      {status?.disabledReason ? (
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            padding: "12px 14px",
            background: "rgba(254, 242, 242, 0.9)",
            border: "1px solid rgba(252, 165, 165, 0.35)",
            color: "#991b1b",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <strong>Stripe disabled reason:</strong> {status.disabledReason}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            padding: "12px 14px",
            background: "rgba(254, 242, 242, 0.9)",
            border: "1px solid rgba(252, 165, 165, 0.35)",
            color: "#991b1b",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#64748b",
          }}
        >
          {status?.lastSyncedAt
            ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}`
            : "Status has not been synced yet."}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={actionLoading || loadState === "loading"}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.42)",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 12,
              padding: "10px 14px",
              fontWeight: 800,
              cursor:
                actionLoading || loadState === "loading" ? "not-allowed" : "pointer",
              opacity: actionLoading || loadState === "loading" ? 0.65 : 1,
            }}
          >
            Refresh status
          </button>

          {showSetupButton ? (
            <button
              type="button"
              onClick={handleSetupPayouts}
              disabled={actionLoading}
              style={{
                border: "1px solid rgba(37, 99, 235, 0.25)",
                background: "#2563eb",
                color: "#ffffff",
                borderRadius: 12,
                padding: "10px 14px",
                fontWeight: 900,
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              Set up payouts
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const metricBoxStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(255, 255, 255, 0.82)",
};

const metricLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const metricValueStyle: CSSProperties = {
  display: "block",
  marginTop: 6,
  fontSize: 16,
  color: "#0f172a",
};

const transactionMetricStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: 12,
  padding: "10px 11px",
  background: "rgba(248, 250, 252, 0.78)",
};

const transactionMetricLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const transactionMetricValueStyle: CSSProperties = {
  display: "block",
  marginTop: 5,
  fontSize: 14,
  color: "#0f172a",
};

export default HostPayoutsCard;
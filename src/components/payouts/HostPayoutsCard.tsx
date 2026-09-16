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

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function hasActualStripeEvidence(transaction: HostPayoutTransaction) {
  return (
    transaction.stripeFeeSource === "STRIPE_BALANCE_TRANSACTION" &&
    transaction.stripeProcessingFeeActual &&
    transaction.applicationFeeActual
  );
}

function isRefundedTransaction(transaction: HostPayoutTransaction) {
  return (
    transaction.paymentState === "REFUNDED" ||
    transaction.paymentState === "PARTIALLY_REFUNDED" ||
    transaction.hostPayoutStatus === "REFUNDED" ||
    transaction.hostPayoutStatus === "PARTIALLY_REFUNDED"
  );
}

export function HostPayoutsCard() {
  const [status, setStatus] = useState<OrganizationPayoutStatus | null>(null);
  const [transactions, setTransactions] = useState<HostPayoutTransaction[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const copy = useMemo(() => getStatusCopy(status), [status]);
  const toneStyles = useMemo(() => getToneStyles(copy.tone), [copy.tone]);
  const hasRefundedTransactions = useMemo(
    () => transactions.some(isRefundedTransaction),
    [transactions]
  );

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
      setTransactionsLoading(true);
      setTransactionsError(null);

      const response = await getHostPayoutTransactions(10);
      setTransactions(response.items);
    } catch (err: any) {
      setTransactions([]);
      setTransactionsError(
        err?.message || "Unable to load Direct Booking financial details."
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
    void loadStatus();
    void loadTransactions();
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
              Actual Stripe financial evidence
            </strong>
            <p
              style={{
                margin: "6px 0 0",
                color: "#475569",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              For Direct Charges, Pin&Go displays the Stripe processing fee,
              application fee, and host net only when they are reconciled from the
              connected account&apos;s Stripe balance transaction. Legacy bookings are not
              estimated.
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
          marginTop: 16,
          border: "1px solid rgba(148, 163, 184, 0.24)",
          borderRadius: 16,
          background: "rgba(255, 255, 255, 0.86)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ display: "block", fontSize: 15, color: "#0f172a" }}>
              Direct Booking financials
            </strong>
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.45,
                color: "#64748b",
              }}
            >
              Latest reservations. “Actual” values come from Stripe balance evidence;
              legacy values are clearly labeled as recorded data.
            </span>
          </div>

          {transactionsLoading ? (
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              Loading financials…
            </span>
          ) : null}
        </div>

        {transactionsError ? (
          <div
            style={{
              padding: 16,
              color: "#64748b",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Financial transaction details are not available yet. Payout account status
            and onboarding remain available.
          </div>
        ) : transactions.length === 0 && !transactionsLoading ? (
          <div
            style={{
              padding: 16,
              color: "#64748b",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            No Direct Booking financial records are available yet.
          </div>
        ) : transactions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 940,
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "rgba(248, 250, 252, 0.92)" }}>
                  <th style={tableHeaderStyle}>Reservation</th>
                  <th style={tableHeaderStyle}>Guest paid</th>
                  <th style={tableHeaderStyle}>Pin&Go fee</th>
                  <th style={tableHeaderStyle}>Stripe fee</th>
                  <th style={tableHeaderStyle}>Host amount</th>
                  <th style={tableHeaderStyle}>Evidence</th>
                  <th style={tableHeaderStyle}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const actualEvidence = hasActualStripeEvidence(transaction);
                  const refunded = isRefundedTransaction(transaction);
                  const pingoFeeAmount = transaction.applicationFeeActual
                    ? transaction.applicationFeeAmount
                    : transaction.totalPinGoFeeAmount;
                  const hostAmount = actualEvidence
                    ? transaction.hostNetAmount
                    : transaction.recordedHostPayoutAmount;

                  return (
                    <tr
                      key={transaction.reservationId}
                      style={{ borderTop: "1px solid rgba(148, 163, 184, 0.16)" }}
                    >
                      <td style={tableCellStyle}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {transaction.reservationNumber || "Direct Booking"}
                        </strong>
                        <span style={tableSubtextStyle}>{transaction.property.name}</span>
                        <span style={tableSubtextStyle}>
                          {formatDate(transaction.createdAt)}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{ color: "#0f172a" }}>
                          {formatMoney(transaction.guestPaidAmount, transaction.currency)}
                        </strong>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {formatMoney(pingoFeeAmount, transaction.currency)}
                        </strong>
                        <span style={tableSubtextStyle}>
                          {transaction.applicationFeeActual
                            ? "Actual application fee"
                            : "Recorded Pin&Go fee"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {transaction.stripeProcessingFeeActual
                            ? formatMoney(
                                transaction.stripeProcessingFeeAmount,
                                transaction.currency
                              )
                            : "—"}
                        </strong>
                        <span style={tableSubtextStyle}>
                          {transaction.stripeProcessingFeeActual
                            ? "Actual Stripe fee"
                            : "Not estimated"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {formatMoney(hostAmount, transaction.currency)}
                        </strong>
                        <span style={tableSubtextStyle}>
                          {actualEvidence
                            ? refunded
                              ? "Original host net"
                              : "Actual host net"
                            : "Recorded host payout"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 999,
                            padding: "5px 8px",
                            fontSize: 11,
                            fontWeight: 800,
                            background: actualEvidence
                              ? "rgba(22, 163, 74, 0.10)"
                              : "rgba(100, 116, 139, 0.10)",
                            color: actualEvidence ? "#166534" : "#475569",
                          }}
                        >
                          {actualEvidence ? "Stripe actual" : "Legacy / recorded"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{ display: "block", color: "#334155" }}>
                          {transaction.paymentState}
                        </strong>
                        <span style={tableSubtextStyle}>
                          Payout: {transaction.hostPayoutStatus}
                        </span>
                        {refunded && actualEvidence ? (
                          <span
                            style={{
                              display: "block",
                              marginTop: 4,
                              color: "#92400e",
                              fontSize: 11,
                              lineHeight: 1.35,
                            }}
                          >
                            Original charge values shown
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {hasRefundedTransactions ? (
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(245, 158, 11, 0.20)",
              background: "rgba(255, 251, 235, 0.70)",
              color: "#92400e",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            Refunded transactions currently show the financial evidence from the original
            Stripe charge. Host net is labeled “Original host net” until refund-aware net
            reconciliation is certified.
          </div>
        ) : null}
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

const tableHeaderStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#64748b",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tableCellStyle: CSSProperties = {
  padding: "12px",
  verticalAlign: "top",
  color: "#475569",
};

const tableSubtextStyle: CSSProperties = {
  display: "block",
  marginTop: 3,
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.35,
};

export default HostPayoutsCard;
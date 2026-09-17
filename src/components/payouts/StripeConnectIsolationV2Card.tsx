import { useEffect, useRef, useState } from "react";
import {
  createStripeConnectIsolationV2AccountSession,
  getHostPayoutStatus,
  type OrganizationPayoutStatus,
  type StripeConnectIsolationV2AccountSession,
} from "../../api/payouts";

const CONNECT_JS_SRC = "https://connect-js.stripe.com/v1.0/connect.js";

type StripeConnectElement = HTMLElement & {
  setOnLoadError?: (handler: (event: unknown) => void) => void;
  setOnLoaderStart?: (handler: (event: unknown) => void) => void;
};

type StripeConnectInstance = {
  create(name: "payments"): StripeConnectElement;
};

type StripeConnectGlobal = {
  onLoad?: () => void;
  init?: (options: {
    publishableKey: string;
    fetchClientSecret: () => Promise<string | undefined>;
    locale?: string;
    appearance?: {
      overlays?: "dialog" | "drawer";
      variables?: Record<string, string>;
    };
  }) => StripeConnectInstance;
};

declare global {
  interface Window {
    StripeConnect?: StripeConnectGlobal;
  }
}

export function stripeConnectIsolationV2UiEnabled() {
  return (
    String(import.meta.env.VITE_STRIPE_CONNECT_ISOLATION_V2_ENABLED ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getPublishableKey() {
  return String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "").trim();
}

function loadConnectJs(): Promise<StripeConnectGlobal> {
  if (window.StripeConnect?.init) {
    return Promise.resolve(window.StripeConnect);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CONNECT_JS_SRC}"]`
    );

    const handleLoaded = () => {
      if (!window.StripeConnect) {
        reject(new Error("STRIPE_CONNECT_JS_UNAVAILABLE"));
        return;
      }
      resolve(window.StripeConnect);
    };

    window.StripeConnect = window.StripeConnect ?? {};
    window.StripeConnect.onLoad = handleLoaded;

    if (existing) {
      if (window.StripeConnect.init) {
        handleLoaded();
      } else {
        existing.addEventListener("load", handleLoaded, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("STRIPE_CONNECT_JS_LOAD_FAILED")),
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = CONNECT_JS_SRC;
    script.async = true;
    script.addEventListener("load", handleLoaded, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("STRIPE_CONNECT_JS_LOAD_FAILED")),
      { once: true }
    );
    document.head.appendChild(script);
  });
}

function statusLabel(status: OrganizationPayoutStatus | null) {
  if (!status) return "Checking";
  if (status.canAcceptDirectBookingPayments) return "Ready";
  if (status.status === "NOT_CONNECTED") return "Not connected";
  if (status.status === "RESTRICTED") return "Action required";
  if (status.status === "ONBOARDING_REQUIRED") return "Setup required";
  if (status.status === "PENDING_VERIFICATION") return "Pending verification";
  return status.status;
}

export function StripeConnectIsolationV2Card() {
  const paymentsContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<OrganizationPayoutStatus | null>(null);
  const [accountContext, setAccountContext] =
    useState<StripeConnectIsolationV2AccountSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [embeddedVisible, setEmbeddedVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishableKey = getPublishableKey();

  useEffect(() => {
    let cancelled = false;

    getHostPayoutStatus()
      .then((response) => {
        if (!cancelled) setStatus(response.payoutStatus);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load payout status.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stripeConnectIsolationV2UiEnabled()) return;
    if (!publishableKey) return;
    if (!status?.stripeConnectAccountId) return;

    let cancelled = false;
    let mountedElement: StripeConnectElement | null = null;

    const fetchClientSecret = async () => {
      try {
        const response = await createStripeConnectIsolationV2AccountSession();
        if (!cancelled) setAccountContext(response.accountSession);
        return response.accountSession.clientSecret;
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to create the isolated Stripe session."
          );
        }
        return undefined;
      }
    };

    loadConnectJs()
      .then((stripeConnect) => {
        if (cancelled || !stripeConnect.init || !paymentsContainerRef.current) {
          return;
        }

        const instance = stripeConnect.init({
          publishableKey,
          fetchClientSecret,
          locale: "es-419",
          appearance: {
            overlays: "dialog",
            variables: {
              colorPrimary: "#2563eb",
            },
          },
        });

        const payments = instance.create("payments");
        mountedElement = payments;
        payments.setOnLoaderStart?.(() => {
          if (!cancelled) setEmbeddedVisible(true);
        });
        payments.setOnLoadError?.(() => {
          if (!cancelled) {
            setError("Stripe payments could not be loaded for this organization.");
          }
        });

        paymentsContainerRef.current.replaceChildren(payments);
      })
      .catch(() => {
        if (!cancelled) setError("Stripe Connect could not be loaded.");
      });

    return () => {
      cancelled = true;
      mountedElement?.remove();
    };
  }, [publishableKey, status?.stripeConnectAccountId]);

  if (!stripeConnectIsolationV2UiEnabled()) {
    return null;
  }

  return (
    <section
      style={{
        border: "1px solid rgba(37, 99, 235, 0.2)",
        borderRadius: 20,
        background: "#ffffff",
        padding: 20,
        boxShadow: "0 16px 36px rgba(15, 23, 42, 0.06)",
        display: "grid",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "#2563eb",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Stripe Connect Isolation V2
          </div>
          <h3 style={{ margin: "8px 0 0", fontSize: 21, color: "#0f172a" }}>
            Payments & Payouts
          </h3>
          <p
            style={{
              margin: "8px 0 0",
              maxWidth: 720,
              color: "#475569",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            Stripe access is scoped server-side to this Pin&Go organization.
            The browser cannot select or submit a different connected account.
          </p>
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "7px 11px",
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {loading ? "Checking" : statusLabel(status)}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div style={metricStyle}>
          <span style={metricLabelStyle}>Organization</span>
          <strong style={metricValueStyle}>
            {accountContext?.organizationName ?? "Current organization"}
          </strong>
        </div>
        <div style={metricStyle}>
          <span style={metricLabelStyle}>Connected account</span>
          <strong style={metricValueStyle}>
            {accountContext?.accountDisplayId ?? "Server scoped"}
          </strong>
        </div>
        <div style={metricStyle}>
          <span style={metricLabelStyle}>Payouts</span>
          <strong style={metricValueStyle}>
            {status?.payoutsEnabled ? "Enabled" : "Not ready"}
          </strong>
        </div>
      </div>

      {!publishableKey ? (
        <div style={noticeStyle}>
          Isolation V2 is enabled in the UI, but the Stripe publishable key is
          not configured for this build. No external Stripe Dashboard link is
          used as a fallback.
        </div>
      ) : null}

      {!status?.stripeConnectAccountId && !loading ? (
        <div style={noticeStyle}>
          This organization does not have a connected Stripe account. V2
          onboarding for new no-dashboard accounts is intentionally not active
          in this phase.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 14,
            padding: "12px 14px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {status?.stripeConnectAccountId && publishableKey ? (
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: "#0f172a",
              marginBottom: 10,
            }}
          >
            Payments
          </div>
          {!embeddedVisible ? (
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 10 }}>
              Loading the organization-scoped Stripe payments view…
            </div>
          ) : null}
          <div ref={paymentsContainerRef} style={{ minHeight: 120 }} />
        </div>
      ) : null}

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: "#64748b",
          borderTop: "1px solid #e2e8f0",
          paddingTop: 14,
        }}
      >
        Payout readiness is shown from Pin&Go&apos;s organization-scoped record.
        Money-moving actions remain disabled in the Isolation V2 Account Session
        during this canary phase.
      </div>
    </section>
  );
}

const metricStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  background: "#f8fafc",
};

const metricLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#64748b",
};

const metricValueStyle: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  fontSize: 15,
  color: "#0f172a",
  overflowWrap: "anywhere",
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { fetchProperties } from "../../api/properties";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "http://localhost:3000" : "");

type SignupSuccessStatusResponse = {
  ok: boolean;
  ready?: boolean;
  autoLoggedIn?: boolean;
  requiresLogin?: boolean;
  status?: string;
  error?: string;
};

export default function SignupSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const sessionId = params.get("session_id");
  const hasSessionId = Boolean(sessionId);

  const [loading, setLoading] = useState(hasSessionId);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(
    hasSessionId ? "" : "Missing session id"
  );

  const finishedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    let attempts = 0;
    const maxAttempts = 8;

    async function poll() {
      if (cancelled || finishedRef.current) return;

      try {
        const res = await fetch(
          `${API_BASE}/api/public/signup-success-status?session_id=${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const data = (await res.json()) as SignupSuccessStatusResponse;

        if (cancelled || finishedRef.current) return;

        // Backward-compatible rollout path while the old backend can still
        // return an authenticated cookie during the coordinated E7 deploy.
        if (data.ok && data.ready && data.autoLoggedIn) {
          finishedRef.current = true;

          await refresh();

          if (cancelled) return;

          const propsData = await fetchProperties();

          if (cancelled) return;

          if (!propsData?.items?.length) {
            navigate("/onboarding/property", { replace: true });
            return;
          }

          navigate("/overview", { replace: true });
          return;
        }

        // E7 contract: account provisioning is complete, but authentication
        // must happen through the normal password + Email MFA login flow.
        if (data.ok && data.ready && data.requiresLogin) {
          finishedRef.current = true;
          setReady(true);
          setLoading(false);
          return;
        }

        attempts += 1;

        if (attempts >= maxAttempts) {
          setLoading(false);
          return;
        }

        timeoutId = window.setTimeout(poll, 1500);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to verify signup");
        setLoading(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [sessionId, navigate, refresh]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
          padding: 28,
        }}
      >
        {loading ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#dbeafe",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 28,
                  marginBottom: 16,
                }}
              >
                ⏳
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Preparing your workspace...
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                Your payment was successful. Pin&Go is finishing your account setup securely.
              </div>
            </div>

            {sessionId ? (
              <div
                style={{
                  borderRadius: 12,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  color: "#6b7280",
                  fontSize: 12,
                  padding: "10px 12px",
                  wordBreak: "break-all",
                }}
              >
                <strong style={{ color: "#374151" }}>Session ID:</strong> {sessionId}
              </div>
            ) : null}
          </>
        ) : ready ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#dcfce7",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 28,
                  marginBottom: 16,
                }}
              >
                ✅
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Account ready
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Your Pin&Go workspace is ready. Continue with secure sign-in. On a new or untrusted browser, Pin&Go will send a verification code to your account email.
              </div>

              <button
                type="button"
                onClick={() => navigate("/login?signup=complete", { replace: true })}
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Continue to secure sign in
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#fef3c7",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 28,
                  marginBottom: 16,
                }}
              >
                ⚠️
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Setup still in progress
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                Your payment was received, but the account setup is taking a bit longer than expected.
                You can sign in manually in a moment.
              </div>
            </div>

            {error ? (
              <div
                style={{
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 13,
                  padding: "10px 12px",
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12 }}>
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Go to login
              </button>

              <Link
                to="/signup"
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to signup
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

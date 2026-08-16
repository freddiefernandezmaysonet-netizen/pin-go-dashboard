import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword, verifyForgotPasswordCode } from "../../api/password";
import { useBrand } from "../../branding/BrandProvider";

export default function ForgotPasswordPage() {
  const { brand, isCustomBrand } = useBrand();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await forgotPassword(cleanEmail);

      if (!result.ok && result.error) {
        setError("We could not send the verification code. Please try again.");
        return;
      }

      setEmail(cleanEmail);
      setStep("code");
      setMessage(
        result.message ||
          "If the account exists, a verification code has been sent by text message."
      );
    } catch {
      setStep("code");
      setMessage(
        "If the account exists, a verification code has been sent by text message."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setError("Please enter the 6-digit code sent by text message.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await verifyForgotPasswordCode(email, cleanCode);

      if (!result.ok) {
        setError("Invalid or expired code. Please request a new code.");
        return;
      }

      setStep("done");
      setMessage(
        result.message ||
          "Code verified. Please check your email for the password reset link."
      );
    } catch {
      setError("Invalid or expired code. Please request a new code.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetToEmailStep() {
    setStep("email");
    setCode("");
    setError("");
    setMessage("");
  }

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
          maxWidth: 420,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          {isCustomBrand && brand.kind === "CUSTOM_BRAND" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <img
                src={brand.logoUrl}
                alt={`${brand.displayName} logo`}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "contain",
                  borderRadius: 12,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#111827",
                    lineHeight: 1.1,
                  }}
                >
                  {brand.displayName}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    color: "#9ca3af",
                    fontSize: 11,
                  }}
                >
                  Powered by Pin&Go
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#111827",
                marginBottom: 6,
              }}
            >
              Pin&Go
            </div>
          )}

          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            {step === "email"
              ? "Enter your account email and we will send a verification code by text message."
              : step === "code"
              ? "Enter the 6-digit code sent to your phone. After verification, we will email your password reset link."
              : "Your verification was completed. Check your email for the password reset link."}
          </div>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} style={{ display: "grid", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                type="email"
                placeholder={isCustomBrand ? "name@example.com" : "admin@pingo.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  padding: "0 14px",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error ? <Alert type="error" text={error} /> : null}
            {message ? <Alert type="info" text={message} /> : null}

            <button
              type="submit"
              disabled={submitting}
              style={buttonStyle(submitting, isCustomBrand)}
            >
              {submitting ? "Sending..." : "Send verification code"}
            </button>
          </form>
        ) : null}

        {step === "code" ? (
          <form onSubmit={handleVerifyCode} style={{ display: "grid", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  padding: "0 14px",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 3,
                }}
              />
            </div>

            {error ? <Alert type="error" text={error} /> : null}
            {message ? <Alert type="info" text={message} /> : null}

            <button
              type="submit"
              disabled={submitting}
              style={buttonStyle(submitting, isCustomBrand)}
            >
              {submitting ? "Verifying..." : "Verify code"}
            </button>

            <button
              type="button"
              onClick={resetToEmailStep}
              style={{
                border: "none",
                background: "transparent",
                color: isCustomBrand
                  ? "var(--brand-primary-color, #2563eb)"
                  : "#2563eb",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Use a different email or resend code
            </button>
          </form>
        ) : null}

        {step === "done" ? (
          <div style={{ display: "grid", gap: 14 }}>
            {message ? <Alert type="info" text={message} /> : null}

            <Link
              to="/login"
              style={{
                height: 46,
                borderRadius: 12,
                background: isCustomBrand
                  ? "var(--brand-primary-color, #2563eb)"
                  : "#2563eb",
                color: isCustomBrand
                  ? "var(--brand-on-primary-color, #ffffff)"
                  : "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                display: "grid",
                placeItems: "center",
                textDecoration: "none",
              }}
            >
              Back to sign in
            </Link>
          </div>
        ) : null}

        {step !== "done" ? (
          <div
            style={{
              marginTop: 18,
              fontSize: 13,
              color: "#6b7280",
              textAlign: "center",
            }}
          >
            Back to{" "}
            <Link
              to="/login"
              style={{
                color: isCustomBrand
                  ? "var(--brand-primary-color, #2563eb)"
                  : "#2563eb",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Alert({ type, text }: { type: "error" | "info"; text: string }) {
  const isError = type === "error";

  return (
    <div
      style={{
        borderRadius: 12,
        background: isError ? "#fef2f2" : "#eff6ff",
        border: isError ? "1px solid #fecaca" : "1px solid #bfdbfe",
        color: isError ? "#b91c1c" : "#1d4ed8",
        fontSize: 13,
        padding: "10px 12px",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function buttonStyle(
  disabled: boolean,
  useCustomBrand: boolean
): React.CSSProperties {
  return {
    height: 46,
    borderRadius: 12,
    border: "none",
    background: disabled
      ? "#93c5fd"
      : useCustomBrand
        ? "var(--brand-primary-color, #2563eb)"
        : "#2563eb",
    color: useCustomBrand
      ? "var(--brand-on-primary-color, #ffffff)"
      : "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    marginTop: 4,
  };
}

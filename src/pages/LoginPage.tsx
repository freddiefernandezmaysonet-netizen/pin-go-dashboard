import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  login,
  resendLoginMfa,
  verifyLoginMfa,
  type LoginMfaRequired,
} from "../api/auth";
import { fetchProperties } from "../api/properties";
import { useAuth } from "../auth/AuthProvider";
import { sessionNoticeFromSearch } from "../auth/sessionExpiry";
import { useBrand } from "../branding/BrandProvider";

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { brand, isCustomBrand } = useBrand();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mfa, setMfa] = useState<LoginMfaRequired | null>(null);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [expiresRemaining, setExpiresRemaining] = useState(0);

  const logoUrl =
    brand.kind === "CUSTOM_BRAND" ? brand.logoUrl : "/pin-go-logo.png";
  const brandPanelColor =
    brand.kind === "CUSTOM_BRAND" ? brand.primaryColor : "#0f172a";
  const brandPanelTextColor =
    brand.kind === "CUSTOM_BRAND" ? brand.onPrimaryColor : "#ffffff";
  const brandButtonColor =
    brand.kind === "CUSTOM_BRAND" ? brand.primaryColor : "#2563eb";
  const brandButtonTextColor =
    brand.kind === "CUSTOM_BRAND" ? brand.onPrimaryColor : "#ffffff";
  const sessionNotice = sessionNoticeFromSearch(window.location.search);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!mfa) {
      setResendRemaining(0);
      setExpiresRemaining(0);
      return;
    }

    setResendRemaining(Math.max(0, mfa.resendAfterSeconds));

    const updateExpiry = () => {
      const expiresAt = new Date(mfa.expiresAt).getTime();
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setExpiresRemaining(seconds);
    };

    updateExpiry();
    const timer = window.setInterval(() => {
      setResendRemaining((value) => Math.max(0, value - 1));
      updateExpiry();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [mfa]);

  async function finishSignIn() {
    await refresh();
    const propsData = await fetchProperties();

    if (!propsData.items?.length) {
      navigate("/onboarding/property");
      return;
    }

    navigate("/overview");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(email, password);

      if ("mfaRequired" in result && result.mfaRequired) {
        setMfa(result);
        setCode("");
        setTrustDevice(false);
        return;
      }

      await finishSignIn();
    } catch {
      setError("Invalid email or password / Correo o contraseña incorrectos");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfa) return;

    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6) {
      setError("Enter the 6-digit code / Ingresa el código de 6 dígitos");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await verifyLoginMfa({
        challengeToken: mfa.challengeToken,
        code: normalizedCode,
        trustDevice,
      });
      await finishSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "MFA_VERIFY_FAILED";
      if (message === "MFA_INVALID_CODE") {
        setError("Incorrect code / Código incorrecto");
      } else if (message === "MFA_LOCKED") {
        setError("Too many attempts. Sign in again / Demasiados intentos. Inicia sesión nuevamente");
      } else if (message === "MFA_EXPIRED") {
        setError("Code expired. Sign in again / El código expiró. Inicia sesión nuevamente");
      } else if (message === "MFA_NOT_ACTIVE") {
        setError("Security verification changed. Sign in again / La verificación cambió. Inicia sesión nuevamente");
      } else {
        setError("We could not verify the code / No pudimos verificar el código");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!mfa || resendRemaining > 0 || submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const result = await resendLoginMfa(mfa.challengeToken);
      setMfa(result);
      setCode("");
    } catch (err) {
      const retryAfter =
        typeof err === "object" && err !== null && "retryAfterSeconds" in err
          ? Number((err as { retryAfterSeconds?: number }).retryAfterSeconds ?? 0)
          : 0;
      if (retryAfter > 0) setResendRemaining(retryAfter);
      setError("We could not resend the code / No pudimos reenviar el código");
    } finally {
      setSubmitting(false);
    }
  }

  function resetMfa() {
    setMfa(null);
    setCode("");
    setPassword("");
    setTrustDevice(false);
    setError("");
  }

  const expiryLabel =
    expiresRemaining > 0
      ? `${Math.floor(expiresRemaining / 60)}:${String(expiresRemaining % 60).padStart(2, "0")}`
      : "0:00";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--brand-primary-color, #2563eb) 10%, transparent), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        display: "grid",
        placeItems: "center",
        padding: isMobile ? 16 : 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          display: "grid",
          gridTemplateColumns: "1fr",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: brandPanelColor,
            color: brandPanelTextColor,
            padding: isMobile ? 26 : 40,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={logoUrl}
              alt={`${brand.displayName} logo`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                width: 48,
                height: 48,
                objectFit: "contain",
                borderRadius: 10,
                background: "rgba(255,255,255,0.12)",
                padding: 6,
              }}
            />

            <div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>
                {brand.displayName}
              </div>
              <div style={{ fontSize: 13, opacity: 0.72 }}>
                Secure Access Made Simple
              </div>
            </div>
          </div>

          <h1 style={{ marginTop: 30, fontSize: isMobile ? 30 : 36 }}>
            {mfa ? "Security check" : "Welcome back"}
          </h1>

          <p style={{ marginTop: 10, lineHeight: 1.7, opacity: 0.72 }}>
            {mfa
              ? "Confirm it’s you with the code sent to your email. / Confirma tu identidad con el código enviado a tu email."
              : "Manage access, automate operations, and deliver a seamless guest experience."}
          </p>

          {!mfa ? (
            <ul style={{ marginTop: 20, lineHeight: 1.8, paddingLeft: 20 }}>
              <li>✔ Access control & NFC</li>
              <li>✔ PMS integrations</li>
              <li>✔ Smart automation</li>
            </ul>
          ) : null}

          {isCustomBrand && brand.poweredByPinGo ? (
            <div style={{ marginTop: 24, fontSize: 11, opacity: 0.65 }}>
              Powered by Pin&Go
            </div>
          ) : null}
        </div>

        <div style={{ padding: isMobile ? 26 : 40 }}>
          {!mfa ? (
            <>
              <h2 style={{ marginTop: 0 }}>Sign in</h2>

              {sessionNotice ? (
                <div
                  role="status"
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    color: "#1e3a8a",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {sessionNotice}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  style={inputStyle}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={inputStyle}
                />

                <div style={{ textAlign: "right" }}>
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>

                {error && <div style={{ color: "#b91c1c" }}>{error}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...btn,
                    background: brandButtonColor,
                    color: brandButtonTextColor,
                  }}
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>
              </form>

              {!isCustomBrand ? (
                <div style={{ marginTop: 20 }}>
                  Don&apos;t have an account? <Link to="/signup">Create one</Link>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>Verification code</h2>
              <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.6 }}>
                We sent a 6-digit code to <strong>{mfa.destination}</strong>.
                <br />
                Enviamos un código de 6 dígitos a tu correo.
              </p>

              <form onSubmit={handleVerify} style={{ display: "grid", gap: 14 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  aria-label="Six digit security code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{
                    ...inputStyle,
                    height: 54,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: 8,
                    textAlign: "center",
                  }}
                />

                <div style={{ fontSize: 13, color: expiresRemaining > 0 ? "#475569" : "#b91c1c" }}>
                  Code expires in {expiryLabel} / Expira en {expiryLabel}
                </div>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 14,
                    color: "#334155",
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    Trust this device for 30 days
                    <br />
                    Confiar en este dispositivo durante 30 días
                  </span>
                </label>

                {error && <div style={{ color: "#b91c1c" }}>{error}</div>}

                <button
                  type="submit"
                  disabled={submitting || expiresRemaining <= 0}
                  style={{
                    ...btn,
                    background: brandButtonColor,
                    color: brandButtonTextColor,
                  }}
                >
                  {submitting ? "Verifying..." : "Verify / Verificar"}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={submitting || resendRemaining > 0}
                  style={secondaryBtn}
                >
                  {resendRemaining > 0
                    ? `Resend in ${resendRemaining}s / Reenviar en ${resendRemaining}s`
                    : "Resend code / Reenviar código"}
                </button>

                <button type="button" onClick={resetMfa} style={linkBtn}>
                  Use another account / Usar otra cuenta
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  boxSizing: "border-box",
};

const btn: React.CSSProperties = {
  height: 46,
  borderRadius: 12,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#475569",
  cursor: "pointer",
  textDecoration: "underline",
  padding: 6,
};
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { fetchProperties } from "../api/properties";
import { useAuth } from "../auth/AuthProvider";
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

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      await refresh();

      const propsData = await fetchProperties();

      if (!propsData.items?.length) {
        navigate("/onboarding/property");
        return;
      }

      navigate("/overview");
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

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
            Welcome back 
          </h1>

          <p style={{ marginTop: 10, lineHeight: 1.7, opacity: 0.72 }}>
            Manage access, automate operations, and deliver a seamless guest
            experience.
          </p>

          <ul style={{ marginTop: 20, lineHeight: 1.8, paddingLeft: 20 }}>
            <li>✔ Access control & NFC</li>
            <li>✔ PMS integrations</li>
            <li>✔ Smart automation</li>
          </ul>

          {isCustomBrand && brand.poweredByPinGo ? (
            <div style={{ marginTop: 24, fontSize: 11, opacity: 0.65 }}>
              Powered by Pin&Go
            </div>
          ) : null}
        </div>

        <div style={{ padding: isMobile ? 26 : 40 }}>
          <h2 style={{ marginTop: 0 }}>Sign in</h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <div style={{ textAlign: "right" }}>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            {error && <div style={{ color: "red" }}>{error}</div>}

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

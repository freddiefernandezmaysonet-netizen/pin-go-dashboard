import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import {
  AirbnbHostSelfServiceApiError,
  verifyAirbnbHostCallback,
} from "../../api/airbnbHostSelfService";
import { useAuth } from "../../auth/AuthProvider";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "ADMIN", "PLATFORM_ADMIN"]);

export function AirbnbConnectionCallbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const started = useRef(false);
  const [status, setStatus] = useState<"VERIFYING" | "SUCCESS" | "FAILED">("VERIFYING");
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [message, setMessage] = useState("Estamos verificando la autorización directamente con el canal.");

  useEffect(() => {
    if (!user || !ADMIN_ROLES.has(user.role) || started.current) return;
    started.current = true;

    const success = String(searchParams.get("success") ?? "").trim();
    const channelId = searchParams.get("channel_id");
    const token = String(searchParams.get("token") ?? "").trim();

    // Remove OAuth artifacts from the browser address immediately. The values
    // remain only in this effect closure long enough for authenticated verification.
    window.history.replaceState({}, document.title, "/distribution/airbnb/callback");

    if (!token || (success !== "true" && success !== "false")) {
      setStatus("FAILED");
      setMessage("El retorno de Airbnb no contiene una autorización válida. Inicia la conexión nuevamente desde tu propiedad.");
      return;
    }

    void verifyAirbnbHostCallback({ success, channelId, token })
      .then((result) => {
        setPropertyId(result.propertyId);
        if (!result.success) {
          setStatus("FAILED");
          setMessage("La autorización de Airbnb no se completó. No se realizó ninguna activación y puedes intentarlo nuevamente.");
          return;
        }
        setStatus("SUCCESS");
        setMessage("Airbnb confirmó la autorización. Pin&Go verificó el canal correcto y continuará con la preparación del mapeo antes de cualquier activación.");
      })
      .catch((error) => {
        setStatus("FAILED");
        setMessage(
          error instanceof AirbnbHostSelfServiceApiError
            ? "No pudimos verificar de forma segura la autorización. Pin&Go no marcará el canal como conectado hasta completar la verificación."
            : "No pudimos validar el retorno de Airbnb. Inicia la conexión nuevamente desde tu propiedad."
        );
      });
  }, [searchParams, user]);

  if (!user) return <Navigate to="/login" replace />;
  if (!ADMIN_ROLES.has(user.role)) return <Navigate to="/overview" replace />;

  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 24 }}>
      <section style={{ border: "1px solid #dbe3ef", borderRadius: 20, background: "white", padding: 28, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {status === "VERIFYING" ? <LoaderCircle size={28} /> : status === "SUCCESS" ? <CheckCircle2 size={28} /> : <TriangleAlert size={28} />}
          <div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Distribution by Pin&amp;Go</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 26 }}>{status === "VERIFYING" ? "Verificando Airbnb" : status === "SUCCESS" ? "Autorización confirmada" : "Autorización no verificada"}</h1>
          </div>
        </div>
        <p style={{ margin: 0, lineHeight: 1.65, color: "#475569" }}>{message}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 12, background: "#f8fafc", color: "#334155" }}>
          <ShieldCheck size={20} style={{ flex: "0 0 auto", marginTop: 2 }} />
          <span>Pin&amp;Go no recibe ni almacena tu contraseña de Airbnb. La activación del canal permanece separada de esta autorización.</span>
        </div>
        {status !== "VERIFYING" && (
          <button
            type="button"
            onClick={() => navigate(propertyId ? `/properties/${propertyId}/distribution` : "/properties", { replace: true })}
          >
            {propertyId ? "Volver al Centro de conexiones" : "Volver a Propiedades"}
          </button>
        )}
      </section>
    </main>
  );
}

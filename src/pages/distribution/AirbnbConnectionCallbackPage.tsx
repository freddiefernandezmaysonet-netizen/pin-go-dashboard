import { useEffect, useRef, useState } from "react";
import { LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
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
  const [status, setStatus] = useState<"VERIFYING" | "FAILED">("VERIFYING");
  const [message, setMessage] = useState("Estamos verificando el canal devuelto para tu propiedad.");

  useEffect(() => {
    if (!user || !ADMIN_ROLES.has(user.role) || started.current) return;
    started.current = true;

    const success = String(searchParams.get("success") ?? "").trim();
    const channelId = searchParams.get("channel_id");
    const token = String(searchParams.get("token") ?? "").trim();

    // Remove OAuth artifacts from the browser address immediately. The values
    // remain only in this effect closure long enough for authenticated verification.
    window.history.replaceState({}, document.title, "/distribution/airbnb/callback");

    // Channex's failure redirect only guarantees success=false. Do not try to
    // associate a property or verify an absent token on this non-success path.
    if (success === "false") {
      setStatus("FAILED");
      setMessage("La autorización de Airbnb no se completó. Pin&Go no ha activado el canal; puedes intentarlo nuevamente.");
      return;
    }

    if (success !== "true" || !channelId || !token) {
      setStatus("FAILED");
      setMessage("El retorno de Airbnb no contiene una autorización válida. Inicia la conexión nuevamente desde tu propiedad.");
      return;
    }

    void verifyAirbnbHostCallback({ success, channelId, token })
      .then((result) => {
        if (!result.success) {
          setStatus("FAILED");
          setMessage("La autorización de Airbnb no se completó. No se realizó ninguna activación y puedes intentarlo nuevamente.");
          return;
        }
        navigate(`/properties/${encodeURIComponent(result.propertyId)}/distribution`, {
          replace: true,
        });
      })
      .catch((error) => {
        setStatus("FAILED");
        setMessage(
          error instanceof AirbnbHostSelfServiceApiError
            ? "No pudimos verificar de forma segura la autorización. Pin&Go no marcará el canal como conectado hasta completar la verificación."
            : "No pudimos validar el retorno de Airbnb. Inicia la conexión nuevamente desde tu propiedad."
        );
      });
  }, [navigate, searchParams, user]);

  if (!user) return <Navigate to="/login" replace />;
  if (!ADMIN_ROLES.has(user.role)) return <Navigate to="/overview" replace />;

  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 24 }}>
      <section style={{ border: "1px solid #dbe3ef", borderRadius: 20, background: "white", padding: 28, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {status === "VERIFYING" ? <LoaderCircle size={28} /> : <TriangleAlert size={28} />}
          <div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Distribution by Pin&amp;Go</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 26 }}>{status === "VERIFYING" ? "Verificando Airbnb" : "Autorización no verificada"}</h1>
          </div>
        </div>
        <p style={{ margin: 0, lineHeight: 1.65, color: "#475569" }}>{message}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 12, background: "#f8fafc", color: "#334155" }}>
          <ShieldCheck size={20} style={{ flex: "0 0 auto", marginTop: 2 }} />
          <span>Pin&amp;Go no recibe ni almacena tu contraseña de Airbnb. La activación del canal permanece separada de esta autorización.</span>
        </div>
        {status === "FAILED" && (
          <button
            type="button"
            onClick={() => navigate("/properties", { replace: true })}
          >
            Volver a Propiedades
          </button>
        )}
      </section>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";

import {
  DistributionApiError,
  getDistributionConnectionCenter,
  issueDistributionConnectionSession,
  prepareDistributionChannel,
  transitionDistributionConnectionSession,
  type DistributionConnectionCenter,
  type DistributionConnectionSession,
  type DistributionProvider,
} from "../../api/distribution";
import { useAuth } from "../../auth/AuthProvider";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "ADMIN", "PLATFORM_ADMIN"]);
const SELF_SERVICE = new Set<DistributionProvider>(["AIRBNB", "BOOKING_COM"]);

const SIMULATED_CENTER: DistributionConnectionCenter = {
  productName: "Distribution by Pin&Go",
  property: { id: "simulation", name: "Propiedad de demostración" },
  status: "SETUP_REQUIRED",
  provisioningStatus: "NOT_PROVISIONED",
  channels: [
    { provider: "AIRBNB", name: "Airbnb", availability: "AVAILABLE", status: "NOT_CONNECTED", nextAction: "CONNECT", readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
    { provider: "BOOKING_COM", name: "Booking.com", availability: "AVAILABLE", status: "NOT_CONNECTED", nextAction: "CONNECT", readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
    { provider: "EXPEDIA", name: "Expedia", availability: "PLANNED", status: "NOT_CONNECTED", nextAction: "CONNECT", readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
    { provider: "VRBO", name: "Vrbo", availability: "ASSISTED_BETA", status: "NOT_CONNECTED", nextAction: "CONNECT", readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
  ],
};

const SIMULATED_IFRAME_DOCUMENT = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:system-ui,sans-serif;margin:0;padding:32px;background:#f8fafc;color:#172033}main{max-width:560px;margin:auto;background:white;border:1px solid #dbe3ef;border-radius:18px;padding:28px}span{display:inline-block;background:#e8f7ee;color:#147a42;padding:6px 10px;border-radius:999px;font-weight:700}h1{font-size:24px}p{line-height:1.6}</style></head><body><main><span>Simulación segura</span><h1>Autoriza tu canal</h1><p>Esta vista representa el flujo white-label. No usa credenciales, no contacta una OTA y no modifica datos.</p><p>En staging, aquí aparecerá el formulario de autorización del canal seleccionado.</p></main></body></html>`;

const PAGE_STYLE = { display: "grid", gap: 20, maxWidth: 1120, margin: "0 auto" } as const;
const CARD_STYLE = { border: "1px solid #dbe3ef", borderRadius: 16, padding: 20, background: "#fff" } as const;

function availabilityLabel(value: string) {
  if (value === "AVAILABLE") return "Disponible";
  if (value === "ASSISTED_BETA") return "Con asistencia";
  return "Próximamente";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    NOT_CONNECTED: "Sin conectar",
    AUTHORIZATION_REQUIRED: "Autorización requerida",
    MAPPING_REQUIRED: "Mapeo requerido",
    READINESS_CHECK: "Validando",
    ACTIVATION_PENDING: "Activación pendiente",
    ACTIVE: "Activo",
    DEGRADED: "Requiere atención",
    FAILED: "Error",
    DISCONNECTING: "Desconectando",
    DISCONNECTED: "Desconectado",
  };
  return labels[value] ?? value;
}

function ConnectionFrame(props: {
  providerName: string;
  session: DistributionConnectionSession;
  simulated: boolean;
  onLoaded(): void;
  onComplete(): void;
  onClose(): void;
  completing: boolean;
  ready: boolean;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="connection-frame-title" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.65)", display: "grid", placeItems: "center", padding: 20 }}>
      <section style={{ width: "min(920px, 100%)", height: "min(720px, 90vh)", background: "white", borderRadius: 18, overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <div><strong id="connection-frame-title">Conectar {props.providerName}</strong><div style={{ color: "#64748b", fontSize: 13 }}>Sesión temporal y protegida</div></div>
          <button type="button" onClick={props.onClose} aria-label="Cerrar conexión" style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={22} /></button>
        </header>
        <iframe
          title={`Conectar ${props.providerName}`}
          src={props.simulated ? undefined : props.session.launchUrl}
          srcDoc={props.simulated ? SIMULATED_IFRAME_DOCUMENT : undefined}
          sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          onLoad={props.onLoaded}
          style={{ width: "100%", height: "100%", border: 0 }}
        />
        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: 16, borderTop: "1px solid #e2e8f0" }}>
          <button type="button" onClick={props.onClose} disabled={props.completing}>Cancelar</button>
          <button type="button" onClick={props.onComplete} disabled={props.completing || !props.ready}>{props.completing ? "Guardando…" : props.ready ? (props.simulated ? "Finalizar simulación" : "Finalizar conexión") : "Abriendo sesión…"}</button>
        </footer>
      </section>
    </div>
  );
}

export function ConnectionCenterPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const simulated = searchParams.get("simulation") === "1";
  const [center, setCenter] = useState<DistributionConnectionCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<DistributionProvider | null>(null);
  const [session, setSession] = useState<{ provider: DistributionProvider; value: DistributionConnectionSession } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setCenter(simulated ? { ...SIMULATED_CENTER, property: { id, name: "Propiedad de demostración" } } : await getDistributionConnectionCenter(id));
    } catch {
      setError("No pudimos cargar el centro de conexiones.");
    } finally {
      setLoading(false);
    }
  }, [id, simulated]);

  useEffect(() => { void load(); }, [load]);

  if (!id) return <Navigate to="/properties" replace />;
  if (!user || !ADMIN_ROLES.has(user.role)) return <Navigate to={`/properties/${id}`} replace />;

  async function connect(provider: "AIRBNB" | "BOOKING_COM") {
    setBusyProvider(provider);
    setError(null);
    setNotice(null);
    try {
      if (simulated) {
        setFrameReady(false);
        setSession({ provider, value: { sessionId: `simulation-${provider}`, launchUrl: "https://simulation.invalid/connect", expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() } });
      } else {
        await prepareDistributionChannel(id, provider);
        setFrameReady(false);
        setSession({ provider, value: await issueDistributionConnectionSession(id, provider) });
      }
    } catch (caught) {
      if (caught instanceof DistributionApiError && caught.code === "OTA_CONNECTION_CENTER_RUNTIME_DISABLED") {
        setNotice("Las conexiones se están preparando. Aún no se ha activado el acceso comercial.");
      } else {
        setError("No fue posible iniciar la conexión. Intenta nuevamente.");
      }
    } finally {
      setBusyProvider(null);
    }
  }

  async function markOpened() {
    if (!session) return;
    if (simulated) { setFrameReady(true); return; }
    try {
      await transitionDistributionConnectionSession(session.value.sessionId, "opened");
      setFrameReady(true);
    } catch { setError("La sesión abrió, pero no pudimos confirmar su estado."); }
  }

  async function closeSession() {
    const current = session;
    setSession(null);
    setFrameReady(false);
    if (!current || simulated) return;
    try { await transitionDistributionConnectionSession(current.value.sessionId, "cancelled"); } catch { /* Session expiration is safe and needs no retry from the browser. */ }
  }

  async function completeSession() {
    if (!session) return;
    setCompleting(true);
    try {
      if (!simulated) await transitionDistributionConnectionSession(session.value.sessionId, "completed");
      setSession(null);
      setFrameReady(false);
      setNotice(simulated ? "Simulación completada. No se modificaron datos." : "Conexión enviada para validación.");
      await load();
    } catch {
      setError("No pudimos completar la sesión.");
    } finally {
      setCompleting(false);
    }
  }

  const providerName = center?.channels.find((channel) => channel.provider === session?.provider)?.name ?? "canal";

  return (
    <main style={PAGE_STYLE}>
      <div><Link to={`/properties/${id}`}><ArrowLeft size={16} /> Volver a la propiedad</Link></div>
      <header style={{ display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div><p style={{ margin: 0, color: "#64748b" }}>Distribution by Pin&amp;Go</p><h1 style={{ margin: "6px 0" }}>Centro de conexiones</h1><p style={{ margin: 0, color: "#64748b" }}>Administra los canales de {center?.property.name ?? "tu propiedad"} desde un solo lugar.</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#147a42" }}><ShieldCheck size={20} /> Sesiones temporales</div>
      </header>

      {simulated && <div role="status" style={{ ...CARD_STYLE, borderColor: "#93c5fd", background: "#eff6ff" }}>Modo simulación: no se harán llamadas externas ni cambios de datos.</div>}
      {notice && <div role="status" style={{ ...CARD_STYLE, borderColor: "#86efac", background: "#f0fdf4" }}>{notice}</div>}
      {error && <div role="alert" style={{ ...CARD_STYLE, borderColor: "#fca5a5", background: "#fef2f2" }}>{error}</div>}
      {loading && <div role="status" style={CARD_STYLE}><LoaderCircle size={18} /> Cargando canales…</div>}

      {!loading && center && (
        <section aria-label="Canales disponibles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {center.channels.map((channel) => {
            const canConnect = channel.availability === "AVAILABLE" && SELF_SERVICE.has(channel.provider);
            return (
              <article key={channel.provider} style={CARD_STYLE}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h2 style={{ margin: 0, fontSize: 20 }}>{channel.name}</h2><span>{availabilityLabel(channel.availability)}</span></div>
                <p style={{ color: "#64748b" }}>Estado: {statusLabel(channel.status)}</p>
                {canConnect ? (
                  <button type="button" disabled={busyProvider !== null} onClick={() => void connect(channel.provider as "AIRBNB" | "BOOKING_COM")}>
                    {busyProvider === channel.provider ? "Preparando…" : <><ExternalLink size={16} /> Conectar</>}
                  </button>
                ) : <p style={{ marginBottom: 0 }}>{channel.availability === "ASSISTED_BETA" ? "Solicita acompañamiento para configurar este canal." : "Disponible en una próxima etapa."}</p>}
              </article>
            );
          })}
        </section>
      )}

      {session && <ConnectionFrame providerName={providerName} session={session.value} simulated={simulated} onLoaded={() => void markOpened()} onComplete={() => void completeSession()} onClose={() => void closeSession()} completing={completing} ready={frameReady} />}
    </main>
  );
}

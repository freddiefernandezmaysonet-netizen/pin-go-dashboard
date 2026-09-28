import { useCallback, useEffect, useRef, useState } from "react";

type IncidentStatus = { reference: string; createdAt?: string;
  resolution: "OPEN" | "RESOLVED"; hostAcknowledged: boolean };
type Update = { id: string; reference: string; createdAt: string; text: string;
  resolution?: "OPEN" | "RESOLVED"; hostAcknowledged?: boolean };

export function GuestIncidentUpdates({ apiBase, guestToken }: { apiBase: string; guestToken: string }) {
  const [incidents, setIncidents] = useState<IncidentStatus[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    setLoading(true); setError(false);
    try {
      const all: Update[] = []; let canonical: IncidentStatus[] | null = null; let after: string | null = null;
      const seen = new Set<string>();
      for (let page = 0; page < 100; page++) {
        const url = `${apiBase.replace(/\/$/, "")}/api/public-booking/manage/${encodeURIComponent(guestToken)}/pin-ai/incident-updates${after ? `?after=${encodeURIComponent(after)}` : ""}`;
        const response = await fetch(url, { method: "GET", credentials: "omit", cache: "no-store", signal: active.signal });
        if ([401, 403, 404].includes(response.status)) {
          if (!active.signal.aborted) { setIncidents([]); setUpdates([]); }
          return;
        }
        const body = await response.json();
        if (!response.ok || !body.ok || !Array.isArray(body.updates)) throw new Error("UNAVAILABLE");
        if (page === 0 && Array.isArray(body.incidents)) canonical = body.incidents;
        all.push(...body.updates);
        if (body.nextAfter === null) {
          if (!active.signal.aborted) {
            const fallback = [...new Map(all.map(update => [update.reference, {
              reference: update.reference, createdAt: update.createdAt,
              resolution: update.resolution ?? "OPEN", hostAcknowledged: update.hostAcknowledged === true,
            }])).values()];
            setIncidents(canonical ?? fallback); setUpdates(all);
          }
          return;
        }
        if (typeof body.nextAfter !== "string" || seen.has(body.nextAfter)) throw new Error("INVALID_CURSOR");
        seen.add(body.nextAfter); after = body.nextAfter;
      }
      throw new Error("HISTORY_LIMIT");
    } catch { if (!active.signal.aborted) setError(true); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }, [apiBase, guestToken]);

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const timer = window.setInterval(refreshVisible, 30_000);
    return () => {
      controller.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh]);

  if (!incidents.length && !updates.length && !error) return null;
  return <section aria-label="Actualizaciones del anfitrión / Host updates" style={{ border: "1px solid #b9d4ef", borderRadius: 18, padding: 22, background: "#f3f8ff", marginTop: 20 }}>
    <h2>Seguimiento de incidentes / Incident updates</h2>
    <p>Estado actual y mensajes publicados para tu reservación. / Current status and updates shared for your reservation.</p>
    {error && <p role="alert">No se pudieron actualizar los incidentes. / Could not refresh incidents.</p>}
    {!error && incidents.map(incident => <div key={incident.reference} aria-label={`Estado del incidente ${incident.reference}`}>
      <strong>{incident.reference}</strong>
      <p>Estado actual / Current status: {incident.resolution === "RESOLVED" ? "Resuelto en el sistema / Recorded as resolved" : "Pendiente de resolución / Resolution pending"}</p>
      <p>Atención del anfitrión / Host acknowledgement: {incident.hostAcknowledged ? "Confirmada / Confirmed" : "Sin confirmación registrada / No acknowledgement recorded"}</p>
      <p>El estado registrado no acredita una reparación física. / The recorded status does not verify a physical repair.</p>
    </div>)}
    {updates.map(update => <article key={update.id} style={{ background: "white", padding: 16, borderRadius: 12, marginBottom: 12 }}><strong>{update.reference}</strong><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{update.text}</p><time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString()}</time></article>)}
    <button disabled={loading} onClick={() => void refresh()} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #9aabc3", background: "white", cursor: "pointer" }}>{loading ? "Actualizando / Refreshing…" : "Actualizar / Refresh"}</button>
  </section>;
}

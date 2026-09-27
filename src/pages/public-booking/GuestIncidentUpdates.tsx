import { useCallback, useEffect, useRef, useState } from "react";

type Update = { id: string; reference: string; createdAt: string; text: string };
export function GuestIncidentUpdates({ apiBase, guestToken }: { apiBase: string; guestToken: string }) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    setLoading(true); setError(false);
    try {
      const all: Update[] = []; let after: string | null = null;
      const seen = new Set<string>();
      for (let page = 0; page < 100; page++) {
        const url = `${apiBase.replace(/\/$/, "")}/api/public-booking/manage/${encodeURIComponent(guestToken)}/pin-ai/incident-updates${after ? `?after=${encodeURIComponent(after)}` : ""}`;
        const response = await fetch(url, { method: "GET", credentials: "omit", cache: "no-store", signal: active.signal });
        if ([401, 403, 404].includes(response.status)) { if (!active.signal.aborted) setUpdates([]); return; }
        const body = await response.json();
        if (!response.ok || !body.ok || !Array.isArray(body.updates)) throw new Error("UNAVAILABLE");
        all.push(...body.updates);
        if (body.nextAfter === null) { if (!active.signal.aborted) setUpdates(all); return; }
        if (typeof body.nextAfter !== "string" || seen.has(body.nextAfter)) throw new Error("INVALID_CURSOR");
        seen.add(body.nextAfter); after = body.nextAfter;
      }
      throw new Error("HISTORY_LIMIT");
    } catch { if (!active.signal.aborted) setError(true); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }, [apiBase, guestToken]);
  useEffect(() => { void refresh(); const focus = () => { void refresh(); }; window.addEventListener("focus", focus);
    return () => { controller.current?.abort(); window.removeEventListener("focus", focus); }; }, [refresh]);
  if (!updates.length && !error) return null;
  return <section aria-label="Actualizaciones del anfitrión / Host updates" style={{ border: "1px solid #b9d4ef", borderRadius: 18, padding: 22, background: "#f3f8ff", marginTop: 20 }}>
    <h2>Actualizaciones del anfitrión / Host updates</h2><p>Mensajes publicados para tu reservación. / Updates shared for your reservation.</p>
    {error && <p role="alert">No se pudieron actualizar los mensajes. / Could not refresh updates.</p>}
    {updates.map(update => <article key={update.id} style={{ background: "white", padding: 16, borderRadius: 12, marginBottom: 12 }}><strong>{update.reference}</strong><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{update.text}</p><time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString()}</time></article>)}
    <button disabled={loading} onClick={() => void refresh()} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #9aabc3", background: "white", cursor: "pointer" }}>{loading ? "Actualizando / Refreshing…" : "Actualizar / Refresh"}</button>
  </section>;
}

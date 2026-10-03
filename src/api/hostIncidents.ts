export type HostOperation = "NOTE" | "ACKNOWLEDGE" | "PUBLISH" | "RESOLVE";
export type HostCommand = { requestId: string; expectedVersion: number; operation: HostOperation; text: string };
export type HostIncident = { reference: string; state: string; propertyName: string; reservationNumber: string | null };
export type HostEvent = { id: string; sequence: number; kind: HostOperation; audience: "INTERNAL" | "GUEST"; createdAt: string; text: string; deliveryStatus?: string };
export type HostThread = HostIncident & { destination?: "PORTAL" | "CHANNEL"; version: number; reportedFacts: string; acknowledgedAt: string | null; messages: HostEvent[]; nextAfter: number | null };
export class IncidentApiError extends Error {
  status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}
export function incidentError(error: unknown) {
  if (error instanceof IncidentApiError) {
    if (error.status === 401) return "Tu sesión venció. Vuelve a iniciar sesión. / Sign in again.";
    if (error.status === 403) return "No tienes acceso a estos incidentes. / Access denied.";
    if (error.status === 404) return "Esta capacidad o incidente no está disponible para tu cuenta. / Not available for this account.";
    if (error.status === 409) return "El incidente cambió. Actualiza y revisa su estado antes de continuar. / Refresh and review the latest state.";
    if (error.status === 429) return "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo. / Please wait and retry.";
  }
  return "No se pudo verificar el resultado. / The result could not be verified.";
}
export function createIncidentApi(base: string) {
  const root = `${base.replace(/\/$/, "")}/api/dashboard/pin-ai/incidents`;
  const referencePath = (reference: string) => {
    if (!/^GI-[A-F0-9]{12}$/.test(reference)) throw new IncidentApiError(404, "NOT_FOUND");
    return `${root}/${encodeURIComponent(reference)}`;
  };
  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, { ...init, credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new IncidentApiError(res.status, body?.error || "UNAVAILABLE");
    return body as T;
  }
  return {
    list: (before?: string, signal?: AbortSignal) => request<{ items: HostIncident[]; nextCursor: string | null }>(`${root}${before ? `?before=${encodeURIComponent(before)}` : ""}`, { signal }),
    async read(reference: string, signal?: AbortSignal): Promise<HostThread> {
      let snapshot: HostThread | undefined;
      let after = 0;
      for (let page = 0; page < 100; page++) {
        const current = await request<HostThread>(`${referencePath(reference)}?after=${after}`, { signal });
        if (snapshot && current.version !== snapshot.version) throw new IncidentApiError(409, "VERSION_CONFLICT");
        snapshot = snapshot ? { ...current, messages: [...snapshot.messages, ...current.messages] } : current;
        if (current.nextAfter === null) return snapshot;
        if (current.nextAfter <= after) break;
        after = current.nextAfter;
      }
      throw new IncidentApiError(503, "HISTORY_UNAVAILABLE");
    },
    command: (reference: string, command: HostCommand) => request<{ eventId: string; version: number; replayed: boolean }>(`${referencePath(reference)}/actions`, { method: "POST", body: JSON.stringify(command) }),
  };
}
export type IncidentApi = ReturnType<typeof createIncidentApi>;

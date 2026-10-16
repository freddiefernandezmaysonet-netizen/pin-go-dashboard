import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { cleanerRequest } from "../../api/cleaner";
import "./HostCleaningsPage.css";

type Item = {
  id: string; property: { id: string; name: string; timezone: string }; cleaner: { id: string; fullName: string };
  reservation: { id: string; number: string | null }; status: string; scheduledStartAt: string; committedEndAt: string | null;
  startedAt: string | null; completedAt: string | null; actualDurationMinutes: number | null;
  checklist: { id: string; labelEs: string; labelEn: string; required: boolean; checked: boolean; checkedAt: string | null }[] | null;
  reports: { id: string; kind: string; reason: string; estimatedAt: string | null; reportedAt: string }[];
};
type Result = { items: Item[]; nextCursor: string | null; properties: { id: string; name: string }[]; staff: { id: string; fullName: string }[] };
const statuses: Record<string, string> = { PENDING: "Pendiente de aceptación", CONFIRMED: "Confirmada", IN_PROGRESS: "En progreso", COMPLETED: "Completada", CANCELLED: "Cancelada", DECLINED: "Rechazada", REASSIGNED: "Reasignada", EXPIRED: "Vencida" };
const views = [["today", "Hoy"], ["upcoming", "Próximas"], ["history", "Historial"], ["all", "Todas"]];
function date(value: string | null, timezone: string) {
  if (!value) return "Sin registrar";
  return new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}
export default function HostCleaningsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [cursors, setCursors] = useState<string[]>([]);
  const canRead = ["ADMIN", "ORG_ADMIN", "PLATFORM_ADMIN"].includes(user?.role ?? "");
  const view = params.get("view") ?? (params.has("reservationId") ? "all" : "today");
  const query = new URLSearchParams(params);
  query.set("view", view);
  const cursor = cursors[cursors.length - 1];
  if (cursor) query.set("cursor", cursor);
  const path = `/api/host/cleanings?${query}`;
  const result = useQuery({ queryKey: ["host-cleanings", user?.orgId, user?.id, path], queryFn: () => cleanerRequest<Result>(path), enabled: canRead, refetchInterval: 30_000 });
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setCursors([]); setParams(next);
  }
  if (!canRead) return <p role="alert">Necesitas permisos de administración para consultar las limpiezas.</p>;
  return <section className="pg-host-cleanings">
    <header><div><h1>Limpiezas</h1><p>Supervisa el trabajo de tu equipo y consulta los horarios registrados.</p></div><button type="button" onClick={() => void result.refetch()} disabled={result.isFetching}>Actualizar</button></header>
    <nav aria-label="Vistas de limpiezas">{views.map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => filter("view", key)}>{label}</button>)}</nav>
    <div className="pg-cleaning-filters">
      <label>Propiedad<select value={params.get("propertyId") ?? ""} onChange={e => filter("propertyId", e.target.value)}><option value="">Todas las propiedades</option>{result.data?.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Cleaner<select value={params.get("staffMemberId") ?? ""} onChange={e => filter("staffMemberId", e.target.value)}><option value="">Todo el equipo</option>{result.data?.staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label>
      <label>Estado<select value={params.get("status") ?? ""} onChange={e => filter("status", e.target.value)}><option value="">Todos los estados</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {params.has("reservationId") && <button type="button" onClick={() => filter("reservationId", "")}>Quitar filtro de reserva</button>}
    </div>
    <p className="pg-cleaning-note">Las horas corresponden a la zona horaria de cada propiedad. Inicio y finalización reales son los registros del cleaner.</p>
    {result.isPending && <p role="status">Cargando limpiezas…</p>}
    {result.isError && <p role="alert">No se pudieron actualizar las limpiezas. Pulsa Actualizar para reintentar.</p>}
    {result.data && !result.isError && <>
      <p role="status">{result.data.items.length ? `${result.data.items.length} limpiezas en esta página` : "No hay limpiezas para estos filtros."}</p>
      <div className="pg-cleaning-list">{result.data.items.map(item => <article key={item.id}>
        <header><div><h2>{item.property.name}</h2><p>{item.cleaner.fullName} · <Link to={`/reservations/${item.reservation.id}`}>{item.reservation.number ?? "Ver reserva"}</Link></p></div><span className={`pg-cleaning-state state-${item.status.toLowerCase()}`}>{statuses[item.status] ?? item.status}</span></header>
        <p className="pg-cleaning-note">{item.property.timezone}</p>
        <dl>{[["Inicio programado", date(item.scheduledStartAt, item.property.timezone)], ["Finalización comprometida", item.committedEndAt ? date(item.committedEndAt, item.property.timezone) : "Pendiente de compromiso"], ["Inicio real", date(item.startedAt, item.property.timezone)], ["Finalización real", date(item.completedAt, item.property.timezone)], ["Duración real", item.actualDurationMinutes === null ? "Sin registrar" : `${item.actualDurationMinutes} min`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <details><summary>Checklist · {item.checklist ? `${item.checklist.filter(i => i.checked).length}/${item.checklist.length}` : "sin registro"} · Reportes ({item.reports.length})</summary>
          {item.checklist?.length ? <ul>{item.checklist.map(task => <li key={task.id}>{task.checked ? "✓" : "○"} {task.labelEs || task.labelEn}{task.required ? " · Obligatoria" : ""}{task.checkedAt && <small> · {date(task.checkedAt, item.property.timezone)}</small>}</li>)}</ul> : <p>No hay checklist registrado para esta limpieza.</p>}
          {item.reports.map(report => <div className="pg-cleaning-report" key={report.id}><strong>{{ DELAY: "Retraso", MORE_TIME: "Más tiempo", INCOMPLETE: "Trabajo incompleto" }[report.kind] ?? report.kind}</strong><p>{report.reason}</p><small>{date(report.reportedAt, item.property.timezone)}{report.estimatedAt ? ` · Estimado: ${date(report.estimatedAt, item.property.timezone)}` : ""}</small></div>)}
        </details>
      </article>)}</div>
      <div className="pg-cleaning-pagination"><button type="button" disabled={!cursors.length || result.isFetching} onClick={() => setCursors(previous => previous.slice(0, -1))}>Anterior</button><button type="button" disabled={!result.data.nextCursor || result.isFetching} onClick={() => setCursors(previous => [...previous, result.data!.nextCursor!])}>Siguiente</button></div>
    </>}
  </section>;
}

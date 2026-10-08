import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { logout } from "../../api/auth";
import { cancelCleanerTask, fetchCleanerProfile, fetchCleanerTaskProperties, fetchCleanerTasks, openCleanerTask, updateCleanerLanguage, type CleanerTaskFilters, type CleanerTaskView } from "../../api/cleaner";
import { useAuth } from "../../auth/AuthProvider";
import "./cleaner.css";
import { TaskChecklist } from "./TaskChecklist";
import { TaskIssueReport } from "./TaskIssueReport";
import { belongsToCleanerView, CLOSED_CLEANER_TASKS as CLOSED } from "./cleaner-task-view";

const STATUS: Record<string, [string, string]> = { PENDING: ["Pendiente de confirmar", "Awaiting confirmation"], CONFIRMED: ["Confirmada", "Confirmed"], IN_PROGRESS: ["En curso", "In progress"], COMPLETED: ["Completada", "Completed"], CANCELLED: ["Cancelada", "Cancelled"], REASSIGNED: ["Reasignada", "Reassigned"], EXPIRED: ["Oferta vencida", "Offer expired"], DECLINED: ["Rechazada", "Declined"] };

const EMPTY_FILTERS: CleanerTaskFilters = { propertyId: "", status: "", from: "", to: "" };

export default function MyCleaningsPage() {
  const { user, refresh } = useAuth();
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ["cleaner-profile", user?.id], queryFn: fetchCleanerProfile });
  const properties = useQuery({ queryKey: ["cleaner-task-properties", user?.id], queryFn: fetchCleanerTaskProperties, staleTime: 60_000 });
  const [view, setView] = useState<CleanerTaskView>("today");
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterError, setFilterError] = useState(false);
  const hasFilters = Object.values(filters).some(Boolean);
  const tasks = useInfiniteQuery({ queryKey: ["cleaner-tasks", user?.id, view, filters], queryFn: ({ pageParam }) => fetchCleanerTasks(pageParam, view, filters), initialPageParam: null as string | null, getNextPageParam: page => page.nextCursor ?? undefined, refetchInterval: 30_000 });
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const es = profile.data?.preferredLanguage === "es";
  const t = (spanish: string, english: string) => es ? spanish : english;
  const items = tasks.data?.pages.flatMap(page => page.items) ?? [];
  const now = new Date(clock);
  const visible = items.filter(task => belongsToCleanerView(task, view, now))
    .sort((a, b) => new Date(a.scheduledStartAt ?? a.departureAt).getTime() - new Date(b.scheduledStartAt ?? b.departureAt).getTime());
  async function act(operation: () => Promise<unknown>) {
    setBusy(true); setActionError(null);
    try { await operation(); } catch { setActionError(t("No se pudo completar la acción. Actualiza e intenta otra vez.", "Could not complete the action. Refresh and try again.")); }
    finally { setBusy(false); }
  }
  const format = (value: string | null, timezone: string) => value ? new Intl.DateTimeFormat(es ? "es-PR" : "en-US", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t("Por confirmar", "To be confirmed");
  return <main className="pg-cleaner">
    <header><div><h1>{t("Mis limpiezas", "My cleanings")}</h1><p>{profile.data?.fullName}</p></div><button disabled={busy} onClick={() => void act(async () => { await logout(); cache.clear(); await refresh(); })}>{t("Cerrar sesión", "Sign out")}</button></header>
    <label>{t("Idioma", "Language")} <select aria-label={t("Idioma", "Language")} value={profile.data?.preferredLanguage ?? "en"} disabled={busy || !profile.data} onChange={event => { const language = event.target.value as "es" | "en"; void act(async () => { await updateCleanerLanguage(language); await cache.invalidateQueries({ queryKey: ["cleaner-profile", user?.id] }); }); }}><option value="es">Español</option><option value="en">English</option></select></label>
    <nav aria-label={t("Vistas de limpieza", "Cleaning views")}>{(["today", "upcoming", "overdue", "history", "all"] as const).map((key, i) => <button key={key} aria-pressed={view === key} onClick={() => { setView(key); setFilters(EMPTY_FILTERS); setDraftFilters(EMPTY_FILTERS); setFilterError(false); setCancelTarget(null); }}>{[t("Hoy", "Today"), t("Próximas", "Upcoming"), t("Pendientes anteriores", "Earlier unfinished"), t("Historial", "History"), t("Todas", "All")][i]}</button>)}</nav>
    <form role="search" aria-label={t("Filtrar limpiezas", "Filter cleanings")} className="pg-cleaner-filters" onSubmit={event => {
      event.preventDefault();
      if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) { setFilterError(true); return; }
      setFilterError(false); setCancelTarget(null); setFilters({ ...draftFilters }); setView("all");
    }}>
      <label className="pg-cleaner-search">{t("Propiedad", "Property")}<select aria-label={t("Propiedad", "Property")} value={draftFilters.propertyId} disabled={properties.isPending || properties.isError} onChange={event => setDraftFilters({ ...draftFilters, propertyId: event.target.value })}>
        <option value="">{properties.isPending ? t("Cargando propiedades…", "Loading properties…") : t("Todas las propiedades", "All properties")}</option>
        {properties.data?.items.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
      </select></label>
      {properties.isError ? <p role="alert" className="pg-cleaner-filter-note">{t("No se pudieron cargar tus propiedades.", "Could not load your properties.")} <button type="button" onClick={() => void properties.refetch()}>{t("Reintentar", "Retry")}</button></p> : null}
      <label>{t("Estado", "Status")}<select aria-label={t("Estado", "Status")} value={draftFilters.status} onChange={event => setDraftFilters({ ...draftFilters, status: event.target.value })}><option value="">{t("Todos los estados", "All statuses")}</option>{Object.entries(STATUS).map(([key, labels]) => <option key={key} value={key}>{labels[es ? 0 : 1]}</option>)}</select></label>
      <label>{t("Desde", "From")}<input type="date" min="0001-01-01" max="9999-12-31" value={draftFilters.from} onChange={event => setDraftFilters({ ...draftFilters, from: event.target.value })} /></label>
      <label>{t("Hasta", "To")}<input type="date" min="0001-01-01" max="9999-12-31" value={draftFilters.to} onChange={event => setDraftFilters({ ...draftFilters, to: event.target.value })} /></label>
      <p className="pg-cleaner-filter-note">{t("Los filtros buscan en todas tus limpiezas. Fechas según la zona horaria de cada propiedad.", "Filters search all your cleanings. Dates use each property's time zone.")}</p>
      {filterError ? <p role="alert" className="pg-cleaner-filter-note">{t("La fecha Desde debe ser anterior o igual a Hasta.", "From must be on or before To.")}</p> : null}
      <div className="pg-cleaner-filter-actions"><button type="submit" className="pg-cleaner-primary">{t("Aplicar filtros", "Apply filters")}</button><button type="button" onClick={() => { setDraftFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setView("today"); setFilterError(false); setCancelTarget(null); }}>{t("Limpiar filtros", "Clear filters")}</button></div>
    </form>
    <button disabled={tasks.isFetching || profile.isFetching || properties.isFetching} onClick={() => { void tasks.refetch(); void profile.refetch(); void properties.refetch(); }}>{t("Actualizar", "Refresh")}</button>
    {(tasks.isPending || profile.isPending) ? <p role="status">{t("Cargando…", "Loading…")}</p> : null}
    {(tasks.isError || profile.isError || actionError) ? <p role="alert">{actionError ?? t("No se pudieron actualizar tus tareas.", "Could not refresh your tasks.")}</p> : null}
    {!tasks.isPending && !tasks.isError && visible.length === 0 ? <p>{hasFilters ? t("No hay limpiezas que coincidan con estos filtros.", "No cleanings match these filters.") : t("No hay limpiezas en esta vista.", "No cleanings in this view.")}</p> : null}
    <section aria-label={t("Tareas", "Tasks")}>{visible.map(task => {
      const completion = task.scheduledStartAt && task.durationCommitmentMinutes !== null ? new Date(new Date(task.scheduledStartAt).getTime() + task.durationCommitmentMinutes * 60000).toISOString() : null;
      return <article key={task.id}><h2>{task.property.name}</h2><p className="pg-cleaner-status">{STATUS[task.status]?.[es ? 0 : 1] ?? t("Estado pendiente de revisión", "Status awaiting review")}</p><p>{task.property.timezone}</p>
        <h3>{t("Trabajo", "Work")}</h3><dl><dt>{t("Inicio programado", "Scheduled start")}</dt><dd>{format(task.scheduledStartAt, task.property.timezone)}</dd><dt>{t("Finalización comprometida", "Committed completion")}</dt><dd>{format(completion, task.property.timezone)}</dd>{task.completedAt ? <><dt>{t("Finalización registrada", "Recorded completion")}</dt><dd>{format(task.completedAt, task.property.timezone)}</dd></> : null}</dl>
        <h3>{t("Acceso", "Access")}</h3>{task.access ? <p>{format(task.access.startsAt, task.property.timezone)} — {format(task.access.endsAt, task.property.timezone)}</p> : <p>{t("Sin ventana de acceso registrada", "No access window recorded")}</p>}
        {["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(task.status) ? <TaskChecklist taskId={task.id} language={es ? "es" : "en"} /> : null}
        {["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REASSIGNED"].includes(task.status) ? <TaskIssueReport task={task} language={es ? "es" : "en"} /> : null}
        {task.status === "CONFIRMED" && !task.startedAt &&
          Boolean(task.access?.startsAt ?? task.scheduledStartAt) &&
          clock < new Date(task.access?.startsAt ?? task.scheduledStartAt!).getTime() ? <div>
          {cancelTarget === task.id ? <><p>{t("¿Confirmas que ya no puedes realizar esta limpieza? Pin&Go buscará un respaldo.", "Confirm that you can no longer perform this cleaning. Pin&Go will look for a backup.")}</p><button disabled={busy} onClick={() => void act(async () => { await cancelCleanerTask(task.id); setCancelTarget(null); await cache.invalidateQueries({ queryKey: ["cleaner-tasks", user?.id] }); })}>{t("Sí, cancelar limpieza", "Yes, cancel cleaning")}</button> <button disabled={busy} onClick={() => setCancelTarget(null)}>{t("Volver", "Go back")}</button></> : <button disabled={busy} onClick={() => setCancelTarget(task.id)}>{t("Cancelar limpieza", "Cancel cleaning")}</button>}
        </div> : null}
        {!CLOSED.has(task.status) ? <button className="pg-cleaner-primary" disabled={busy} onClick={() => void act(() => openCleanerTask(task.id))}>{t("Abrir limpieza", "Open cleaning")}</button> : null}
      </article>;
    })}</section>
    {tasks.hasNextPage ? <button disabled={tasks.isFetchingNextPage} onClick={() => void tasks.fetchNextPage()}>{t("Cargar más", "Load more")}</button> : null}
  </main>;
}

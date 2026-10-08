import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { logout } from "../../api/auth";
import { cancelCleanerTask, fetchCleanerProfile, fetchCleanerTasks, openCleanerTask, updateCleanerLanguage } from "../../api/cleaner";
import { useAuth } from "../../auth/AuthProvider";
import "./cleaner.css";
import { TaskChecklist } from "./TaskChecklist";
import { TaskIssueReport } from "./TaskIssueReport";
import { belongsToCleanerView, CLOSED_CLEANER_TASKS as CLOSED } from "./cleaner-task-view";

const STATUS: Record<string, [string, string]> = { PENDING: ["Pendiente de confirmar", "Awaiting confirmation"], CONFIRMED: ["Confirmada", "Confirmed"], IN_PROGRESS: ["En curso", "In progress"], COMPLETED: ["Completada", "Completed"], CANCELLED: ["Cancelada", "Cancelled"], REASSIGNED: ["Reasignada", "Reassigned"], EXPIRED: ["Oferta vencida", "Offer expired"], DECLINED: ["Rechazada", "Declined"] };

export default function MyCleaningsPage() {
  const { user, refresh } = useAuth();
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ["cleaner-profile", user?.id], queryFn: fetchCleanerProfile });
  const [view, setView] = useState<"today" | "upcoming" | "history">("today");
  const tasks = useInfiniteQuery({ queryKey: ["cleaner-tasks", user?.id, view], queryFn: ({ pageParam }) => fetchCleanerTasks(pageParam, view), initialPageParam: null as string | null, getNextPageParam: page => page.nextCursor ?? undefined, refetchInterval: 30_000 });
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
    <nav aria-label={t("Vistas de limpieza", "Cleaning views")}>{(["today", "upcoming", "history"] as const).map((key, i) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{[t("Hoy", "Today"), t("Próximas", "Upcoming"), t("Historial", "History")][i]}</button>)}</nav>
    <button disabled={tasks.isFetching || profile.isFetching} onClick={() => { void tasks.refetch(); void profile.refetch(); }}>{t("Actualizar", "Refresh")}</button>
    {(tasks.isPending || profile.isPending) ? <p role="status">{t("Cargando…", "Loading…")}</p> : null}
    {(tasks.isError || profile.isError || actionError) ? <p role="alert">{actionError ?? t("No se pudieron actualizar tus tareas.", "Could not refresh your tasks.")}</p> : null}
    {!tasks.isPending && !tasks.isError && visible.length === 0 ? <p>{t("No hay tareas en esta vista entre los resultados cargados.", "No tasks in this view among the loaded results.")}</p> : null}
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

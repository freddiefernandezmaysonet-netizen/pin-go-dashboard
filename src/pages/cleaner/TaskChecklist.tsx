import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTaskChecklist, setTaskChecklistItem } from "../../api/cleaning-checklist";
import { useAuth } from "../../auth/AuthProvider";
export function TaskChecklist({ taskId, language }: { taskId: string; language: "es" | "en" }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = ["cleaner-task-checklist", user?.id, taskId];
  const query = useQuery({ queryKey: key, queryFn: () => getTaskChecklist(taskId), enabled: opened });
  const es = language === "es";
  async function mark(itemId: string, checked: boolean, version: number) {
    setBusy(true); setError("");
    try { await setTaskChecklistItem(taskId, itemId, checked, version); await cache.invalidateQueries({ queryKey: key }); }
    catch { setError(es ? "No se pudo guardar. Actualiza la lista antes de intentar otra vez." : "Could not save. Refresh the list before trying again."); await query.refetch(); }
    finally { setBusy(false); }
  }
  return <details onToggle={event => setOpened(event.currentTarget.open)}><summary>{es ? "Checklist de limpieza" : "Cleaning checklist"}</summary>
    {query.isPending && opened ? <p role="status">{es ? "Cargando…" : "Loading…"}</p> : null}
    {query.isError || error ? <p role="alert">{error || (es ? "No se pudo cargar el checklist." : "Could not load the checklist.")}</p> : null}
    {query.data ? <><p>{query.data.items.filter(item => item.checked).length}/{query.data.items.length} {es ? "puntos completados" : "items completed"}</p>
      {!query.data.editable ? <p>{es ? "Lista en modo de consulta. Se actualiza durante la limpieza dentro del horario permitido." : "Read-only list. Update it during cleaning within the allowed time."}</p> : null}
      <fieldset disabled={busy || !query.data.editable} style={{ border: 0, padding: 0 }}><legend>{es ? "Puntos de limpieza" : "Cleaning items"}</legend>{query.data.items.map(item => <label key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", minHeight: 48, padding: 8 }}><input type="checkbox" checked={item.checked} onChange={event => void mark(item.id, event.target.checked, item.version)} /> <span>{(es ? item.labelEs : item.labelEn) || item.labelEs || item.labelEn}{item.required ? ` (${es ? "obligatorio" : "required"})` : ""}</span></label>)}</fieldset>
      <button disabled={busy || query.isFetching} onClick={() => void query.refetch()}>{es ? "Actualizar lista" : "Refresh list"}</button>
    </> : null}
  </details>;
}

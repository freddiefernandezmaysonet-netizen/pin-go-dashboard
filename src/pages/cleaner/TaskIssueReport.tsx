import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCleaningIssues, reportCleaningIssue, type CleanerTask, type CleaningIssueInput, type CleaningIssueKind } from "../../api/cleaner";

export function TaskIssueReport({ task, language }: { task: CleanerTask; language: "es" | "en" }) {
  const es = language === "es";
  const t = (spanish: string, english: string) => es ? spanish : english;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CleaningIssueKind>(task.startedAt ? "MORE_TIME" : "DELAY");
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<CleaningIssueInput | null>(null);
  const cache = useQueryClient();
  const reports = useQuery({ queryKey: ["cleaner-issues", task.id], queryFn: () => fetchCleaningIssues(task.id), enabled: open, refetchInterval: open ? 15_000 : false });
  const label = (value: CleaningIssueKind) => value === "DELAY" ? t("Llegaré tarde", "I will arrive late") : value === "MORE_TIME" ? t("Necesito más tiempo", "I need more time") : t("No puedo completar el trabajo", "I cannot complete the work");
  const format = (value: string) => new Intl.DateTimeFormat(es ? "es-PR" : "en-US", { timeZone: task.property.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const activeKind = task.startedAt ? (kind === "DELAY" ? "MORE_TIME" : kind) : "DELAY";
  const assessment = reports.data?.assessment;
  const assessmentText: Record<string, string> = {
    FOLLOW_ESTIMATE: t("El estimado cabe en el horario y los límites configurados.", "The estimate fits the schedule and configured limits."),
    ACCESS_EXTENSION_REQUIRED: t("Hace falta una extensión de acceso. Todavía no se ha aplicado.", "An access extension is needed. It has not been applied yet."),
    ACCESS_EXTENSION_PENDING: t("La extensión está pendiente de confirmación. Usa únicamente el horario de acceso confirmado.", "The extension is awaiting acknowledgement. Use only the confirmed access schedule."),
    ACCESS_EXTENDED: t("Tu acceso fue extendido con confirmación de TTLock.", "Your access was extended with TTLock acknowledgement."),
    BACKUP_REVIEW_REQUIRED: t("Hace falta evaluar un respaldo para el trabajo pendiente.", "A backup needs to be evaluated for the unfinished work."),
    HOST_REVIEW_REQUIRED: t("El reporte requiere revisión porque excede los límites automáticos o afecta el horario.", "The report needs review because it exceeds automatic limits or affects the schedule."),
    CONTEXT_UNAVAILABLE: t("No se pudo verificar el horario actual para evaluar el reporte.", "The current schedule could not be verified to evaluate the report."),
    REPORT_SUPERSEDED: t("Este reporte ya no aplica al estado actual del trabajo.", "This report no longer applies to the current work status."),
    CLEANER_ACTION_REQUIRED: t("Confirma primero el horario comprometido en Abrir limpieza.", "First confirm the committed timing in Open cleaning."),
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const eta = Number(minutes);
    if (!reason.trim() || (activeKind !== "INCOMPLETE" && (!Number.isInteger(eta) || eta < 1 || eta > 1440))) return;
    setBusy(true); setNotice(null);
    // Keep the same request and absolute estimate if the response is lost.
    const input = pending.current ?? { requestId: crypto.randomUUID(), kind: activeKind, reason: reason.trim(), estimatedAt: activeKind === "INCOMPLETE" ? null : new Date(Date.now() + eta * 60000).toISOString() };
    pending.current = input;
    try {
      await reportCleaningIssue(task.id, input);
      pending.current = null;
      setReason("");
      setNotice(t("Reporte registrado. Pin AI revisará el caso. Consulta aquí el resultado y el horario de acceso.", "Report recorded. Pin AI will review it. Check here for the result and access schedule."));
      await cache.invalidateQueries({ queryKey: ["cleaner-issues", task.id] });
      await cache.invalidateQueries({ queryKey: ["cleaner-tasks"] });
    } catch {
      setNotice(t("No se pudo confirmar el reporte. Actualiza la tarea y vuelve a intentar.", "Could not confirm the report. Refresh the task and try again."));
    } finally { setBusy(false); }
  }
  return <section aria-label={t("Reportar un problema", "Report an issue")}>
    <button aria-expanded={open} disabled={busy} onClick={() => setOpen(!open)}>{t("Reportar un problema", "Report an issue")}</button>
    {open ? <>
      {reports.isError ? <p role="alert">{t("No se pudieron cargar los reportes.", "Could not load reports.")}</p> : null}
      {reports.data?.reports[0] ? <p>{t("Último reporte", "Latest report")}: {label(reports.data.reports[0].kind)} — {format(reports.data.reports[0].reportedAt)}{reports.data.reports[0].estimatedAt ? ` · ${t("Estimado", "Estimate")}: ${format(reports.data.reports[0].estimatedAt)}` : ""}</p> : null}
      {assessment && assessmentText[assessment.decision] ? <p role="status">{assessmentText[assessment.decision]}{assessment.estimatedFinishAt ? ` ${t("Finalización estimada", "Estimated finish")}: ${format(assessment.estimatedFinishAt)}.` : ""}</p> : null}
      {assessment?.decision === "ACCESS_EXTENDED" && assessment.accessChanged && assessment.proposedAccessEnd ? <p role="status">{t("Acceso válido hasta", "Access valid until")}: {format(assessment.proposedAccessEnd)}.</p> : null}
      <form onSubmit={event => void submit(event)}>
        <label>{t("Situación", "Situation")}<select disabled={busy} value={activeKind} onChange={event => { setKind(event.target.value as CleaningIssueKind); pending.current = null; setNotice(null); }}>
          {task.startedAt ? <><option value="MORE_TIME">{label("MORE_TIME")}</option><option value="INCOMPLETE">{label("INCOMPLETE")}</option></> : <option value="DELAY">{label("DELAY")}</option>}
        </select></label>
        {activeKind !== "INCOMPLETE" ? <label>{activeKind === "DELAY" ? t("¿En cuántos minutos llegarás?", "How many minutes until you arrive?") : t("¿En cuántos minutos terminarás?", "How many minutes until you finish?")}<input type="number" min="1" max="1440" step="1" required disabled={busy} value={minutes} onChange={event => { setMinutes(event.target.value); pending.current = null; setNotice(null); }} /></label> : null}
        <label>{t("Motivo", "Reason")}<textarea required maxLength={1000} rows={3} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); pending.current = null; setNotice(null); }} /></label>
        <button disabled={busy || !reason.trim()} type="submit">{busy ? t("Guardando…", "Saving…") : t("Registrar reporte", "Record report")}</button>
      </form>
      {notice ? <p role="status">{notice}</p> : null}
    </> : null}
  </section>;
}

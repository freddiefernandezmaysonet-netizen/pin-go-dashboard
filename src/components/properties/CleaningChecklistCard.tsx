import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChecklistTemplate, saveChecklistTemplate, type ChecklistTemplate } from "../../api/cleaning-checklist";
import { useAuth } from "../../auth/AuthProvider";
import { CLEANING_CHECKLIST_PRESETS, checklistFromPreset } from "./cleaningChecklistPresets";

export function CleaningChecklistCard({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<ChecklistTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [presetId, setPresetId] = useState("turnover");
  const key = ["property-cleaning-checklist", user?.id, propertyId];
  const query = useQuery({ queryKey: key, queryFn: () => getChecklistTemplate(propertyId), enabled: opened });
  const suggested = !draft && query.data?.revision === 0 && query.data.items.length === 0;
  const template = draft ?? (suggested ? checklistFromPreset("turnover", 0) : query.data);
  const preset = CLEANING_CHECKLIST_PRESETS.find(candidate => candidate.id === presetId)!;
  const update = (id: string, changes: Partial<ChecklistTemplate["items"][number]>) => { if (template) setDraft({ ...template, items: template.items.map(item => item.id === id ? { ...item, ...changes } : item) }); };
  async function save() {
    if (!template) return;
    setBusy(true); setError("");
    try { const saved = await saveChecklistTemplate(propertyId, template); cache.setQueryData(key, saved); setDraft(null); }
    catch (failure) { setError(failure instanceof Error && failure.message === "CHECKLIST_REVISION_CONFLICT" ? "Someone updated this checklist. Reload before saving." : "Could not save. Add at least one language for every item and try again."); }
    finally { setBusy(false); }
  }
  return <details onToggle={event => setOpened(event.currentTarget.open)} style={{ padding: 18, border: "1px solid #dbeafe", borderRadius: 14 }}>
    <summary style={{ cursor: "pointer", fontWeight: 800 }}>Cleaning checklist / Checklist de limpieza</summary>
    <p>La lista también se aplica a limpiezas asignadas vacías que aún no hayan comenzado. Las que ya tengan tareas o hayan comenzado conservan su lista y progreso. / The list also applies to empty assigned cleanings that have not started. Populated or started checklists keep their list and progress.</p>
    {query.isPending && opened ? <p role="status">Loading…</p> : null}
    {query.isError || error ? <p role="alert">{error || "Could not load this property's checklist."}</p> : null}
    {template ? <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Property checklist</legend>
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 12, display: "grid", gap: 10 }}>
        <label htmlFor={`cleaning-preset-${propertyId}`} style={{ fontWeight: 700 }}>Plantillas listas para usar / Ready-to-use templates</label>
        <select id={`cleaning-preset-${propertyId}`} value={presetId} onChange={event => setPresetId(event.target.value)} style={{ width: "100%", padding: 12, borderRadius: 8 }}>
          {CLEANING_CHECKLIST_PRESETS.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <p style={{ margin: 0 }}>{preset.description} · {preset.items.length} tareas / tasks</p>
        <button type="button" onClick={() => { setDraft(checklistFromPreset(presetId, template.revision)); setError(""); }}>Usar plantilla / Use template</button>
        <small>La plantilla reemplaza la lista del editor. Revisa y guarda para aplicarla a nuevas limpiezas. / The template replaces the editor list. Review and save to apply it to new cleanings.</small>
      </div>
      {suggested ? <p role="status">Propuesta inicial: limpieza entre reservas. Puedes guardarla directamente o personalizarla. / Suggested turnover checklist: save it directly or customize it.</p> : null}
      {template.items.map((item, index) => <div key={item.id} style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "grid", gap: 8 }}>
        <label>Español — {index + 1}<input maxLength={500} value={item.es} onChange={event => update(item.id, { es: event.target.value })} style={{ width: "100%", padding: 12 }} /></label>
        <label>English — {index + 1}<input maxLength={500} value={item.en} onChange={event => update(item.id, { en: event.target.value })} style={{ width: "100%", padding: 12 }} /></label>
        <label><input type="checkbox" checked={item.required} onChange={event => update(item.id, { required: event.target.checked })} /> Required before finishing / Obligatorio para finalizar</label>
        <div><button type="button" disabled={index === 0} onClick={() => { const items = [...template.items]; [items[index - 1], items[index]] = [items[index]!, items[index - 1]!]; setDraft({ ...template, items }); }}>Move up</button> <button type="button" onClick={() => setDraft({ ...template, items: template.items.filter(candidate => candidate.id !== item.id) })}>Remove</button></div>
      </div>)}
      <p>One language is enough; add the other translation when available. The original is used if a translation is missing.</p>
      <button type="button" disabled={template.items.length >= 50} onClick={() => setDraft({ ...template, items: [...template.items, { id: crypto.randomUUID(), es: "", en: "", required: false }] })}>Add item</button> <button type="button" disabled={!draft && !suggested} onClick={() => void save()}>Save checklist</button>
      <button type="button" onClick={() => { setDraft(null); setError(""); void query.refetch(); }}>Reload</button>
    </fieldset> : null}
  </details>;
}

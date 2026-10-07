import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChecklistTemplate, saveChecklistTemplate, type ChecklistTemplate } from "../../api/cleaning-checklist";
import { useAuth } from "../../auth/AuthProvider";

export function CleaningChecklistCard({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<ChecklistTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = ["property-cleaning-checklist", user?.id, propertyId];
  const query = useQuery({ queryKey: key, queryFn: () => getChecklistTemplate(propertyId), enabled: opened });
  const template = draft ?? query.data;
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
    <p>Changes apply to new cleaning tasks. Assigned tasks keep their list and progress.</p>
    {query.isPending && opened ? <p role="status">Loading…</p> : null}
    {query.isError || error ? <p role="alert">{error || "Could not load this property's checklist."}</p> : null}
    {template ? <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Property checklist</legend>
      {template.items.map((item, index) => <div key={item.id} style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "grid", gap: 8 }}>
        <label>Español — {index + 1}<input maxLength={500} value={item.es} onChange={event => update(item.id, { es: event.target.value })} style={{ width: "100%", padding: 12 }} /></label>
        <label>English — {index + 1}<input maxLength={500} value={item.en} onChange={event => update(item.id, { en: event.target.value })} style={{ width: "100%", padding: 12 }} /></label>
        <label><input type="checkbox" checked={item.required} onChange={event => update(item.id, { required: event.target.checked })} /> Required before finishing / Obligatorio para finalizar</label>
        <div><button type="button" disabled={index === 0} onClick={() => { const items = [...template.items]; [items[index - 1], items[index]] = [items[index]!, items[index - 1]!]; setDraft({ ...template, items }); }}>Move up</button> <button type="button" onClick={() => setDraft({ ...template, items: template.items.filter(candidate => candidate.id !== item.id) })}>Remove</button></div>
      </div>)}
      <p>One language is enough; add the other translation when available. The original is used if a translation is missing.</p>
      <button type="button" disabled={template.items.length >= 50} onClick={() => setDraft({ ...template, items: [...template.items, { id: crypto.randomUUID(), es: "", en: "", required: false }] })}>Add item</button> <button type="button" disabled={!draft} onClick={() => void save()}>Save checklist</button>
      <button type="button" onClick={() => { setDraft(null); setError(""); void query.refetch(); }}>Reload</button>
    </fieldset> : null}
  </details>;
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCleaningRecoveryPolicy, saveCleaningRecoveryPolicy, type CleaningRecoveryPolicy } from "../../api/cleaning-recovery-policy";
import { useAuth } from "../../auth/AuthProvider";

export function CleaningRecoveryPolicyCard({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<CleaningRecoveryPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const key = ["cleaning-recovery-policy", user?.id, propertyId];
  const query = useQuery({ queryKey: key, queryFn: () => getCleaningRecoveryPolicy(propertyId), enabled: opened });
  const policy = draft ?? query.data;
  async function save() {
    if (!policy) return;
    setBusy(true); setNotice("");
    try {
      const saved = await saveCleaningRecoveryPolicy(propertyId, policy);
      cache.setQueryData(key, saved); setDraft(null); setNotice("Configuración guardada / Settings saved.");
    } catch (error) {
      setNotice(error instanceof Error && error.message === "CLEANING_RECOVERY_POLICY_CONFLICT" ? "Otro usuario cambió estos límites. Recarga antes de guardar. / Someone changed these limits. Reload before saving." : "No se pudo guardar. / Could not save.");
    } finally { setBusy(false); }
  }
  const fields = [
    ["maxDelayMinutes", "Retraso máximo que Pin AI puede manejar / Maximum delay Pin AI can handle", 240],
    ["maxAccessExtensionMinutes", "Extensión máxima sin próximo check-in / Maximum access extension with no next check-in", 240],
    ["arrivalSafetyMarginMinutes", "Margen antes de la próxima llegada / Margin before next arrival", 120],
  ] as const;
  return <details onToggle={event => setOpened(event.currentTarget.open)} style={{ padding: 18, border: "1px solid #dbeafe", borderRadius: 14 }}>
    <summary style={{ cursor: "pointer", fontWeight: 800 }}>Pin AI: retrasos de limpieza / Cleaning delays</summary>
    <p>Los límites se guardan por propiedad. Una extensión de 0 minutos no autoriza tiempo adicional. / Limits are saved per property. An extension of 0 minutes authorizes no additional time.</p>
    <p>El acceso nunca se extiende automáticamente si existe un próximo check-in. / Access is never automatically extended when there is a next check-in.</p>
    <p>Pin AI aplica estos límites al evaluar reportes, extender acceso y buscar un respaldo. / Pin AI uses these limits to assess reports, extend access and find a backup.</p>
    {query.isPending && opened ? <p role="status">Cargando… / Loading…</p> : null}
    {query.isError ? <p role="alert">No se pudo cargar. / Could not load.</p> : null}
    {policy ? <div><fieldset disabled={busy} style={{ border: 0, padding: 0, display: "grid", gap: 12 }}><legend>Límites en minutos / Limits in minutes</legend>
      {fields.map(([name, label, max]) => <label key={name} style={{ display: "grid", gap: 6 }}>{label}<input type="number" min={0} max={max} step={1} value={policy[name]} onChange={event => { setDraft({ ...policy, [name]: event.target.value === "" ? Number.NaN : Number(event.target.value) }); setNotice(""); }} style={{ padding: 12, font: "inherit", width: "100%", boxSizing: "border-box" }} /></label>)}
      <div><button type="button" onClick={() => void save()} disabled={!draft || fields.some(([name, , max]) => !Number.isInteger(policy[name]) || policy[name] < 0 || policy[name] > max)}>Guardar límites / Save limits</button> <button type="button" onClick={() => { setDraft(null); setNotice(""); void query.refetch(); }}>Recargar / Reload</button></div>
    </fieldset></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </details>;
}

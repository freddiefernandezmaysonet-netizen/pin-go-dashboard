import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPinAIOrganizations, setPinAIOrganization, type PinAIOrganization } from "../../api/pinAIActivation";

export default function AdminPinAIActivationPage() {
  const [input, setInput] = useState(""), [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PinAIOrganization | null>(null);
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const busy = useRef(false);
  const query = useQuery({ queryKey: ["admin-pin-ai-organizations", search],
    queryFn: ({ signal }) => listPinAIOrganizations(search, signal), retry: false });
  async function save() {
    if (!selected || busy.current) return;
    busy.current = true; setSaving(true); setNotice("");
    try {
      await setPinAIOrganization(selected);
      setNotice("Settings saved. Each property is enabled from its own settings.");
    } catch { setNotice("The change could not be confirmed. Refresh the list before trying again."); }
    finally { setSelected(null); await query.refetch(); busy.current = false; setSaving(false); }
  }
  return <main className="max-w-3xl space-y-5">
    <h1 className="text-2xl font-semibold">Pin AI · Organization enablement</h1>
    <p>Enable assistance for an organization. Its administrators choose the properties and accept the USD $1.00 fee per reservation from any source (Direct Booking, OTA or manual) when enabling them. Enabling the organization does not create an immediate charge or enable reservation changes or OTA messaging.</p>
    {query.data?.allOrganizationsAvailable ? <p role="status">Pin AI is available to all current and future organizations. Hosts enable each property and accept its billing authorization. Explicit organization restrictions remain in effect.</p> : null}
    {query.data && !query.data.rolloutActive ? <p role="status">Enforcement of these controls is pending. You can save the settings; the portal retains its previous availability until rollout.</p> : null}
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); setSelected(null); setSearch(input.trim()); }}>
      <label>Organization <input value={input} maxLength={80} disabled={saving} onChange={e => setInput(e.target.value)}
        className="ml-2 rounded-lg border border-slate-300 p-2" /></label>
      <button disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2">Search</button>
      <button type="button" disabled={saving || query.isFetching} onClick={() => { setSelected(null); void query.refetch(); }}
        className="rounded-lg border border-slate-300 px-4 py-2">Refresh</button>
    </form>
    {query.isPending ? <p role="status">Loading…</p> : null}
    {query.isError ? <p role="alert">The list could not be loaded. Pin&Go administrator access is required.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {!query.isError ? query.data?.items.map(row => <section key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">{row.name}</h2>
      <p>{row.pinAIRevision === 0 ? query.data?.allOrganizationsAvailable ? "Available · property authorization required" : "Current settings preserved" : row.pinAIEnabled ? "Organization enabled" : "Organization disabled"}</p>
      <button disabled={saving || query.isFetching} onClick={() => { setSelected(row); setNotice(""); }} className="mt-2 rounded-lg border border-blue-700 px-4 py-2 text-blue-800">
        {row.pinAIEnabled ? "Disable organization" : "Enable organization"}</button>
    </section>) : null}
    {query.data?.items.length === 0 ? <p>No matching organizations.</p> : null}
    {query.data?.items.length === 30 ? <p>Up to 30 results are shown. Use a more specific name.</p> : null}
    {selected ? <section aria-label="Confirm change" className="rounded-xl border border-blue-300 bg-blue-50 p-5 space-y-3">
      <p><strong>{selected.pinAIEnabled ? "Disable" : "Enable"} Pin AI for {selected.name}</strong></p>
      <p>{!query.data?.rolloutActive ? "This change will be saved and applied when these controls are rolled out." : selected.pinAIEnabled ? "New portal assistance at its properties will stop. Existing cases are preserved." : "Properties must be enabled individually to receive assistance. This replaces the portal's previous limited availability."}</p>
      <button disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-700 px-4 py-2 text-white">{saving ? "Saving…" : "Confirm change"}</button>
      <button disabled={saving} onClick={() => setSelected(null)} className="ml-3 rounded-lg border border-slate-300 px-4 py-2">Cancel</button>
    </section> : null}
  </main>;
}

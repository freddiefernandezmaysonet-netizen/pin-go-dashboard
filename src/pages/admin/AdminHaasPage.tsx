import { useCallback, useEffect, useRef, useState } from 'react';
const base = import.meta.env.VITE_API_BASE ?? '';
type Choice = { id: string; displayName: string | null; ttlockLockName: string | null; property: { name: string } };
type Row = { id: string; organizationName: string; fullName: string | null; email: string; phone: string | null;
  updatedAt: string; completedAt: string | null; selection: { model: string; termMonths: number | null } | null;
  payment: { status?: string; amountPaidCents?: number | null; currency?: string | null; recordedAt?: string };
  installation: { status: string; lockId: string | null; scheduledAt: string | null; notes: string };
  lock: (Choice & { isActive: boolean; deviceHealth: { battery: number | null; batteryLastSuccessfulAt: string | null;
    batteryProviderResponseAt: string | null; gatewayConnected: boolean | null; isOnline: boolean | null } | null }) | null };
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}/api/internal/admin/haas${path}`, { ...init, credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' } });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'HAAS_UNAVAILABLE');
  return body;
}
const date = (value?: string | null) => value ? new Date(value).toLocaleString('es-PR') : 'Sin información';
const states: Record<string, string> = { PENDING: 'Pendiente', SCHEDULED: 'Coordinada', COMPLETED: 'Completada' };
export default function AdminHaasPage() {
  const [items, setItems] = useState<Row[]>([]), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string | null>(null), [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Row | null>(null), [choices, setChoices] = useState<Choice[]>([]);
  const [status, setStatus] = useState('PENDING'), [lockId, setLockId] = useState(''), [scheduled, setScheduled] = useState(''), [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false), [choosing, setChoosing] = useState(false);
  const busy = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try { const result = await request<{ items: Row[]; nextCursor: string | null }>(`?q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }); setItems(result.items); setNext(result.nextCursor); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No se pudo cargar'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [query, cursor]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function edit(row: Row) {
    setChoosing(true); setError(''); setNotice(''); setChoices([]);
    try {
      const result = await request<{ items: Choice[] }>(`/${encodeURIComponent(row.id)}/locks`);
      setChoices(result.items);setStatus(row.installation.status);setLockId(row.installation.lockId ?? '');
      const d = row.installation.scheduledAt ? new Date(row.installation.scheduledAt) : null;
      setScheduled(d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16) : '');
      setNotes(row.installation.notes);setSelected(row);
    } catch { setError('No se pudieron cargar las cerraduras del cliente.'); } finally { setChoosing(false); }
  }
  async function save() {
    if (!selected || busy.current) return; busy.current = true;setSaving(true);setError('');
    try {
      await request(`/${encodeURIComponent(selected.id)}/installation`, { method: 'PATCH', body: JSON.stringify({ expectedUpdatedAt: selected.updatedAt, status, lockId: lockId || null, scheduledAt: scheduled ? new Date(scheduled).toISOString() : null, notes }) });
      setSelected(null);setNotice('Instalación guardada.');await load();
    } catch (e) { setError(e instanceof Error && e.message === 'HAAS_CONCURRENT_UPDATE' ? 'La contratación cambió. Cierra el formulario y actualiza antes de guardar.' : 'No se pudo guardar. Comprueba la fecha y la cerradura seleccionada.'); }
    finally { busy.current = false;setSaving(false); }
  }
  return <main className="max-w-6xl space-y-5">
    <h1 className="text-2xl font-semibold">Hardware as a Service</h1>
    <p className="text-slate-600">Contrataciones, instalación y estado de la cerradura alquilada. La batería muestra la última lectura registrada por Pin&Go.</p>
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault();setSelected(null);setCursor(null);setQuery(search.trim()); }}>
      <label>Cliente <input className="ml-2 rounded-lg border p-2" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} /></label>
      <button disabled={loading || saving} className="rounded-lg bg-blue-700 px-4 py-2 text-white">Buscar</button>
      <button type="button" disabled={loading || saving} onClick={()=>{setSelected(null);void load();}} className="rounded-lg border px-4 py-2">Actualizar</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Cargando…</p> : !error && items.length === 0 ? <p>No hay contrataciones de hardware en esta búsqueda.</p> : null}
    {!loading && !error && <div className="grid gap-4 lg:grid-cols-2">{items.map(row => {
      const health = row.lock?.deviceHealth, measuredAt = health?.batteryProviderResponseAt ?? health?.batteryLastSuccessfulAt;
      return <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 break-words">
        <h2 className="text-lg font-semibold">{row.organizationName}</h2>
        <p>{row.fullName} · {row.email}<br />{row.phone}</p>
        <p><strong>{row.selection?.model.toUpperCase()}</strong> · {row.selection?.termMonths ? `${row.selection.termMonths} meses` : 'Plazo por verificar'}</p>
        <p>Pago inicial: {row.payment.status === 'paid' ? 'Confirmado por Stripe' : 'Verificación pendiente (registro anterior)'}
          {row.payment.amountPaidCents != null && row.payment.currency ? ` · ${new Intl.NumberFormat('es-PR', {style:'currency',currency:row.payment.currency.toUpperCase()}).format(row.payment.amountPaidCents/100)}` : ''}</p>
        <p>Fecha: {date(row.payment.recordedAt ?? row.completedAt)}</p>
        <p>Instalación: <strong>{states[row.installation.status] ?? row.installation.status}</strong>{row.installation.scheduledAt ? ` · ${date(row.installation.scheduledAt)}` : ''}</p>
        {row.lock ? <div className="rounded-xl bg-slate-50 p-3 space-y-1">
          <p>{row.lock.property.name} · {row.lock.displayName ?? row.lock.ttlockLockName ?? row.lock.id}{!row.lock.isActive ? ' · Inactiva' : ''}</p>
          <p>Batería: {health?.battery != null ? `${health.battery}%` : 'Sin lectura disponible'}</p>
          <p>Última lectura: {date(measuredAt)}</p>
          <p>Gateway: {health?.gatewayConnected == null ? 'Sin información' : health.gatewayConnected ? 'Conectado' : 'Desconectado'}</p>
        </div> : <p className="text-slate-500">Cerradura pendiente de vincular. El cliente debe conectar TTLock e importar la cerradura a su propiedad.</p>}
        {row.installation.notes && <p className="whitespace-pre-wrap break-words">{row.installation.notes}</p>}
        <button disabled={saving || choosing || row.payment.status !== 'paid'} onClick={()=>void edit(row)} className="rounded-lg border border-blue-700 px-4 py-2 text-blue-800 disabled:opacity-50">Gestionar instalación</button>
      </article>;
    })}</div>}
    <div className="flex gap-3"><button disabled={!cursor || loading} className="rounded-lg border px-4 py-2" onClick={()=>setCursor(null)}>Primera página</button><button disabled={!next || loading} className="rounded-lg border px-4 py-2" onClick={()=>setCursor(next)}>Siguiente</button></div>
    {selected && <section aria-label="Gestionar instalación" className="rounded-2xl border border-blue-300 bg-blue-50 p-5 space-y-4">
      <h2 className="font-semibold">Instalación · {selected.organizationName}</h2>
      <label className="block">Estado <select aria-label="Estado" className="ml-2 rounded-lg border p-2" value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(states).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="block">Fecha y hora local <input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)} className="ml-2 max-w-full rounded-lg border p-2" /></label>
      <label className="block">Cerradura alquilada <select aria-label="Cerradura alquilada" className="ml-2 max-w-full rounded-lg border p-2" value={lockId} onChange={e=>setLockId(e.target.value)}><option value="">Pendiente de vincular</option>{choices.map(lock=><option key={lock.id} value={lock.id}>{lock.property.name} · {lock.displayName ?? lock.ttlockLockName ?? lock.id}</option>)}</select></label>
      {choices.length===0 && <p>El cliente todavía no tiene cerraduras activas importadas.</p>}
      <label className="block">Notas <textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2 block w-full rounded-lg border p-2" /></label>
      <button disabled={saving || (status==='COMPLETED' && !lockId) || (status==='SCHEDULED' && !scheduled)} onClick={()=>void save()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{saving?'Guardando…':'Guardar'}</button>
      <button disabled={saving} onClick={()=>setSelected(null)} className="ml-3 rounded-lg border px-4 py-2">Cancelar</button>
    </section>}
  </main>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, LockKeyhole, Package, RefreshCw, Search } from 'lucide-react';
import './AdminHaasPage.css';
const base = import.meta.env.VITE_API_BASE ?? '';
type Choice = { id: string; displayName: string | null; ttlockLockName: string | null; property: { name: string } };
type Row = { id: string; organizationName: string; fullName: string | null; email: string; phone: string | null;
  updatedAt: string; completedAt: string | null; selection: { model: string; termMonths: number | null } | null;
  payment: { status?: string; amountPaidCents?: number | null; currency?: string | null; recordedAt?: string };
  installation: { status: string; lockId: string | null; scheduledAt: string | null; notes: string; installationAddress?: string; serialNumber?: string };
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
  const [batteryFilter, setBatteryFilter] = useState('all');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Row | null>(null), [choices, setChoices] = useState<Choice[]>([]);
  const [status, setStatus] = useState('PENDING'), [lockId, setLockId] = useState(''), [scheduled, setScheduled] = useState(''), [notes, setNotes] = useState('');
  const [installationAddress, setInstallationAddress] = useState(''), [serialNumber, setSerialNumber] = useState('');
  const [saving, setSaving] = useState(false), [choosing, setChoosing] = useState(false);
  const busy = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try { const result = await request<{ items: Row[]; nextCursor: string | null }>(`?q=${encodeURIComponent(query)}&battery=${batteryFilter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }); setItems(result.items); setNext(result.nextCursor); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No se pudo cargar'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [query, cursor, batteryFilter]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function edit(row: Row) {
    setChoosing(true); setError(''); setNotice(''); setChoices([]);
    try {
      const result = await request<{ items: Choice[] }>(`/${encodeURIComponent(row.id)}/locks`);
      setChoices(result.items);setStatus(row.installation.status);setLockId(row.installation.lockId ?? '');
      const d = row.installation.scheduledAt ? new Date(row.installation.scheduledAt) : null;
      setScheduled(d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16) : '');
      setNotes(row.installation.notes);setInstallationAddress(row.installation.installationAddress ?? "");setSerialNumber(row.installation.serialNumber ?? "");setSelected(row);
    } catch { setError('No se pudieron cargar las cerraduras del cliente.'); } finally { setChoosing(false); }
  }
  async function save() {
    if (!selected || busy.current) return; busy.current = true;setSaving(true);setError('');
    try {
      await request(`/${encodeURIComponent(selected.id)}/installation`, { method: 'PATCH', body: JSON.stringify({ expectedUpdatedAt: selected.updatedAt, status, lockId: lockId || null, scheduledAt: scheduled ? new Date(scheduled).toISOString() : null, notes, installationAddress, serialNumber }) });
      setSelected(null);setNotice('Instalación guardada.');await load();
    } catch (e) { setError(e instanceof Error && e.message === 'HAAS_CONCURRENT_UPDATE' ? 'La contratación cambió. Cierra el formulario y actualiza antes de guardar.' : 'No se pudo guardar. Comprueba la fecha y la cerradura seleccionada.'); }
    finally { busy.current = false;setSaving(false); }
  }
  return <main className="pg-haas">
    <header className="pg-haas-heading">
      <div><h1>Hardware as a Service</h1><p>Gestiona las contrataciones, instalaciones y cerraduras alquiladas desde un solo lugar.</p></div>
      <button type="button" disabled={loading || saving} onClick={()=>{setSelected(null);void load();}} className="pg-haas-button"><RefreshCw size={16} aria-hidden="true" />Actualizar</button>
    </header>
    <section className="pg-haas-toolbar" aria-label="Buscar contrataciones">
      <div className="pg-haas-section-heading"><h2>Contrataciones</h2><p>Busca por organización, nombre o correo del cliente.</p></div>
      <form onSubmit={e => { e.preventDefault();setSelected(null);setCursor(null);setQuery(search.trim()); }}>
        <label className="pg-haas-field">Cliente<div className="pg-haas-search"><Search size={18} aria-hidden="true" /><input placeholder="Buscar cliente u organización" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} /></div></label>
        <label className="pg-haas-field">Batería<select aria-label="Batería" value={batteryFilter} disabled={saving} onChange={e=>{setSelected(null);setCursor(null);setBatteryFilter(e.target.value);}}><option value="all">Todas</option><option value="low">30 % o menos</option></select></label>
        <button disabled={loading || saving} className="pg-haas-button pg-haas-primary">Buscar</button>
      </form>
    </section>
    {error && <p role="alert" className="pg-haas-message pg-haas-error">{error}</p>}
    {notice && <p role="status" className="pg-haas-message pg-haas-success">{notice}</p>}
    {loading ? <section className="pg-haas-empty" role="status"><RefreshCw size={24} aria-hidden="true" /><h2>Cargando contrataciones…</h2></section> : !error && items.length === 0 ? <section className="pg-haas-empty">
      <span className="pg-haas-empty-icon"><Package size={30} aria-hidden="true" /></span>
      <h2>{batteryFilter === 'low' ? 'No hay baterías de 30 % o menos con estos filtros' : query ? 'No se encontraron contrataciones' : 'Tus contrataciones aparecerán aquí'}</h2>
      <p>{batteryFilter === 'low' ? 'Se usan las lecturas guardadas. Las cerraduras sin lectura no aparecen en este filtro. Puedes elegir Todas o cambiar la búsqueda del cliente.' : query ? 'Prueba con otro nombre, organización o correo electrónico.' : 'Cuando Stripe confirme una compra de hardware, podrás consultar al cliente, coordinar su instalación y vincular la cerradura.'}</p>
    </section> : null}
    {selected && <section aria-label="Gestionar instalación" className="pg-haas-editor">
      <div className="pg-haas-section-heading"><h2>Gestionar instalación</h2><p>{selected.organizationName} · {selected.selection?.model.toUpperCase()}</p></div>
      <div className="pg-haas-form-grid">
        <label className="pg-haas-field">Estado<select aria-label="Estado" value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(states).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="pg-haas-field">Fecha y hora local<input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)} /></label>
        <label className="pg-haas-field pg-haas-full">Dirección de instalación<textarea className="pg-haas-address" maxLength={1000} value={installationAddress} onChange={e=>setInstallationAddress(e.target.value)} placeholder="Calle, número, unidad, ciudad y código postal" /></label>
        <label className="pg-haas-field pg-haas-full">Número de serie de la cerradura<input maxLength={120} value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} placeholder="Número de serie impreso en el equipo" /><span className="pg-haas-muted">Número físico del equipo; distinto del identificador de TTLock.</span></label>
        <label className="pg-haas-field pg-haas-full">Cerradura alquilada<select aria-label="Cerradura alquilada" value={lockId} onChange={e=>setLockId(e.target.value)}><option value="">Pendiente de vincular</option>{choices.map(lock=><option key={lock.id} value={lock.id}>{lock.property.name} · {lock.displayName ?? lock.ttlockLockName ?? lock.id}</option>)}</select></label>
        {choices.length===0 && <p className="pg-haas-muted pg-haas-full">El cliente todavía no tiene cerraduras activas importadas.</p>}
        <label className="pg-haas-field pg-haas-full">Notas<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalles de coordinación o instalación" /></label>
      </div>
      <div className="pg-haas-actions"><button disabled={saving || (status==='COMPLETED' && !lockId) || (status==='SCHEDULED' && !scheduled)} onClick={()=>void save()} className="pg-haas-button pg-haas-primary">{saving?'Guardando…':'Guardar'}</button><button disabled={saving} onClick={()=>setSelected(null)} className="pg-haas-button">Cancelar</button></div>
    </section>}
    {!loading && !error && <div className="pg-haas-grid">{items.map(row => {
      const health = row.lock?.deviceHealth, measuredAt = health?.batteryProviderResponseAt ?? health?.batteryLastSuccessfulAt;
      return <article key={row.id} className="pg-haas-card">
        <div className="pg-haas-card-heading"><div><h2>{row.organizationName}</h2><p>Hardware alquilado · {row.selection?.model.toUpperCase() ?? 'Modelo por verificar'}</p></div><span className={`pg-haas-badge ${row.installation.status === 'COMPLETED' ? 'pg-haas-badge-green' : row.installation.status === 'SCHEDULED' ? 'pg-haas-badge-blue' : ''}`}>{states[row.installation.status] ?? row.installation.status}</span></div>
        <div className="pg-haas-contact"><p className="pg-haas-contact-name">{row.fullName ?? 'Contacto del cliente'}</p><p>{row.email}</p>{row.phone && <p>{row.phone}</p>}</div>
        <dl className="pg-haas-details">
          <div><dt>Contrato</dt><dd>{row.selection?.termMonths ? `${row.selection.termMonths} meses` : 'Plazo por verificar'}</dd></div>
          <div><dt>Pago inicial</dt><dd>{row.payment.amountPaidCents != null && row.payment.currency ? new Intl.NumberFormat('es-PR', {style:'currency',currency:row.payment.currency.toUpperCase()}).format(row.payment.amountPaidCents/100) : 'Sin importe registrado'}</dd></div>
        </dl>
        <div className="pg-haas-payment"><span className={`pg-haas-badge ${row.payment.status === 'paid' ? 'pg-haas-badge-green' : 'pg-haas-badge-amber'}`}>{row.payment.status === 'paid' ? 'Confirmado por Stripe' : 'Verificación pendiente'}</span><p>{date(row.payment.recordedAt ?? row.completedAt)}</p></div>
        <dl className="pg-haas-installation-details"><div><dt>Dirección de instalación</dt><dd>{row.installation.installationAddress || "Pendiente de documentar"}</dd></div><div><dt>Número de serie</dt><dd>{row.installation.serialNumber || "Pendiente de documentar"}</dd></div></dl>
        {row.installation.scheduledAt && <p className="pg-haas-schedule"><CalendarClock size={16} aria-hidden="true" />Instalación: {date(row.installation.scheduledAt)}</p>}
        {row.lock ? <section className="pg-haas-device" aria-label="Estado de la cerradura">
          <div className="pg-haas-device-heading"><LockKeyhole size={18} aria-hidden="true" /><div><h3>{row.lock.displayName ?? row.lock.ttlockLockName ?? row.lock.id}</h3><p>{row.lock.property.name}{!row.lock.isActive ? ' · Inactiva' : ''}</p></div></div>
          <dl className="pg-haas-details"><div><dt>Batería</dt><dd>{health?.battery != null ? `${health.battery}%` : 'Sin lectura'}</dd></div><div><dt>Gateway</dt><dd>{health?.gatewayConnected == null ? 'Sin información' : health.gatewayConnected ? 'Conectado' : 'Desconectado'}</dd></div></dl>
          <p className="pg-haas-muted">Última lectura: {date(measuredAt)}</p>
        </section> : <div className="pg-haas-device pg-haas-device-pending"><LockKeyhole size={20} aria-hidden="true" /><div><h3>Cerradura pendiente de vincular</h3><p>El cliente debe conectar TTLock e importar la cerradura a su propiedad.</p></div></div>}
        {row.installation.notes && <p className="pg-haas-notes">{row.installation.notes}</p>}
        <div className="pg-haas-card-actions"><button disabled={saving || choosing || row.payment.status !== 'paid'} onClick={()=>void edit(row)} className="pg-haas-button">Gestionar instalación</button></div>
      </article>;
    })}</div>}
    {!loading && !error && items.length > 0 && <footer className="pg-haas-pagination"><p>{items.length} {items.length === 1 ? 'contratación en esta página' : 'contrataciones en esta página'}</p><div className="pg-haas-actions"><button disabled={!cursor || loading} className="pg-haas-button" onClick={()=>setCursor(null)}>Primera página</button><button disabled={!next || loading} className="pg-haas-button" onClick={()=>setCursor(next)}>Siguiente</button></div></footer>}
  </main>;
}

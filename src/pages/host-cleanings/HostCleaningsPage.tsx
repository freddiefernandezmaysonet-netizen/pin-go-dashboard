import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { cleanerRequest } from "../../api/cleaner";
import "./HostCleaningsPage.css";

type Item = {
  id: string; property: { id: string; name: string; timezone: string }; cleaner: { id: string; fullName: string };
  reservation: { id: string; number: string | null }; status: string; scheduledStartAt: string; committedEndAt: string | null;
  startedAt: string | null; completedAt: string | null; actualDurationMinutes: number | null;
  checklist: { id: string; labelEs: string; labelEn: string; required: boolean; checked: boolean; checkedAt: string | null }[] | null;
  reports: { id: string; kind: string; reason: string; estimatedAt: string | null; reportedAt: string }[];
};
type Result = { items: Item[]; nextCursor: string | null; properties: { id: string; name: string }[]; staff: { id: string; fullName: string }[] };
const statuses: Record<string, string> = { PENDING: "Awaiting acceptance", CONFIRMED: "Confirmed", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled", DECLINED: "Declined", REASSIGNED: "Reassigned", EXPIRED: "Expired" };
const views = [["today", "Today"], ["upcoming", "Upcoming"], ["history", "History"], ["all", "All"]];
function date(value: string | null, timezone: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}
export default function HostCleaningsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [cursors, setCursors] = useState<string[]>([]);
  const canRead = ["ADMIN", "ORG_ADMIN", "PLATFORM_ADMIN"].includes(user?.role ?? "");
  const view = params.get("view") ?? (params.has("reservationId") ? "all" : "today");
  const query = new URLSearchParams(params);
  query.set("view", view);
  const cursor = cursors[cursors.length - 1];
  if (cursor) query.set("cursor", cursor);
  const path = `/api/host/cleanings?${query}`;
  const result = useQuery({ queryKey: ["host-cleanings", user?.orgId, user?.id, path], queryFn: () => cleanerRequest<Result>(path), enabled: canRead, refetchInterval: 30_000 });
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setCursors([]); setParams(next);
  }
  if (!canRead) return <p role="alert">Administrator permissions are required to view cleanings.</p>;
  return <section className="pg-host-cleanings">
    <header><div><h1>Cleanings</h1><p>Monitor your team’s work and review recorded cleaning times.</p></div><button type="button" onClick={() => void result.refetch()} disabled={result.isFetching}>Refresh</button></header>
    <nav aria-label="Cleaning views">{views.map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => filter("view", key)}>{label}</button>)}</nav>
    <div className="pg-cleaning-filters">
      <label>Property<select value={params.get("propertyId") ?? ""} onChange={e => filter("propertyId", e.target.value)}><option value="">All properties</option>{result.data?.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Cleaner<select value={params.get("staffMemberId") ?? ""} onChange={e => filter("staffMemberId", e.target.value)}><option value="">All cleaners</option>{result.data?.staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label>
      <label>Status<select value={params.get("status") ?? ""} onChange={e => filter("status", e.target.value)}><option value="">All statuses</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {params.has("reservationId") && <button type="button" onClick={() => filter("reservationId", "")}>Clear reservation filter</button>}
    </div>
    <p className="pg-cleaning-note">Times use each property’s time zone. Actual start and completion are recorded by the cleaner.</p>
    {result.isPending && <p role="status">Loading cleanings…</p>}
    {result.isError && <p role="alert">Unable to refresh cleanings. Select Refresh to try again.</p>}
    {result.data && !result.isError && <>
      <p role="status">{result.data.items.length ? `${result.data.items.length} cleanings on this page` : "No cleanings match these filters."}</p>
      <div className="pg-cleaning-list">{result.data.items.map(item => <article key={item.id}>
        <header><div><h2>{item.property.name}</h2><p>{item.cleaner.fullName} · <Link to={`/reservations/${item.reservation.id}`}>{item.reservation.number ?? "View reservation"}</Link></p></div><span className={`pg-cleaning-state state-${item.status.toLowerCase()}`}>{statuses[item.status] ?? item.status}</span></header>
        <p className="pg-cleaning-note">{item.property.timezone}</p>
        <dl>{[["Scheduled start", date(item.scheduledStartAt, item.property.timezone)], ["Committed completion", item.committedEndAt ? date(item.committedEndAt, item.property.timezone) : "Awaiting commitment"], ["Actual start", date(item.startedAt, item.property.timezone)], ["Actual completion", date(item.completedAt, item.property.timezone)], ["Actual duration", item.actualDurationMinutes === null ? "Not recorded" : `${item.actualDurationMinutes} min`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <details><summary>Checklist · {item.checklist ? `${item.checklist.filter(i => i.checked).length}/${item.checklist.length}` : "not recorded"} · Reports ({item.reports.length})</summary>
          {item.checklist?.length ? <ul>{item.checklist.map(task => <li key={task.id}>{task.checked ? "✓" : "○"} {task.labelEn || task.labelEs}{task.required ? " · Required" : ""}{task.checkedAt && <small> · {date(task.checkedAt, item.property.timezone)}</small>}</li>)}</ul> : <p>No checklist is recorded for this cleaning.</p>}
          {item.reports.map(report => <div className="pg-cleaning-report" key={report.id}><strong>{{ DELAY: "Delay", MORE_TIME: "More time", INCOMPLETE: "Incomplete work" }[report.kind] ?? report.kind}</strong><p>{report.reason}</p><small>{date(report.reportedAt, item.property.timezone)}{report.estimatedAt ? ` · Estimated: ${date(report.estimatedAt, item.property.timezone)}` : ""}</small></div>)}
        </details>
      </article>)}</div>
      <div className="pg-cleaning-pagination"><button type="button" disabled={!cursors.length || result.isFetching} onClick={() => setCursors(previous => previous.slice(0, -1))}>Previous</button><button type="button" disabled={!result.data.nextCursor || result.isFetching} onClick={() => setCursors(previous => [...previous, result.data!.nextCursor!])}>Next</button></div>
    </>}
  </section>;
}

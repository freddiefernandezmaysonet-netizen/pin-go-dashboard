import { CleanerAccountSetup } from "./CleanerAccountSetup";
import { useEffect, useState } from "react";
import { fetchMe } from "../../api/auth";
import type { StaffLanguage } from "../../api/staff";

type StaffRow = {
  id: string;
  organizationId: string;
  dashboardUserId?: string | null;
  cleanerAccountEmail?: string | null;
  fullName: string;
  preferredLanguage?: StaffLanguage;
  phoneE164: string | null;
  companyName: string | null;
  photoUrl: string | null;
  ttlockCardRef: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PropertyAssignmentRow = {
  id: string;
  name: string;
  assignment: {
    id: string;
    role: "PRIMARY" | "BACKUP";
    backupOrder: number | null;
    isActive: boolean;
    cleaningDurationCommitmentMinutes: number | null;
    cleaningStartConfirmationGraceMinutes: number;
    cleaningFollowupGraceMinutes: number;
  } | null;
};

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "http://localhost:3000" : "");

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

export function StaffMembersPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [items, setItems] = useState<StaffRow[]>([]);
  const [assignments, setAssignments] = useState<
    Record<string, PropertyAssignmentRow[]>
  >({});
  const [loadingAssignments, setLoadingAssignments] = useState<
    Record<string, boolean>
  >({});
  const [savingAssignments, setSavingAssignments] = useState<
    Record<string, boolean>
  >({});
  const [expandedTiming, setExpandedTiming] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<StaffLanguage>("en");
  const [phoneE164, setPhoneE164] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [ttlockCardRef, setTtlockCardRef] = useState("");

  async function loadAssignments(staffId: string) {
    if (!staffId || assignments[staffId] || loadingAssignments[staffId]) return;

    setLoadingAssignments((prev) => ({ ...prev, [staffId]: true }));

    try {
      const res = await fetch(
        `${API_BASE}/staff/${staffId}/property-assignments`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      const json = await res.json();

      setAssignments((prev) => ({
        ...prev,
        [staffId]: json.properties || [],
      }));
    } catch (e) {
      console.error("[loadAssignments]", e);
    } finally {
      setLoadingAssignments((prev) => ({ ...prev, [staffId]: false }));
    }
  }

  async function loadStaff(orgId?: string) {
    setLoading(true);
    setErr(null);

    try {
      let resolvedOrgId = orgId ?? organizationId;

      if (!resolvedOrgId) {
        const me = await fetchMe();
        resolvedOrgId = String(me?.orgId ?? "");

        if (!resolvedOrgId) {
          throw new Error("No organizationId found in current session");
        }

        setOrganizationId(resolvedOrgId);
      }

      const res = await fetch(
        `${API_BASE}/staff?organizationId=${encodeURIComponent(resolvedOrgId)}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      const data: StaffRow[] = await res.json();
      setItems(data ?? []);

      for (const staff of data ?? []) {
        loadAssignments(staff.id);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setFullName("");
    setPreferredLanguage("en");
    setPhoneE164("");
    setCompanyName("");
    setPhotoUrl("");
    setTtlockCardRef("");
    setEditingId(null);
  }

  async function handleCreateOrUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!organizationId) {
      setErr("Missing organizationId");
      return;
    }

    if (!fullName.trim()) {
      setErr("Full name is required");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      if (editingId) {
        const res = await fetch(`${API_BASE}/staff/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            preferredLanguage,
            phoneE164: phoneE164.trim() || "",
            companyName: companyName.trim() || "",
            photoUrl: photoUrl.trim() || "",
            ttlockCardRef: ttlockCardRef.trim() || "",
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${t || res.statusText}`);
        }
      } else {
        const res = await fetch(`${API_BASE}/staff`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            fullName: fullName.trim(),
            preferredLanguage,
            phoneE164: phoneE164.trim() || undefined,
            companyName: companyName.trim() || undefined,
            photoUrl: photoUrl.trim() || undefined,
            ttlockCardRef: ttlockCardRef.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${t || res.statusText}`);
        }
      }

      resetForm();
      setAssignments({});
      await loadStaff(organizationId);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item: StaffRow) {
    setEditingId(item.id);
    setFullName(item.fullName ?? "");
    setPreferredLanguage(item.preferredLanguage === "es" ? "es" : "en");
    setPhoneE164(item.phoneE164 ?? "");
    setCompanyName(item.companyName ?? "");
    setPhotoUrl(item.photoUrl ?? "");
    setTtlockCardRef(item.ttlockCardRef ?? "");
    setErr(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArchive(id: string) {
    const ok = window.confirm(
      "Are you sure you want to archive this staff member?"
    );
    if (!ok) return;

    setArchivingId(id);
    setErr(null);

    try {
      const res = await fetch(`${API_BASE}/staff/${id}/archive`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      if (editingId === id) resetForm();

      setAssignments((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await loadStaff(organizationId);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setArchivingId(null);
    }
  }

  function updatePropertyRole(
    staffId: string,
    propertyIndex: number,
    role: "" | "PRIMARY" | "BACKUP"
  ) {
    setAssignments((prev) => {
      const list = [...(prev[staffId] || [])];
      const current = list[propertyIndex];

      if (!current) return prev;

      list[propertyIndex] = {
        ...current,
        assignment: role
          ? {
              id: current.assignment?.id ?? "",
              role,
              backupOrder:
                role === "BACKUP"
                  ? current.assignment?.backupOrder ?? 1
                  : null,
              isActive: true,
              cleaningDurationCommitmentMinutes:
                current.assignment?.cleaningDurationCommitmentMinutes ?? null,
              cleaningStartConfirmationGraceMinutes:
                current.assignment?.cleaningStartConfirmationGraceMinutes ?? 30,
              cleaningFollowupGraceMinutes:
                current.assignment?.cleaningFollowupGraceMinutes ?? 15,
            }
          : null,
      };

      return {
        ...prev,
        [staffId]: list,
      };
    });
  }

  function updateBackupOrder(
    staffId: string,
    propertyIndex: number,
    backupOrder: number
  ) {
    setAssignments((prev) => {
      const list = [...(prev[staffId] || [])];
      const current = list[propertyIndex];

      if (!current?.assignment) return prev;

      list[propertyIndex] = {
        ...current,
        assignment: {
          ...current.assignment,
          backupOrder: Math.max(1, Math.trunc(Number(backupOrder) || 1)),
        },
      };

      return {
        ...prev,
        [staffId]: list,
      };
    });
  }

  function updateCleaningTiming(
    staffId: string,
    propertyIndex: number,
    field:
      | "cleaningDurationCommitmentMinutes"
      | "cleaningStartConfirmationGraceMinutes"
      | "cleaningFollowupGraceMinutes",
    value: number | null
  ) {
    setAssignments((prev) => {
      const list = [...(prev[staffId] || [])];
      const current = list[propertyIndex];
      if (!current?.assignment) return prev;
      list[propertyIndex] = {
        ...current,
        assignment: { ...current.assignment, [field]: value },
      };
      return { ...prev, [staffId]: list };
    });
  }

  function cleaningTimingError(assignment: PropertyAssignmentRow["assignment"]) {
    if (!assignment?.role || assignment.cleaningDurationCommitmentMinutes === null) return null;
    if (assignment.cleaningStartConfirmationGraceMinutes >= assignment.cleaningDurationCommitmentMinutes) {
      return "Start reminder must be earlier than the standard cleaning time.";
    }
    return null;
  }

  async function savePropertyAssignments(staffId: string) {
    setSavingAssignments((prev) => ({ ...prev, [staffId]: true }));
    setErr(null);

    try {
      const payload = (assignments[staffId] || []).map((p) => ({
        propertyId: p.id,
        role: p.assignment?.role,
        backupOrder: p.assignment?.backupOrder ?? 1,
        isActive: Boolean(p.assignment?.role),
        ...(p.assignment?.role
          ? {
              cleaningDurationCommitmentMinutes:
                p.assignment.cleaningDurationCommitmentMinutes,
              cleaningStartConfirmationGraceMinutes:
                p.assignment.cleaningStartConfirmationGraceMinutes,
              cleaningFollowupGraceMinutes:
                p.assignment.cleaningFollowupGraceMinutes,
            }
          : {}),
      }));

      const res = await fetch(`${API_BASE}/staff/${staffId}/property-assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignments: payload }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      setAssignments((prev) => {
        const next = { ...prev };
        delete next[staffId];
        return next;
      });

      await loadAssignments(staffId);
      alert("Cleaning assignments saved");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSavingAssignments((prev) => ({ ...prev, [staffId]: false }));
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <style>{`
        @media (max-width: 900px) {
          .staff-assignment-header { display: none !important; }
          .staff-assignment-row { grid-template-columns: minmax(0, 1fr) minmax(120px, .7fr) 80px !important; }
          .staff-assignment-row > :nth-child(4) { grid-column: 1 / 3; }
          .staff-assignment-row > :nth-child(5) { grid-column: 3; grid-row: 2; }
        }
        @media (max-width: 620px) {
          .staff-assignment-row { grid-template-columns: minmax(0, 1fr) !important; }
          .staff-assignment-row > * { grid-column: 1 !important; grid-row: auto !important; }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>
            Staff Members
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Manage cleaners, technicians, and support staff for your organization.
          </div>
        </div>
      </div>

      {err ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <b>Error:</b> {err}
        </div>
      ) : null}

      <form
        onSubmit={handleCreateOrUpdate}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
          {editingId ? "Edit Staff Member" : "Add Staff Member"}
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: "0 12px",
              fontSize: 14,
            }}
          />

          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <label htmlFor="staff-preferred-language" style={{ fontSize: 14, fontWeight: 600 }}>
              Preferred language / Idioma preferido
            </label>
            <select
              id="staff-preferred-language"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value === "es" ? "es" : "en")}
              disabled={saving}
              aria-describedby="staff-language-help"
              style={{ width: "100%", minHeight: 44, borderRadius: 12, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 16, background: "#fff" }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
            <small id="staff-language-help" style={{ color: "#6b7280", lineHeight: 1.4 }}>
              Language for cleaning messages and the cleaner portal.
              {" "}Idioma de los mensajes y del portal de limpieza.
            </small>
          </div>

          <input
            value={phoneE164}
            onChange={(e) => setPhoneE164(e.target.value)}
            placeholder="Phone E.164"
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: "0 12px",
              fontSize: 14,
            }}
          />

          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name"
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: "0 12px",
              fontSize: 14,
            }}
          />

          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="Photo URL"
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: "0 12px",
              fontSize: 14,
            }}
          />

          <input
            value={ttlockCardRef}
            onChange={(e) => setTtlockCardRef(e.target.value)}
            placeholder="TTLock card ref"
            style={{
              height: 44,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: "0 12px",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              minHeight: 44,
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save Changes"
                : "Create Staff Member"}
          </button>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              style={{
                minHeight: 44,
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div style={{ color: "#666" }}>Loading...</div>
      ) : items.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            color: "#666",
            background: "#fff",
          }}
        >
          No staff members found yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          {items.map((s) => {
            const staffAssignments = assignments[s.id] || [];
            const isLoadingAssignments = loadingAssignments[s.id];
            const isSavingAssignments = savingAssignments[s.id];

            return (
              <div
                key={s.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 18,
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                 }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {s.fullName}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}
                    >
                      Staff Member
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: s.isActive ? "#ecfdf5" : "#fef2f2",
                      color: s.isActive ? "#065f46" : "#991b1b",
                    }}
                  >
                    {s.isActive ? "ACTIVE" : "ARCHIVED"}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  }}
                >
                  <CleanerAccountSetup staffId={s.id} linked={Boolean(s.dashboardUserId)} currentEmail={s.cleanerAccountEmail ?? null} disabled={!s.isActive} onSaved={() => loadStaff(organizationId)} />
                  <Metric label="Phone" value={s.phoneE164 ?? "-"} />
                  <Metric label="Language / Idioma" value={s.preferredLanguage === "es" ? "Español" : "English"} />
                  <Metric label="Company" value={s.companyName ?? "-"} />
                  <Metric label="NFC card" value={s.ttlockCardRef ? "ASSIGNED" : "-"} />
                  <Metric
                    label="Cleaning properties"
                    value={staffAssignments.filter((p) => Boolean(p.assignment?.role)).length}
                  />
                </div>

                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 12,
                    background: "#f9fafb",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#111827",
                      }}
                    >
                      Cleaning Property Roles
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}
                    >
                      Select where this staff member is primary or backup.
                    </div>
                  </div>

                  {isLoadingAssignments ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>Loading property assignments...</div>
                  ) : staffAssignments.length === 0 ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>No active properties found.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div
                        className="staff-assignment-header"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(180px, 1.6fr) minmax(130px, .8fr) 90px minmax(280px, 1.4fr) 110px",
                          gap: 10,
                          padding: "0 10px",
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: ".04em",
                        }}
                      >
                        <span>Property</span><span>Role</span><span>Priority</span><span>Cleaning timing</span><span />
                      </div>
                      {staffAssignments.map((p, idx) => {
                        const timingKey = `${s.id}:${p.id}`;
                        const timingOpen = Boolean(expandedTiming[timingKey]);
                        const timingSummary = p.assignment?.role
                          ? `${p.assignment.cleaningDurationCommitmentMinutes ?? "Not set"} min · start +${p.assignment.cleaningStartConfirmationGraceMinutes} · follow-up +${p.assignment.cleaningFollowupGraceMinutes}`
                          : "Not assigned";
                        const timingError = cleaningTimingError(p.assignment);
                        return (
                          <div
                            key={p.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              background: "#fff",
                              padding: 10,
                              display: "grid",
                              gap: 10,
                            }}
                          >
                            <div
                              className="staff-assignment-row"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(180px, 1.6fr) minmax(130px, .8fr) 90px minmax(280px, 1.4fr) 110px",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", minWidth: 0 }}>{p.name}</div>
                              <select
                                value={p.assignment?.role || ""}
                                disabled={!s.isActive}
                                onChange={(e) => updatePropertyRole(s.id, idx, e.target.value as "" | "PRIMARY" | "BACKUP")}
                                style={{ height: 36, borderRadius: 9, border: "1px solid #d1d5db", background: "#fff", padding: "0 8px" }}
                              >
                                <option value="">None</option><option value="PRIMARY">Primary</option><option value="BACKUP">Backup</option>
                              </select>
                              <input
                                aria-label={`${p.name} backup priority`}
                                type="number"
                                min={1}
                                disabled={!s.isActive || p.assignment?.role !== "BACKUP"}
                                value={p.assignment?.backupOrder ?? 1}
                                onChange={(e) => updateBackupOrder(s.id, idx, Number(e.target.value))}
                                style={{ height: 36, borderRadius: 9, border: "1px solid #d1d5db", background: p.assignment?.role === "BACKUP" ? "#fff" : "#f3f4f6", padding: "0 8px" }}
                              />
                              <div style={{ fontSize: 12, color: p.assignment?.role ? "#374151" : "#9ca3af" }}>{timingSummary}</div>
                              <button
                                type="button"
                                disabled={!p.assignment?.role}
                                onClick={() => setExpandedTiming((prev) => ({ ...prev, [timingKey]: !prev[timingKey] }))}
                                style={{ height: 36, borderRadius: 9, border: "1px solid #d1d5db", background: "#fff", fontWeight: 700, cursor: p.assignment?.role ? "pointer" : "not-allowed" }}
                              >
                                {timingOpen ? "Close" : "Configure"}
                              </button>
                            </div>
                            {p.assignment?.role && timingOpen ? (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                  gap: 10,
                                  padding: 12,
                                  borderRadius: 10,
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#374151" }}>
                                  Standard cleaning time (minutes)
                                  <input type="number" min={15} max={1440} step={1}
                                    value={p.assignment.cleaningDurationCommitmentMinutes ?? ""}
                                    placeholder="Not configured"
                                    onChange={(e) => updateCleaningTiming(s.id, idx, "cleaningDurationCommitmentMinutes", e.target.value === "" ? null : Number(e.target.value))}
                                    style={{ height: 38, borderRadius: 9, border: "1px solid #d1d5db", padding: "0 10px" }} />
                                </label>
                                <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#374151" }}>
                                  Start reminder after (minutes)
                                  <input type="number" min={5} max={Math.max(5, (p.assignment.cleaningDurationCommitmentMinutes ?? 241) - 1)} step={1}
                                    aria-invalid={Boolean(timingError)}
                                    value={p.assignment.cleaningStartConfirmationGraceMinutes}
                                    onChange={(e) => updateCleaningTiming(s.id, idx, "cleaningStartConfirmationGraceMinutes", Number(e.target.value))}
                                    style={{ height: 38, borderRadius: 9, border: "1px solid #d1d5db", padding: "0 10px" }} />
                                </label>
                                <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#374151" }}>
                                  Follow-up after (minutes)
                                  <input type="number" min={5} max={240} step={1}
                                    value={p.assignment.cleaningFollowupGraceMinutes}
                                    onChange={(e) => updateCleaningTiming(s.id, idx, "cleaningFollowupGraceMinutes", Number(e.target.value))}
                                    style={{ height: 38, borderRadius: 9, border: "1px solid #d1d5db", padding: "0 10px" }} />
                                </label>
                                {timingError ? (
                                  <div role="alert" style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                                    {timingError}
                                  </div>
                                ) : null}
                                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                                  The start reminder must occur before the committed cleaning completion. NFC access is unchanged.
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => savePropertyAssignments(s.id)}
                    disabled={!s.isActive || isSavingAssignments}
                    style={{
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor:
                        !s.isActive || isSavingAssignments
                          ? "not-allowed"
                          : "pointer",
                      opacity: !s.isActive || isSavingAssignments ? 0.7 : 1,
                    }}
                  >
                    {isSavingAssignments ? "Saving roles..." : "Save Cleaning Roles"}
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleEdit(s)}
                    disabled={!s.isActive}
                    style={{
                      minHeight: 38,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: s.isActive ? "pointer" : "not-allowed",
                      opacity: s.isActive ? 1 : 0.6,
                    }}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleArchive(s.id)}
                    disabled={!s.isActive || archivingId === s.id}
                    style={{
                      minHeight: 38,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #fecaca",
                      background: "#fff",
                      color: "#b91c1c",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor:
                        !s.isActive || archivingId === s.id
                          ? "not-allowed"
                          : "pointer",
                      opacity: !s.isActive || archivingId === s.id ? 0.7 : 1,
                    }}
                  >
                    {archivingId === s.id ? "Archiving..." : "Archive"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ color: "#666", fontSize: 13 }}>
        {loading ? "Loading..." : `${items.length} staff members`}
      </div>
    </div>
  );
}
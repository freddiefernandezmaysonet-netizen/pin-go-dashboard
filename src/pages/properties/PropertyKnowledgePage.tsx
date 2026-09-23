import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";

import { fetchProperties } from "../../api/properties";
import {
  PROPERTY_KNOWLEDGE_CATEGORIES,
  createPropertyKnowledge,
  deactivatePropertyKnowledge,
  listPropertyKnowledge,
  updatePropertyKnowledge,
  type PropertyKnowledgeCategory,
  type PropertyKnowledgeDraft,
  type PropertyKnowledgeEntry,
  type PropertyKnowledgeVisibility,
} from "../../api/propertyKnowledge";

const CATEGORY_LABELS: Record<PropertyKnowledgeCategory, string> = {
  PROPERTY: "Property details",
  ARRIVAL: "Arrival",
  ACCESS: "Access instructions",
  WIFI: "Wi-Fi",
  PARKING: "Parking",
  AMENITIES: "Amenities",
  HOUSE_RULES: "House rules",
  APPLIANCE: "Appliances",
  TROUBLESHOOTING: "Troubleshooting",
  EMERGENCY: "Emergency",
  LOCAL_GUIDE: "Local guide",
};

const VISIBILITY_LABELS: Record<PropertyKnowledgeVisibility, string> = {
  PUBLIC: "Public",
  CONFIRMED_GUEST: "Confirmed guests",
  DURING_STAY: "During stay only",
};

const EMPTY_DRAFT: PropertyKnowledgeDraft = {
  category: "PROPERTY",
  key: "",
  titleEn: "",
  titleEs: "",
  contentEn: "",
  contentEs: "",
  visibility: "CONFIRMED_GUEST",
  sortOrder: 0,
};

function draftFromEntry(entry: PropertyKnowledgeEntry): PropertyKnowledgeDraft {
  return {
    category: entry.category,
    key: entry.key,
    titleEn: entry.titleEn ?? "",
    titleEs: entry.titleEs ?? "",
    contentEn: entry.contentEn ?? "",
    contentEs: entry.contentEs ?? "",
    visibility: entry.visibility,
    sortOrder: entry.sortOrder,
  };
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("PROPERTY_KNOWLEDGE_REVISION_CONFLICT")) {
    return "This entry changed in another session. Reload it before saving again.";
  }
  if (message.includes("PROPERTY_KNOWLEDGE_KEY_CONFLICT")) {
    return "That key is already used by another entry for this property.";
  }
  if (message.includes("PROPERTY_KNOWLEDGE_ACCESS_CREDENTIAL_FORBIDDEN")) {
    return "Access codes, PINs and credentials cannot be stored in Property Knowledge.";
  }
  if (message.includes("PROPERTY_KNOWLEDGE_WIFI_PUBLIC_FORBIDDEN")) {
    return "Wi-Fi information cannot be public. Select a guest-only visibility.";
  }
  if (message.includes("PROPERTY_KNOWLEDGE_FIELD_NOT_ALLOWED")) {
    return "The entry contains a field that is not allowed.";
  }
  if (message.includes("PROPERTY_KNOWLEDGE_PROPERTY_NOT_FOUND")) {
    return "This property is unavailable or does not belong to your organization.";
  }

  return "Property Knowledge could not be updated. Please try again.";
}

export function PropertyKnowledgePage() {
  const { id = "" } = useParams();
  const [propertyName, setPropertyName] = useState("Property");
  const [entries, setEntries] = useState<PropertyKnowledgeEntry[]>([]);
  const [draft, setDraft] = useState<PropertyKnowledgeDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<PropertyKnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const [knowledge, properties] = await Promise.all([
          listPropertyKnowledge(id, signal),
          fetchProperties().catch(() => null),
        ]);
        if (signal?.aborted) return;

        setEntries(knowledge.entries);
        setPropertyName(
          properties?.items.find((property) => property.id === id)?.name ??
            "Property"
        );
      } catch (caught) {
        if (!signal?.aborted) setError(errorMessage(caught));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const activeCount = useMemo(
    () => entries.filter((entry) => entry.isActive).length,
    [entries]
  );

  function updateDraft<Key extends keyof PropertyKnowledgeDraft>(
    key: Key,
    value: PropertyKnowledgeDraft[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetEditor() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function beginEdit(entry: PropertyKnowledgeEntry) {
    setEditing(entry);
    setDraft(draftFromEntry(entry));
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || saving) return;

    if (!draft.contentEn.trim() && !draft.contentEs.trim()) {
      setError("Add guest-facing content in English, Spanish, or both.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = editing
        ? await updatePropertyKnowledge(
            id,
            editing.id,
            editing.revision,
            draft
          )
        : await createPropertyKnowledge(id, draft);

      setEntries((current) => {
        const withoutSaved = current.filter(
          (entry) => entry.id !== response.entry.id
        );
        return [...withoutSaved, response.entry].sort(
          (left, right) =>
            left.category.localeCompare(right.category) ||
            left.sortOrder - right.sortOrder ||
            left.key.localeCompare(right.key)
        );
      });
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      setNotice(editing ? "Entry updated." : "Entry created.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(entry: PropertyKnowledgeEntry) {
    if (!id || deactivatingId) return;
    const confirmed = window.confirm(
      `Deactivate “${entry.titleEn || entry.titleEs || entry.key}”? Pin AI will no longer receive this entry.`
    );
    if (!confirmed) return;

    setDeactivatingId(entry.id);
    setError(null);
    setNotice(null);

    try {
      const response = await deactivatePropertyKnowledge(
        id,
        entry.id,
        entry.revision
      );
      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === entry.id
            ? {
                ...candidate,
                isActive: response.isActive,
                revision: response.revision,
              }
            : candidate
        )
      );
      if (editing?.id === entry.id) resetEditor();
      setNotice("Entry deactivated. No data was physically deleted.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <main style={styles.page}>
      <div>
        <Link to={`/properties/${id}`} style={styles.backLink}>
          ← Back to {propertyName}
        </Link>
      </div>

      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PIN AI · PROPERTY KNOWLEDGE</p>
          <h1 style={styles.title}>Teach Pin AI about {propertyName}</h1>
          <p style={styles.subtitle}>
            Document stable, guest-facing facts in English, Spanish, or both.
            Entries remain scoped to this property and your organization.
          </p>
        </div>
        <div style={styles.metric} aria-label={`${activeCount} active entries`}>
          <strong style={styles.metricValue}>{activeCount}</strong>
          <span style={styles.metricLabel}>Active entries</span>
        </div>
      </header>

      <aside style={styles.safetyNotice} aria-label="Security boundary">
        <strong>Keep operational secrets out of this library.</strong>
        <span>
          Never enter door codes, lock PINs, access credentials, payment data,
          or internal instructions. Secure access continues through Pin&Go’s
          Access Engine.
        </span>
      </aside>

      {error ? (
        <div role="alert" style={styles.errorNotice}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" style={styles.successNotice}>
          {notice}
        </div>
      ) : null}

      <section aria-labelledby="knowledge-editor-title" style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 id="knowledge-editor-title" style={styles.sectionTitle}>
              {editing ? "Edit knowledge entry" : "Add knowledge entry"}
            </h2>
            <p style={styles.sectionDescription}>
              Use a stable key such as <code>parking.instructions</code> so the
              information can be revised without creating duplicates.
            </p>
          </div>
          {editing ? (
            <button type="button" onClick={resetEditor} style={styles.secondaryButton}>
              Cancel edit
            </button>
          ) : null}
        </div>

        <form onSubmit={save} style={styles.form}>
          <div style={styles.twoColumnGrid}>
            <label style={styles.label}>
              Category
              <select
                value={draft.category}
                onChange={(event) => {
                  const category = event.target
                    .value as PropertyKnowledgeCategory;
                  setDraft((current) => ({
                    ...current,
                    category,
                    visibility:
                      category === "WIFI" && current.visibility === "PUBLIC"
                        ? "CONFIRMED_GUEST"
                        : current.visibility,
                  }));
                }}
                style={styles.input}
              >
                {PROPERTY_KNOWLEDGE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Stable key
              <input
                required
                maxLength={80}
                pattern="[a-z0-9]+([._-][a-z0-9]+)*"
                placeholder="parking.instructions"
                value={draft.key}
                onChange={(event) =>
                  updateDraft("key", event.target.value.toLowerCase())
                }
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Visibility
              <select
                value={draft.visibility}
                onChange={(event) =>
                  updateDraft(
                    "visibility",
                    event.target.value as PropertyKnowledgeVisibility
                  )
                }
                style={styles.input}
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={value === "PUBLIC" && draft.category === "WIFI"}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Display order
              <input
                type="number"
                min={0}
                max={10_000}
                step={1}
                value={draft.sortOrder}
                onChange={(event) =>
                  updateDraft("sortOrder", Number(event.target.value))
                }
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.twoColumnGrid}>
            <fieldset style={styles.languagePanel}>
              <legend style={styles.legend}>English</legend>
              <label style={styles.label}>
                Title
                <input
                  maxLength={160}
                  value={draft.titleEn}
                  onChange={(event) => updateDraft("titleEn", event.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Guest-facing content
                <textarea
                  rows={6}
                  maxLength={4_000}
                  value={draft.contentEn}
                  onChange={(event) =>
                    updateDraft("contentEn", event.target.value)
                  }
                  style={styles.textarea}
                />
              </label>
            </fieldset>

            <fieldset style={styles.languagePanel}>
              <legend style={styles.legend}>Español</legend>
              <label style={styles.label}>
                Título
                <input
                  maxLength={160}
                  value={draft.titleEs}
                  onChange={(event) => updateDraft("titleEs", event.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Contenido para el huésped
                <textarea
                  rows={6}
                  maxLength={4_000}
                  value={draft.contentEs}
                  onChange={(event) =>
                    updateDraft("contentEs", event.target.value)
                  }
                  style={styles.textarea}
                />
              </label>
            </fieldset>
          </div>

          <div style={styles.formFooter}>
            <span style={styles.formHint}>
              At least one language must include guest-facing content.
            </span>
            <button type="submit" disabled={saving} style={styles.primaryButton}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add entry"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="knowledge-library-title" style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 id="knowledge-library-title" style={styles.sectionTitle}>
              Knowledge library
            </h2>
            <p style={styles.sectionDescription}>
              Inactive entries remain visible for audit purposes but are not
              available to Pin AI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={styles.secondaryButton}
          >
            {loading ? "Loading…" : "Reload"}
          </button>
        </div>

        {loading ? (
          <div role="status" style={styles.emptyState}>
            Loading Property Knowledge…
          </div>
        ) : entries.length === 0 ? (
          <div style={styles.emptyState}>
            No entries yet. Add the first stable fact Pin AI should know about
            this property.
          </div>
        ) : (
          <div style={styles.entryGrid}>
            {entries.map((entry) => (
              <article
                key={entry.id}
                style={{
                  ...styles.entryCard,
                  ...(entry.isActive ? {} : styles.inactiveEntry),
                }}
              >
                <div style={styles.entryHeader}>
                  <div style={styles.badgeRow}>
                    <span style={styles.categoryBadge}>
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <span style={styles.visibilityBadge}>
                      {VISIBILITY_LABELS[entry.visibility]}
                    </span>
                    {!entry.isActive ? (
                      <span style={styles.inactiveBadge}>Inactive</span>
                    ) : null}
                  </div>
                  <span style={styles.revision}>Revision {entry.revision}</span>
                </div>

                <div>
                  <h3 style={styles.entryTitle}>
                    {entry.titleEn || entry.titleEs || entry.key}
                  </h3>
                  <code style={styles.entryKey}>{entry.key}</code>
                </div>

                <div style={styles.contentGrid}>
                  <div>
                    <strong style={styles.languageLabel}>EN</strong>
                    <p style={styles.entryContent}>
                      {entry.contentEn || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <strong style={styles.languageLabel}>ES</strong>
                    <p style={styles.entryContent}>
                      {entry.contentEs || "No provisto"}
                    </p>
                  </div>
                </div>

                <footer style={styles.entryFooter}>
                  <span>Order {entry.sortOrder}</span>
                  <div style={styles.actionRow}>
                    <button
                      type="button"
                      onClick={() => beginEdit(entry)}
                      disabled={!entry.isActive}
                      style={styles.secondaryButton}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deactivate(entry)}
                      disabled={!entry.isActive || deactivatingId === entry.id}
                      style={styles.dangerButton}
                    >
                      {deactivatingId === entry.id ? "Deactivating…" : "Deactivate"}
                    </button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: "grid", gap: 20, maxWidth: 1180, margin: "0 auto" },
  backLink: { color: "#2563eb", textDecoration: "none", fontWeight: 650 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },
  title: { margin: 0, color: "#111827", fontSize: 30, lineHeight: 1.2 },
  subtitle: { margin: "10px 0 0", color: "#6b7280", lineHeight: 1.65, maxWidth: 720 },
  metric: {
    minWidth: 130,
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "14px 18px",
    background: "#eff6ff",
    display: "grid",
    gap: 2,
  },
  metricValue: { color: "#1d4ed8", fontSize: 28 },
  metricLabel: { color: "#1e40af", fontSize: 13, fontWeight: 650 },
  safetyNotice: {
    display: "grid",
    gap: 5,
    padding: 16,
    border: "1px solid #fde68a",
    borderRadius: 14,
    background: "#fffbeb",
    color: "#78350f",
    lineHeight: 1.55,
  },
  errorNotice: {
    padding: 14,
    border: "1px solid #fecaca",
    borderRadius: 12,
    background: "#fef2f2",
    color: "#991b1b",
  },
  successNotice: {
    padding: 14,
    border: "1px solid #a7f3d0",
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#065f46",
  },
  card: {
    display: "grid",
    gap: 18,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 20,
    background: "#ffffff",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  sectionTitle: { margin: 0, color: "#111827", fontSize: 20 },
  sectionDescription: { margin: "7px 0 0", color: "#6b7280", lineHeight: 1.55 },
  form: { display: "grid", gap: 18 },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 16,
  },
  label: { display: "grid", gap: 7, color: "#374151", fontSize: 14, fontWeight: 650 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fff",
    color: "#111827",
    font: "inherit",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fff",
    color: "#111827",
    font: "inherit",
    lineHeight: 1.55,
  },
  languagePanel: {
    display: "grid",
    gap: 14,
    minWidth: 0,
    margin: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
  },
  legend: { padding: "0 6px", color: "#111827", fontWeight: 750 },
  formFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  formHint: { color: "#6b7280", fontSize: 13 },
  primaryButton: {
    border: 0,
    borderRadius: 11,
    padding: "11px 16px",
    background: "var(--brand-primary-color, #2563eb)",
    color: "var(--brand-on-primary-color, #ffffff)",
    fontWeight: 750,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "9px 13px",
    background: "#ffffff",
    color: "#374151",
    fontWeight: 650,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "9px 13px",
    background: "#fff",
    color: "#b91c1c",
    fontWeight: 650,
    cursor: "pointer",
  },
  emptyState: {
    border: "1px dashed #d1d5db",
    borderRadius: 14,
    padding: 28,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 1.6,
  },
  entryGrid: { display: "grid", gap: 14 },
  entryCard: {
    contentVisibility: "auto",
    containIntrinsicSize: "0 260px",
    display: "grid",
    gap: 15,
    border: "1px solid #e5e7eb",
    borderRadius: 15,
    padding: 16,
    background: "#fff",
  },
  inactiveEntry: { background: "#f9fafb", opacity: 0.72 },
  entryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  badgeRow: { display: "flex", gap: 7, flexWrap: "wrap" },
  categoryBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
    fontSize: 12,
    fontWeight: 700,
  },
  visibilityBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#047857",
    fontSize: 12,
    fontWeight: 700,
  },
  inactiveBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#4b5563",
    fontSize: 12,
    fontWeight: 700,
  },
  revision: { color: "#6b7280", fontSize: 12 },
  entryTitle: { margin: "0 0 5px", color: "#111827", fontSize: 18 },
  entryKey: { color: "#4b5563", fontSize: 12 },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 16,
  },
  languageLabel: { color: "#2563eb", fontSize: 11, letterSpacing: "0.08em" },
  entryContent: { margin: "6px 0 0", color: "#4b5563", lineHeight: 1.6, whiteSpace: "pre-wrap" },
  entryFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    borderTop: "1px solid #f3f4f6",
    paddingTop: 13,
    color: "#6b7280",
    fontSize: 13,
  },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
};

export default PropertyKnowledgePage;

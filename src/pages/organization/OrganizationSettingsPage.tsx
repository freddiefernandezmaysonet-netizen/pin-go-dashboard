import { useEffect, useMemo, useState } from "react";
import {
  getDashboardOrganization,
  updateDashboardOrganization,
  type DashboardOrganization,
} from "../../api/organization";
import { useAuth } from "../../auth/AuthProvider";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OrganizationSettingsPage() {
  const { refresh } = useAuth();

  const [organization, setOrganization] =
    useState<DashboardOrganization | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug]);

  const publicBaseUrl =
    import.meta.env.VITE_PUBLIC_SITE_URL ?? window.location.origin;

  const directBookingUrl = normalizedSlug
    ? `${publicBaseUrl}/book/${normalizedSlug}`
    : "";
  
   useEffect(() => {
    let mounted = true;

    async function loadOrganization() {
      try {
        setLoading(true);
        setError(null);

        const item = await getDashboardOrganization();

        if (!mounted) return;

        setOrganization(item);
        setName(item.name ?? "");
        setSlug(item.slug ?? "");
        setPublicBookingEnabled(Boolean(item.publicBookingEnabled));
      } catch (e) {
        console.error("[OrganizationSettingsPage] load failed", e);

        if (!mounted) return;

        setError("Unable to load organization settings.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOrganization();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const cleanName = name.trim();
      const cleanSlug = normalizeSlug(slug);

      if (!cleanName) {
        setError("Organization name is required.");
        return;
      }

      if (!cleanSlug) {
        setError("Organization slug is required.");
        return;
      }

      if (cleanSlug.length < 3) {
        setError("Organization slug must be at least 3 characters.");
        return;
      }

      if (cleanSlug.length > 60) {
        setError("Organization slug must be 60 characters or less.");
        return;
      }

      const updated = await updateDashboardOrganization({
        name: cleanName,
        slug: cleanSlug,
        publicBookingEnabled,
      });

      setOrganization(updated);
      setName(updated.name ?? "");
      setSlug(updated.slug ?? "");
      setPublicBookingEnabled(Boolean(updated.publicBookingEnabled));

      await refresh();

      setSuccess("Organization settings saved.");
    } catch (e) {
      console.error("[OrganizationSettingsPage] save failed", e);

      const message = e instanceof Error ? e.message : "";

      if (message === "ORGANIZATION_SLUG_TAKEN") {
        setError("That organization slug is already taken.");
        return;
      }

      setError("Unable to save organization settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.muted}>Loading organization settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Direct Booking</p>
          <h1 style={styles.title}>Organization Settings</h1>
          <p style={styles.subtitle}>
            Manage the public organization slug used by your Direct Booking
            URLs.
          </p>
        </div>
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Public Organization</h2>
          <p style={styles.sectionText}>
            This controls the main booking URL for your organization catalog.
          </p>

          <label style={styles.label}>
            Organization Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={styles.input}
              placeholder="Pin&Go Demo Host"
            />
          </label>

          <label style={styles.label}>
            Organization Slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              onBlur={() => setSlug(normalizedSlug)}
              style={styles.input}
              placeholder="my-company"
            />
          </label>

          <div style={styles.helpBox}>
            <div style={styles.helpLabel}>Direct Booking URL</div>
            <div style={styles.urlText}>
              {directBookingUrl || "Set a slug to generate your public URL"}
            </div>
          </div>

          <label style={styles.toggleRow}>
            <input
              type="checkbox"
              checked={publicBookingEnabled}
              onChange={(event) =>
                setPublicBookingEnabled(event.target.checked)
              }
            />
            <span>
              Enable public Direct Booking catalog for this organization
            </span>
          </label>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              ...styles.button,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Organization Settings"}
          </button>
        </section>

        <aside style={styles.card}>
          <h2 style={styles.sectionTitle}>URL Compatibility</h2>

          <div style={styles.note}>
            <strong>Catalog URL</strong>
            <span>/book/{normalizedSlug || "organization-slug"}</span>
          </div>

          <div style={styles.note}>
            <strong>Property URLs</strong>
            <span>
              /book/{normalizedSlug || "organization-slug"}/property-slug
            </span>
          </div>

          <div style={styles.note}>
            <strong>Custom Domains</strong>
            <span>
              Future custom domains can point to the same organization without
              changing this slug system.
            </span>
          </div>

          {organization?.updatedAt && (
            <p style={styles.updated}>
              Last updated:{" "}
              {new Date(organization.updatedAt).toLocaleString()}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    maxWidth: 1180,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },
  kicker: {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "6px 0 0",
    fontSize: 32,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    maxWidth: 680,
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.8fr)",
    gap: 20,
    alignItems: "start",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "8px 0 20px",
    color: "#64748b",
    lineHeight: 1.6,
  },
  label: {
    display: "grid",
    gap: 8,
    marginTop: 16,
    color: "#334155",
    fontSize: 14,
    fontWeight: 800,
  },
  input: {
    height: 44,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    fontSize: 15,
    outline: "none",
  },
  helpBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  helpLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    color: "#64748b",
    marginBottom: 6,
  },
  urlText: {
    color: "#0f172a",
    fontWeight: 800,
    wordBreak: "break-all",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    color: "#334155",
    fontWeight: 700,
  },
  button: {
    marginTop: 20,
    height: 46,
    border: 0,
    borderRadius: 999,
    padding: "0 20px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
  },
  error: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 700,
  },
  success: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 700,
  },
  muted: {
    color: "#64748b",
    margin: 0,
  },
  note: {
    display: "grid",
    gap: 6,
    padding: "14px 0",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  updated: {
    margin: "18px 0 0",
    color: "#94a3b8",
    fontSize: 13,
  },
};
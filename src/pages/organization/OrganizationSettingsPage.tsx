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
        if (mounted) setLoading(false);
      }
    }

    loadOrganization();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>
          Organization Settings
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Manage your organization identity and Direct Booking catalog URL.
        </div>
      </div>

      {error ? (
        <div style={errorStyle}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {success ? <div style={successStyle}>{success}</div> : null}

      {loading ? (
        <div style={{ color: "#666" }}>Loading organization settings...</div>
      ) : (
        <form onSubmit={handleSave} style={{ display: "grid", gap: 18 }}>
          <div style={statsGridStyle}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Organization</div>
              <div style={statValueStyle}>{name || "—"}</div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Catalog</div>
              <div style={statValueStyle}>
                {publicBookingEnabled ? "Active" : "Disabled"}
              </div>
            </div>

            <div style={statCardStyle}>
              <div style={statLabelStyle}>Slug</div>
              <div style={statValueStyle}>{normalizedSlug || "—"}</div>
            </div>
          </div>

          <section style={cardStyle}>
            <div>
              <div style={sectionTitleStyle}>Organization Identity</div>
              <div style={sectionDescriptionStyle}>
                This information controls your public Direct Booking catalog
                identity.
              </div>
            </div>

            <div style={responsiveGridStyle}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Organization Name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pin&Go Demo Host"
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Organization Slug</div>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onBlur={() => setSlug(normalizedSlug)}
                  placeholder="my-company"
                  style={inputStyle}
                  required
                />
                <div style={helperTextStyle}>
                  Used for your organization catalog URL.
                </div>
              </div>
            </div>

            <div style={previewBoxStyle}>
              <div style={labelStyle}>Direct Booking URL</div>
              <div style={urlPreviewStyle}>
                {directBookingUrl || "Set a slug to generate your public URL"}
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={sectionTitleStyle}>Direct Booking Catalog</div>
                <div style={sectionDescriptionStyle}>
                  Control whether guests can browse your organization catalog
                  and book public properties.
                </div>
              </div>

              <div
                style={{
                  ...statusBadgeStyle,
                  background: publicBookingEnabled ? "#f0fdf4" : "#f9fafb",
                  borderColor: publicBookingEnabled ? "#bbf7d0" : "#e5e7eb",
                  color: publicBookingEnabled ? "#166534" : "#6b7280",
                }}
              >
                {publicBookingEnabled ? "Active" : "Disabled"}
              </div>
            </div>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                checked={publicBookingEnabled}
                onChange={(e) => setPublicBookingEnabled(e.target.checked)}
              />

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                  Enable public Direct Booking catalog
                </div>
                <div style={helperTextStyle}>
                  When enabled, guests can access your organization booking page
                  using the public catalog URL.
                </div>
              </div>
            </label>
          </section>

          <section style={cardStyle}>
            <div>
              <div style={sectionTitleStyle}>URL Structure</div>
              <div style={sectionDescriptionStyle}>
                These routes remain compatible with property slugs and future
                custom domains.
              </div>
            </div>

            <div style={compatibilityGridStyle}>
              <div style={compatibilityCardStyle}>
                <div style={labelStyle}>Catalog URL</div>
                <div style={compatibilityTextStyle}>
                  /book/{normalizedSlug || "organization-slug"}
                </div>
              </div>

              <div style={compatibilityCardStyle}>
                <div style={labelStyle}>Property URLs</div>
                <div style={compatibilityTextStyle}>
                  /book/{normalizedSlug || "organization-slug"}/property-slug
                </div>
              </div>

              <div style={compatibilityCardStyle}>
                <div style={labelStyle}>Custom Domains</div>
                <div style={compatibilityTextStyle}>
                  Future custom domains can point to the same organization
                  without changing this slug system.
                </div>
              </div>
            </div>

            {organization?.updatedAt ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Last updated: {new Date(organization.updatedAt).toLocaleString()}
              </div>
            ) : null}
          </section>

          <div style={actionBarStyle}>
            <button
              type="submit"
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  display: "grid",
  gap: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const sectionDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  marginTop: 4,
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  height: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
};

const responsiveGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const statCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const statValueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
  wordBreak: "break-word",
};

const previewBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
};

const urlPreviewStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  wordBreak: "break-all",
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  cursor: "pointer",
};

const statusBadgeStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const compatibilityGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const compatibilityCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const compatibilityTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const actionBarStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: 16,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  padding: 12,
  borderRadius: 12,
  color: "#991b1b",
};

const successStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  padding: 12,
  borderRadius: 12,
  color: "#166534",
  fontWeight: 700,
};
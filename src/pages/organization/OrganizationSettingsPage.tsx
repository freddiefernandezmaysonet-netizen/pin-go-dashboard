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
        <form onSubmit={handleSave} style={cardStyle}>
          <div
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 18,
              padding: 22,
              background: "#eff6ff",
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                Public Organization
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                This controls the main public Direct Booking catalog URL for
                your organization.
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
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Used for your organization catalog URL.
                </div>
              </div>
            </div>

            <div style={previewBoxStyle}>
              <div style={labelStyle}>Direct Booking URL</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#111827",
                  wordBreak: "break-all",
                }}
              >
                {directBookingUrl || "Set a slug to generate your public URL"}
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              <input
                type="checkbox"
                checked={publicBookingEnabled}
                onChange={(e) => setPublicBookingEnabled(e.target.checked)}
              />
              Enable public Direct Booking catalog for this organization
            </label>
          </div>

          <div
            style={{
              borderTop: "1px solid #bfdbfe",
              paddingTop: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                URL Compatibility
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                These URLs remain compatible with property slugs and future
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
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 4,
            }}
          >
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
  padding: 24,
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  display: "grid",
  gap: 18,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#374151",
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

const previewBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#ffffff",
};

const compatibilityGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const compatibilityCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#ffffff",
  border: "1px solid #dbeafe",
};

const compatibilityTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 46,
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
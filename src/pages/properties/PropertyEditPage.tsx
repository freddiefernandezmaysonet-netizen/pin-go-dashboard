import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type PropertyItem = {
  id: string;
  name: string;
  address1?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  timezone?: string | null;
  status: string;
  cleaningDurationMinutes: number;
  cleaningStartOffsetMinutes: number;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
  isPublicBookable?: boolean;
  publicTitle?: string | null;
  publicDescription?: string | null;

  baseNightlyRate?: number | null;
  cleaningFee?: number | null;

  maxGuests?: number | null;
  minimumNights?: number | null;
  maximumNights?: number | null;

  checkInTime?: string | null;
  checkOutTime?: string | null;
};

export function PropertyEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    address1: "",
    city: "",
    region: "",
    country: "",
    timezone: "",
    cleaningDurationMinutes: 180,
    cleaningStartOffsetMinutes: 30,
    latitude: "",
    longitude: "",
    baseNightlyRate: "",
    cleaningFee: "",

    maxGuests: "",
    minimumNights: "1",
    maximumNights: "",

    isPublicBookable: false,
});

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    fetch(`${API_BASE}/api/dashboard/properties/${id}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${t || res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        const p: PropertyItem = data.item;

        setForm({
          name: p.name ?? "",
          address1: p.address1 ?? "",
          city: p.city ?? "",
          region: p.region ?? "",
          country: p.country ?? "",
          timezone: p.timezone ?? "",
          cleaningDurationMinutes: p.cleaningDurationMinutes ?? 180,
          cleaningStartOffsetMinutes: p.cleaningStartOffsetMinutes ?? 30,
          latitude:
            p.latitude !== null && p.latitude !== undefined
              ? String(p.latitude)
              : "",
          longitude:
            p.longitude !== null && p.longitude !== undefined
              ? String(p.longitude)
              : "",
        baseNightlyRate:
  p.baseNightlyRate !== null &&
  p.baseNightlyRate !== undefined
    ? String(p.baseNightlyRate)
    : "",

cleaningFee:
  p.cleaningFee !== null &&
  p.cleaningFee !== undefined
    ? String(p.cleaningFee)
    : "",

maxGuests:
  p.maxGuests !== null &&
  p.maxGuests !== undefined
    ? String(p.maxGuests)
    : "",

minimumNights: String(p.minimumNights ?? 1),

maximumNights:
  p.maximumNights !== null &&
  p.maximumNights !== undefined
    ? String(p.maximumNights)
    : "",

isPublicBookable: Boolean(p.isPublicBookable),
        });
      })
      .catch((e: any) => {
        setErr(String(e?.message ?? e));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setErr(null);

    try {
      const latitude =
        form.latitude.trim() === "" ? null : Number(form.latitude);
      const longitude =
        form.longitude.trim() === "" ? null : Number(form.longitude);

      if ((latitude === null) !== (longitude === null)) {
        throw new Error("Latitude and longitude must be provided together");
      }

      if (latitude !== null && !Number.isFinite(latitude)) {
        throw new Error("Latitude must be a valid number");
      }

      if (longitude !== null && !Number.isFinite(longitude)) {
        throw new Error("Longitude must be a valid number");
      }

      const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          address1: form.address1,
          city: form.city,
          region: form.region,
          country: form.country,
          timezone: form.timezone,
          cleaningDurationMinutes: Number(form.cleaningDurationMinutes),
          cleaningStartOffsetMinutes: Number(form.cleaningStartOffsetMinutes),
          latitude,
          longitude,
        baseNightlyRate:
  form.baseNightlyRate.trim() === ""
    ? null
    : Number(form.baseNightlyRate),

cleaningFee:
  form.cleaningFee.trim() === ""
    ? null
    : Number(form.cleaningFee),

maxGuests:
  form.maxGuests.trim() === ""
    ? null
    : Number(form.maxGuests),

minimumNights: Number(form.minimumNights || 1),

maximumNights:
  form.maximumNights.trim() === ""
    ? null
    : Number(form.maximumNights),

isPublicBookable: form.isPublicBookable,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      navigate("/properties");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const derivedCheckInTime =
    Number(form.cleaningDurationMinutes) === 240 ? "4:00 PM" : "3:00 PM";

  return (
    <div style={{ display: "grid", gap: 20 }}>
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
            Edit Property
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Update the operational settings and location details for this property.
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/properties")}
          style={{
            height: 44,
            padding: "0 16px",
            borderRadius: 12,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#111827",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back
        </button>
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

      {loading ? (
        <div style={{ color: "#666" }}>Loading property...</div>
      ) : (
        <form
          onSubmit={handleSave}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 20,
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>Property Name</div>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((s) => ({ ...s, name: e.target.value }))
              }
              placeholder="Property name"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>Address</div>
            <input
              value={form.address1}
              onChange={(e) =>
                setForm((s) => ({ ...s, address1: e.target.value }))
              }
              placeholder="Address"
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>City</div>
              <input
                value={form.city}
                onChange={(e) =>
                  setForm((s) => ({ ...s, city: e.target.value }))
                }
                placeholder="City"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Region</div>
              <input
                value={form.region}
                onChange={(e) =>
                  setForm((s) => ({ ...s, region: e.target.value }))
                }
                placeholder="Region"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Country</div>
              <input
                value={form.country}
                onChange={(e) =>
                  setForm((s) => ({ ...s, country: e.target.value }))
                }
                placeholder="Country"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Timezone</div>
              <input
                value={form.timezone}
                onChange={(e) =>
                  setForm((s) => ({ ...s, timezone: e.target.value }))
                }
                placeholder="Timezone"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Latitude</div>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) =>
                  setForm((s) => ({ ...s, latitude: e.target.value }))
                }
                placeholder="18.4655"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Longitude</div>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) =>
                  setForm((s) => ({ ...s, longitude: e.target.value }))
                }
                placeholder="-66.1057"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Cleaning Duration (minutes)</div>
              <input
                type="number"
                value={form.cleaningDurationMinutes}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    cleaningDurationMinutes: Number(e.target.value || 0),
                  }))
                }
                placeholder="180"
                style={inputStyle}
              />
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Derived check-in time:{" "}
                <b style={{ color: "#111827" }}>{derivedCheckInTime}</b>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Cleaning Start Offset (minutes)</div>
              <input
                type="number"
                value={form.cleaningStartOffsetMinutes}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    cleaningStartOffsetMinutes: Number(e.target.value || 0),
                  }))
                }
                placeholder="30"
                style={inputStyle}
              />
            </div>
          </div>
<div
  style={{
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 18,
    background: "#eff6ff",
    display: "grid",
    gap: 16,
  }}
>
  <div>
    <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
      Direct Booking Settings
    </div>
    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
      Configure how this property appears and prices reservations on your public booking page.
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
      checked={form.isPublicBookable}
      onChange={(e) =>
        setForm((s) => ({ ...s, isPublicBookable: e.target.checked }))
      }
    />
    Public Booking Enabled
  </label>

  <div
    style={{
      display: "grid",
      gap: 16,
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    }}
  >
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Nightly Rate</div>
      <input
        type="number"
        min="0"
        step="0.01"
        value={form.baseNightlyRate}
        onChange={(e) =>
          setForm((s) => ({ ...s, baseNightlyRate: e.target.value }))
        }
        placeholder="150.00"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Cleaning Fee</div>
      <input
        type="number"
        min="0"
        step="0.01"
        value={form.cleaningFee}
        onChange={(e) =>
          setForm((s) => ({ ...s, cleaningFee: e.target.value }))
        }
        placeholder="75.00"
        style={inputStyle}
      />
    </div>
  </div>

  <div
    style={{
      display: "grid",
      gap: 16,
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    }}
  >
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Max Guests</div>
      <input
        type="number"
        min="1"
        value={form.maxGuests}
        onChange={(e) =>
          setForm((s) => ({ ...s, maxGuests: e.target.value }))
        }
        placeholder="4"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Minimum Nights</div>
      <input
        type="number"
        min="1"
        value={form.minimumNights}
        onChange={(e) =>
          setForm((s) => ({ ...s, minimumNights: e.target.value }))
        }
        placeholder="1"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Maximum Nights</div>
      <input
        type="number"
        min="1"
        value={form.maximumNights}
        onChange={(e) =>
          setForm((s) => ({ ...s, maximumNights: e.target.value }))
        }
        placeholder="Optional"
        style={inputStyle}
      />
    </div>
  </div>
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
              type="button"
              onClick={() => navigate("/properties")}
              style={{
                height: 44,
                padding: "0 16px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#111827",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                height: 44,
                padding: "0 16px",
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
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
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
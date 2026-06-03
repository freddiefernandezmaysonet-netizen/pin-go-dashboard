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

   amenities?: Array<{
    id: string;
    name: string;
    description?: string | null;
    chargeMode: "INCLUDED" | "REQUIRED" | "OPTIONAL";
    feeType: "PER_STAY" | "PER_NIGHT";
    amount: string | number;
    isActive: boolean;
  }>;  
  
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

  const [amenities, setAmenities] = useState<any[]>([]);  
  
  const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);
  const [editingAmenity, setEditingAmenity] = useState<any>(null);

  const [newAmenity, setNewAmenity] = useState({
  name: "",
  feeType: "PER_STAY",
  amount: "",
});
  
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

setAmenities(
  (p.amenities ?? []).filter((a) => a.isActive !== false)
);

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

async function handleCreateAmenity() {
  if (!id) return;

  const res = await fetch(
    `${API_BASE}/api/dashboard/properties/${id}/amenities`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newAmenity.name,
        description: newAmenity.description,
        chargeMode: newAmenity.chargeMode,
        feeType: newAmenity.feeType,
        amount: Number(newAmenity.amount || 0),
      }),
    }
  );

async function handleDeleteAmenity(amenityId: string) {
  if (!id) return;

  if (!window.confirm("Delete this amenity?")) {
    return;
  }

  const res = await fetch(
    `${API_BASE}/api/dashboard/properties/${id}/amenities/${amenityId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to delete amenity");
  }

  setAmenities((prev) => prev.filter((a) => a.id !== amenityId));
}

async function handleSaveAmenity() {
  if (!id || !editingAmenityId || !editingAmenity) return;

  const res = await fetch(
    `${API_BASE}/api/dashboard/properties/${id}/amenities/${editingAmenityId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: editingAmenity.name,
        description: editingAmenity.description,
        chargeMode: editingAmenity.chargeMode,
        feeType: editingAmenity.feeType,
        amount: Number(editingAmenity.amount || 0),
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to update amenity");
  }

  setAmenities((prev) =>
    prev.map((a) => (a.id === editingAmenityId ? data.item : a))
  );

  setEditingAmenityId(null);
  setEditingAmenity(null);
}

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to create amenity");
  }

  setAmenities((prev) => [...prev, data.item]);
  setNewAmenity({
    name: "",
    description: "",
    chargeMode: "INCLUDED",
    feeType: "PER_STAY",
    amount: "",
  });
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
    borderTop: "1px solid #bfdbfe",
    paddingTop: 16,
    display: "grid",
    gap: 12,
  }}
>
  <div>
    <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
      Amenities & Fees
    </div>
    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
      Add optional property fees such as pet fees, parking, or resort fees.
    </div>
  </div>

  {amenities.length === 0 ? (
    <div style={{ fontSize: 13, color: "#6b7280" }}>
      No amenities or fees configured yet.
    </div>
  ) : (
    <div style={{ display: "grid", gap: 8 }}>
     {amenities.map((amenity) => (
  <div
    key={amenity.id}
    style={{
      padding: 12,
      borderRadius: 12,
      background: "#ffffff",
      border: "1px solid #dbeafe",
    }}
  >
    {editingAmenityId === amenity.id ? (
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        <input
          value={editingAmenity?.name ?? ""}
          onChange={(e) =>
            setEditingAmenity((s: any) => ({
              ...s,
              name: e.target.value,
            }))
          }
          placeholder="Amenity name"
          style={inputStyle}
        />

        <input
          value={editingAmenity?.description ?? ""}
          onChange={(e) =>
            setEditingAmenity((s: any) => ({
              ...s,
              description: e.target.value,
            }))
          }
          placeholder="Description"
          style={inputStyle}
        />

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
          }}
        >
          <select
            value={editingAmenity?.chargeMode ?? "INCLUDED"}
            onChange={(e) =>
              setEditingAmenity((s: any) => ({
                ...s,
                chargeMode: e.target.value,
              }))
            }
            style={inputStyle}
          >
            <option value="INCLUDED">Included</option>
            <option value="REQUIRED">Required</option>
            <option value="OPTIONAL">Optional</option>
          </select>

          <select
            value={editingAmenity?.feeType ?? "PER_STAY"}
            onChange={(e) =>
              setEditingAmenity((s: any) => ({
                ...s,
                feeType: e.target.value,
              }))
            }
            style={inputStyle}
          >
            <option value="PER_STAY">Per stay</option>
            <option value="PER_NIGHT">Per night</option>
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            value={editingAmenity?.amount ?? ""}
            onChange={(e) =>
              setEditingAmenity((s: any) => ({
                ...s,
                amount: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={async () => {
              try {
                await handleSaveAmenity();
              } catch (e: any) {
                setErr(String(e?.message ?? e));
              }
            }}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Save
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingAmenityId(null);
              setEditingAmenity(null);
            }}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {amenity.name}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 2,
            }}
          >
            {amenity.chargeMode === "INCLUDED"
              ? "Included"
              : amenity.chargeMode === "REQUIRED"
              ? "Required"
              : "Optional"}{" "}
            •{" "}
            {amenity.feeType === "PER_NIGHT"
              ? "Per night"
              : "Per stay"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            ${Number(amenity.amount ?? 0).toFixed(2)}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingAmenityId(amenity.id);
              setEditingAmenity({ ...amenity });
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            ✏️
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await handleDeleteAmenity(amenity.id);
              } catch (e: any) {
                setErr(String(e?.message ?? e));
              }
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    )}
  </div>
))}
    </div>
  )}

  <div
    style={{
      display: "grid",
      gap: 12,
      gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr) 160px 160px 140px auto",
      alignItems: "end",
    }}
  >
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Amenity / Fee Name</div>
      <input
        value={newAmenity.name}
        onChange={(e) =>
          setNewAmenity((s) => ({ ...s, name: e.target.value }))
        }
        placeholder="Pet Fee"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Description</div>
      <input
        value={newAmenity.description}
        onChange={(e) =>
          setNewAmenity((s) => ({ ...s, description: e.target.value }))
        }
        placeholder="Shown to guests"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Charge Mode</div>
      <select
        value={newAmenity.chargeMode}
        onChange={(e) =>
          setNewAmenity((s) => ({ ...s, chargeMode: e.target.value }))
        }
        style={inputStyle}
      >
        <option value="INCLUDED">Included</option>
        <option value="REQUIRED">Required</option>
        <option value="OPTIONAL">Optional</option>
      </select>
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Type</div>
      <select
        value={newAmenity.feeType}
        onChange={(e) =>
          setNewAmenity((s) => ({ ...s, feeType: e.target.value }))
        }
        style={inputStyle}
      >
        <option value="PER_STAY">Per stay</option>
        <option value="PER_NIGHT">Per night</option>
      </select>
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Amount</div>
      <input
        type="number"
        min="0"
        step="0.01"
        value={newAmenity.amount}
        onChange={(e) =>
          setNewAmenity((s) => ({ ...s, amount: e.target.value }))
        }
        placeholder="75.00"
        style={inputStyle}
      />
    </div>

    <button
      type="button"
      onClick={async () => {
        try {
          await handleCreateAmenity();
        } catch (e: any) {
          setErr(String(e?.message ?? e));
        }
      }}
      style={{
        height: 44,
        padding: "0 16px",
        borderRadius: 12,
        border: "none",
        background: "#2563eb",
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      Add
    </button>
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
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type AmenityChargeMode = "INCLUDED" | "REQUIRED" | "OPTIONAL";
type AmenityFeeType = "PER_STAY" | "PER_NIGHT";

type PropertyAmenityItem = {
  id: string;
  name: string;
  description?: string | null;
  chargeMode: AmenityChargeMode;
  feeType: AmenityFeeType;
  amount: string | number;
  isActive: boolean;
};

type PropertyTaxItem = {
  id: string;
  name: string;
  percentage: string | number;
  isActive: boolean;
};

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
  publicPhotos?: string[] | null;
  amenities?: PropertyAmenityItem[];
  taxes?: PropertyTaxItem[];
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

  const [amenities, setAmenities] = useState<PropertyAmenityItem[]>([]);
  const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);
  const [editingAmenity, setEditingAmenity] =
    useState<PropertyAmenityItem | null>(null);

  const [newAmenity, setNewAmenity] = useState({
    name: "",
    description: "",
    chargeMode: "INCLUDED" as AmenityChargeMode,
    feeType: "PER_STAY" as AmenityFeeType,
    amount: "",
  });

  const [taxes, setTaxes] = useState<PropertyTaxItem[]>([]);
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [editingTax, setEditingTax] = useState<PropertyTaxItem | null>(null);

  const [newTax, setNewTax] = useState({
    name: "",
    percentage: "",
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
    publicTitle: "",
    publicDescription: "",
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

        setAmenities((p.amenities ?? []).filter((a) => a.isActive !== false));
        setTaxes((p.taxes ?? []).filter((t) => t.isActive !== false));

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
            p.baseNightlyRate !== null && p.baseNightlyRate !== undefined
              ? String(p.baseNightlyRate)
              : "",
          cleaningFee:
            p.cleaningFee !== null && p.cleaningFee !== undefined
              ? String(p.cleaningFee)
              : "",
          maxGuests:
            p.maxGuests !== null && p.maxGuests !== undefined
              ? String(p.maxGuests)
              : "",
          minimumNights: String(p.minimumNights ?? 1),
          maximumNights:
            p.maximumNights !== null && p.maximumNights !== undefined
              ? String(p.maximumNights)
              : "",
          publicTitle: p.publicTitle ?? "",
          publicDescription: p.publicDescription ?? "",

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
      const latitude = form.latitude.trim() === "" ? null : Number(form.latitude);
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
          publicTitle: form.publicTitle,
          publicDescription: form.publicDescription,
          cleaningDurationMinutes: Number(form.cleaningDurationMinutes),
          cleaningStartOffsetMinutes: Number(form.cleaningStartOffsetMinutes),
          latitude,
          longitude,
          baseNightlyRate:
            form.baseNightlyRate.trim() === ""
              ? null
              : Number(form.baseNightlyRate),
          cleaningFee:
            form.cleaningFee.trim() === "" ? null : Number(form.cleaningFee),
          maxGuests: form.maxGuests.trim() === "" ? null : Number(form.maxGuests),
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

    const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}/amenities`, {
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
    });

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

  async function handleCreateTax() {
    if (!id) return;

    const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}/taxes`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newTax.name,
        percentage: Number(newTax.percentage || 0),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to create tax");
    }

    setTaxes((prev) => [...prev, data.item]);

    setNewTax({
      name: "",
      percentage: "",
    });
  }

  async function handleDeleteTax(taxId: string) {
    if (!id) return;

    if (!window.confirm("Delete this tax?")) {
      return;
    }

    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/taxes/${taxId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to delete tax");
    }

    setTaxes((prev) => prev.filter((t) => t.id !== taxId));
  }

  async function handleSaveTax() {
    if (!id || !editingTaxId || !editingTax) return;

    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/taxes/${editingTaxId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingTax.name,
          percentage: Number(editingTax.percentage || 0),
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update tax");
    }

    setTaxes((prev) =>
      prev.map((t) => (t.id === editingTaxId ? data.item : t))
    );

    setEditingTaxId(null);
    setEditingTax(null);
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
          style={secondaryButtonStyle}
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
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
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

          <div style={responsiveGridStyle}>
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

          <div style={responsiveGridStyle}>
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

          <div style={responsiveGridStyle}>
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

          <div style={responsiveGridStyle}>
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
                Configure how this property appears and prices reservations on your
                public booking page.
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

<div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Public Title</div>

  <input
    value={form.publicTitle}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        publicTitle: e.target.value,
      }))
    }
    placeholder="Luxury Beachfront Villa"
    style={inputStyle}
  />
</div>

<div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Public Description</div>

  <textarea
    value={form.publicDescription}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        publicDescription: e.target.value,
      }))
    }
    placeholder="Describe the guest experience, location, amenities and unique features of the property."
    style={{
      ...inputStyle,
      height: 120,
      padding: 14,
      resize: "vertical",
    }}
  />
</div>
            <div style={responsiveGridStyle}>
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

            <div style={responsiveGridStyle}>
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
                Add included amenities or configurable fees such as pet fees,
                parking, or resort fees.
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
                      <div style={{ display: "grid", gap: 12 }}>
                        <input
                          value={editingAmenity?.name ?? ""}
                          onChange={(e) =>
                            setEditingAmenity((s) =>
                              s ? { ...s, name: e.target.value } : s
                            )
                          }
                          placeholder="Amenity name"
                          style={inputStyle}
                        />

                        <input
                          value={editingAmenity?.description ?? ""}
                          onChange={(e) =>
                            setEditingAmenity((s) =>
                              s ? { ...s, description: e.target.value } : s
                            )
                          }
                          placeholder="Description"
                          style={inputStyle}
                        />

                        <div style={responsiveGridStyle}>
                          <select
                            value={editingAmenity?.chargeMode ?? "INCLUDED"}
                            onChange={(e) =>
                              setEditingAmenity((s) =>
                                s
                                  ? {
                                      ...s,
                                      chargeMode:
                                        e.target.value as AmenityChargeMode,
                                    }
                                  : s
                              )
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
                              setEditingAmenity((s) =>
                                s
                                  ? {
                                      ...s,
                                      feeType: e.target.value as AmenityFeeType,
                                    }
                                  : s
                              )
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
                              setEditingAmenity((s) =>
                                s ? { ...s, amount: e.target.value } : s
                              )
                            }
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleSaveAmenity();
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={primarySmallButtonStyle}
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingAmenityId(null);
                              setEditingAmenity(null);
                            }}
                            style={secondarySmallButtonStyle}
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

                          {amenity.description ? (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                marginTop: 2,
                              }}
                            >
                              {amenity.description}
                            </div>
                          ) : null}

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

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                            style={iconButtonStyle}
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
                            style={iconButtonStyle}
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
                gridTemplateColumns:
                  "minmax(180px, 1fr) minmax(180px, 1fr) 160px 160px 140px auto",
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
                    setNewAmenity((s) => ({
                      ...s,
                      chargeMode: e.target.value as AmenityChargeMode,
                    }))
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
                    setNewAmenity((s) => ({
                      ...s,
                      feeType: e.target.value as AmenityFeeType,
                    }))
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
                style={primaryButtonStyle}
              >
                Add
              </button>
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
                Property Taxes
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Add tax percentages that should be applied to direct booking
                reservations.
              </div>
            </div>

            {taxes.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No taxes configured yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {taxes.map((tax) => (
                  <div
                    key={tax.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid #dbeafe",
                    }}
                  >
                    {editingTaxId === tax.id ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={responsiveGridStyle}>
                          <input
                            value={editingTax?.name ?? ""}
                            onChange={(e) =>
                              setEditingTax((s) =>
                                s ? { ...s, name: e.target.value } : s
                              )
                            }
                            placeholder="Tax name"
                            style={inputStyle}
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingTax?.percentage ?? ""}
                            onChange={(e) =>
                              setEditingTax((s) =>
                                s ? { ...s, percentage: e.target.value } : s
                              )
                            }
                            placeholder="11.5"
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleSaveTax();
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={primarySmallButtonStyle}
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaxId(null);
                              setEditingTax(null);
                            }}
                            style={secondarySmallButtonStyle}
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
                            {tax.name}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginTop: 2,
                            }}
                          >
                            Applied to direct booking pricing
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#111827",
                            }}
                          >
                            {Number(tax.percentage ?? 0).toFixed(2)}%
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaxId(tax.id);
                              setEditingTax({ ...tax });
                            }}
                            style={iconButtonStyle}
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleDeleteTax(tax.id);
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={iconButtonStyle}
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
                gridTemplateColumns: "minmax(180px, 1fr) 180px auto",
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Tax Name</div>
                <input
                  value={newTax.name}
                  onChange={(e) =>
                    setNewTax((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="Room Tax"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Percentage</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTax.percentage}
                  onChange={(e) =>
                    setNewTax((s) => ({ ...s, percentage: e.target.value }))
                  }
                  placeholder="11.5"
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleCreateTax();
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  }
                }}
                style={primaryButtonStyle}
              >
                Add Tax
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
              style={secondaryButtonStyle}
            >
              Cancel
            </button>

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

const responsiveGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

const secondaryButtonStyle: React.CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const primarySmallButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const secondarySmallButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const iconButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
};
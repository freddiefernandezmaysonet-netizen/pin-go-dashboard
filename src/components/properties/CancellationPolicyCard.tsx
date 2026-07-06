import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  getCancellationPolicy,
  saveCancellationPolicy,
} from "../../api/cancellationPolicy";
import type {
  CancellationPolicyType,
  CancellationRefundBasis,
  DashboardCancellationPolicy,
  SaveCancellationPolicyInput,
} from "../../api/cancellationPolicy";

type LoadState = "idle" | "loading" | "ready" | "saving" | "error";

type CancellationPolicyCardProps = {
  propertyId: string;
};

type PolicyForm = {
  name: string;
  type: CancellationPolicyType;
  guestSelfCancellationEnabled: boolean;
  autoRefundEligibleCancellations: boolean;
  requireHostApprovalOutsidePolicy: boolean;
  freeCancellationHoursBeforeCheckIn: number;
  refundBasis: CancellationRefundBasis;
  refundPercentBeforeDeadline: number;
  refundPercentAfterDeadline: number;
  cleaningFeeRefundable: boolean;
  amenitiesRefundable: boolean;
  taxesRefundable: boolean;
  nonRefundableDiscountPercent: number | null;
  description: string;
};

const POLICY_TYPES: Array<{
  value: CancellationPolicyType;
  label: string;
  description: string;
}> = [
  {
    value: "FLEXIBLE",
    label: "Flexible",
    description: "Full refund until 7 days before check-in.",
  },
  {
    value: "MODERATE",
    label: "Moderate",
    description: "Full refund until 5 days before check-in, partial after.",
  },
  {
    value: "FIRM",
    label: "Firm",
    description: "Full refund until 7 days before check-in, partial after.",
  },
  {
    value: "STRICT",
    label: "Strict",
    description: "More protective policy for high-risk dates.",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Host-defined refund timing and percentages.",
  },
  {
    value: "NON_REFUNDABLE",
    label: "Non-refundable",
    description: "No automatic refund after booking.",
  },
];

const REFUND_BASIS_OPTIONS: Array<{
  value: CancellationRefundBasis;
  label: string;
}> = [
  { value: "TOTAL_AMOUNT", label: "Total amount" },
  { value: "NIGHTLY_SUBTOTAL", label: "Nightly subtotal only" },
  { value: "NIGHTLY_PLUS_CLEANING", label: "Nightly + cleaning" },
  { value: "CUSTOM", label: "Custom basis" },
];

function getPreset(type: CancellationPolicyType): Partial<PolicyForm> {
  if (type === "MODERATE") {
    return {
      name: "Moderate",
      freeCancellationHoursBeforeCheckIn: 120,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 50,
      description:
        "Guests can cancel for a full refund until 5 days before check-in. After that, a partial refund may apply.",
    };
  }

  if (type === "FIRM") {
    return {
      name: "Firm",
      freeCancellationHoursBeforeCheckIn: 168,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 50,
      description:
        "Guests can cancel for a full refund until 7 days before check-in. After that, a partial refund may apply.",
    };
  }

  if (type === "STRICT") {
    return {
      name: "Strict",
      freeCancellationHoursBeforeCheckIn: 336,
      refundPercentBeforeDeadline: 50,
      refundPercentAfterDeadline: 0,
      description:
        "Guests may receive a partial refund until 14 days before check-in. After that, host approval is required.",
    };
  }

  if (type === "NON_REFUNDABLE") {
    return {
      name: "Non-refundable",
      freeCancellationHoursBeforeCheckIn: 0,
      refundPercentBeforeDeadline: 0,
      refundPercentAfterDeadline: 0,
      description:
        "This reservation is non-refundable unless the host approves an exception.",
    };
  }

  if (type === "CUSTOM") {
    return {
      name: "Custom",
      freeCancellationHoursBeforeCheckIn: 168,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 0,
      description: "Custom cancellation policy configured by the host.",
    };
  }

  return {
    name: "Flexible",
    freeCancellationHoursBeforeCheckIn: 168,
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    description:
      "Guests can cancel for a full refund until 7 days before check-in. After that, host approval may be required.",
  };
}

function policyToForm(
  policy: DashboardCancellationPolicy | null
): PolicyForm {
  if (policy) {
    return {
      name: policy.name,
      type: policy.type,
      guestSelfCancellationEnabled: policy.guestSelfCancellationEnabled,
      autoRefundEligibleCancellations: policy.autoRefundEligibleCancellations,
      requireHostApprovalOutsidePolicy:
        policy.requireHostApprovalOutsidePolicy,
      freeCancellationHoursBeforeCheckIn:
        policy.freeCancellationHoursBeforeCheckIn,
      refundBasis: policy.refundBasis,
      refundPercentBeforeDeadline: policy.refundPercentBeforeDeadline,
      refundPercentAfterDeadline: policy.refundPercentAfterDeadline,
      cleaningFeeRefundable: policy.cleaningFeeRefundable,
      amenitiesRefundable: policy.amenitiesRefundable,
      taxesRefundable: policy.taxesRefundable,
      nonRefundableDiscountPercent: policy.nonRefundableDiscountPercent,
      description: policy.description ?? "",
    };
  }

  return {
    name: "Flexible",
    type: "FLEXIBLE",
    guestSelfCancellationEnabled: true,
    autoRefundEligibleCancellations: true,
    requireHostApprovalOutsidePolicy: true,
    freeCancellationHoursBeforeCheckIn: 168,
    refundBasis: "TOTAL_AMOUNT",
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    cleaningFeeRefundable: true,
    amenitiesRefundable: true,
    taxesRefundable: true,
    nonRefundableDiscountPercent: null,
    description:
      "Guests can cancel for a full refund until 7 days before check-in. After that, host approval may be required.",
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizeHours(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getPolicySummary(form: PolicyForm) {
  const days = form.freeCancellationHoursBeforeCheckIn / 24;
  const deadlineLabel =
    form.freeCancellationHoursBeforeCheckIn === 0
      ? "until booking confirmation"
      : days >= 1 && Number.isInteger(days)
      ? `${days} day(s) before check-in`
      : `${form.freeCancellationHoursBeforeCheckIn} hour(s) before check-in`;

  if (form.type === "NON_REFUNDABLE") {
    return "Guests cannot receive an automatic refund unless the host approves an exception.";
  }

  return `Guests receive ${form.refundPercentBeforeDeadline}% refund until ${deadlineLabel}. After that, ${form.refundPercentAfterDeadline}% refund applies${
    form.requireHostApprovalOutsidePolicy ? " with host approval outside policy." : "."
  }`;
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label style={toggleRowStyle}>
      <div>
        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
          {title}
        </div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
          {description}
        </div>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 18, height: 18 }}
      />
    </label>
  );
}

export function CancellationPolicyCard({ propertyId }: CancellationPolicyCardProps) {
  const [form, setForm] = useState<PolicyForm>(policyToForm(null));
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const selectedType = useMemo(
    () => POLICY_TYPES.find((item) => item.value === form.type),
    [form.type]
  );

  const summary = useMemo(() => getPolicySummary(form), [form]);

  async function loadPolicy() {
    if (!propertyId) return;

    try {
      setLoadState("loading");
      setError(null);

      const response = await getCancellationPolicy(propertyId);
      setForm(policyToForm(response.policy));
      setLoadState("ready");
    } catch (err: any) {
      setLoadState("error");
      setError(err?.message || "Unable to load cancellation policy.");
    }
  }

  async function handleSave() {
    try {
      setLoadState("saving");
      setError(null);

      const payload: SaveCancellationPolicyInput = {
        name: form.name,
        type: form.type,
        guestSelfCancellationEnabled: form.guestSelfCancellationEnabled,
        autoRefundEligibleCancellations: form.autoRefundEligibleCancellations,
        requireHostApprovalOutsidePolicy:
          form.requireHostApprovalOutsidePolicy,
        freeCancellationHoursBeforeCheckIn:
          form.freeCancellationHoursBeforeCheckIn,
        refundBasis: form.refundBasis,
        refundPercentBeforeDeadline: form.refundPercentBeforeDeadline,
        refundPercentAfterDeadline: form.refundPercentAfterDeadline,
        cleaningFeeRefundable: form.cleaningFeeRefundable,
        amenitiesRefundable: form.amenitiesRefundable,
        taxesRefundable: form.taxesRefundable,
        nonRefundableDiscountPercent: form.nonRefundableDiscountPercent,
        description: form.description || null,
      };

      const response = await saveCancellationPolicy(propertyId, payload);
      setForm(policyToForm(response.policy));
      setSavedAt(new Date().toISOString());
      setLoadState("ready");
    } catch (err: any) {
      setLoadState("error");
      setError(err?.message || "Unable to save cancellation policy.");
    }
  }

  useEffect(() => {
    loadPolicy();
  }, [propertyId]);

  const isBusy = loadState === "loading" || loadState === "saving";

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Direct Booking Rules</p>
          <h3 style={titleStyle}>Cancellation Policy</h3>
          <p style={descriptionStyle}>
            Configure how Pin&Go evaluates guest cancellations, refunds, and
            host approval rules for this property.
          </p>
        </div>

        <span style={statusBadgeStyle}>
          {loadState === "saving"
            ? "Saving"
            : loadState === "loading"
            ? "Loading"
            : "Policy Engine V1"}
        </span>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={sectionStyle}>
        <label style={labelStyle}>
          Policy type
          <select
            value={form.type}
            onChange={(event) => {
              const nextType = event.target.value as CancellationPolicyType;
              const preset = getPreset(nextType);

              setForm((current) => ({
                ...current,
                ...preset,
                type: nextType,
              }));
            }}
            style={inputStyle}
            disabled={isBusy}
          >
            {POLICY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <div style={hintBoxStyle}>
          <strong>{selectedType?.label ?? "Policy"}</strong>
          <span>{selectedType?.description}</span>
        </div>

        <label style={labelStyle}>
          Policy name
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            style={inputStyle}
            disabled={isBusy}
          />
        </label>

        <label style={labelStyle}>
          Public description
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
            disabled={isBusy}
          />
        </label>
      </div>

      <div style={gridStyle}>
        <label style={labelStyle}>
          Free cancellation window
          <input
            type="number"
            min={0}
            value={form.freeCancellationHoursBeforeCheckIn}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                freeCancellationHoursBeforeCheckIn: normalizeHours(
                  Number(event.target.value)
                ),
              }))
            }
            style={inputStyle}
            disabled={isBusy}
          />
          <span style={fieldHelpStyle}>Hours before check-in</span>
        </label>

        <label style={labelStyle}>
          Refund basis
          <select
            value={form.refundBasis}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                refundBasis: event.target.value as CancellationRefundBasis,
              }))
            }
            style={inputStyle}
            disabled={isBusy}
          >
            {REFUND_BASIS_OPTIONS.map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Refund before deadline
          <input
            type="number"
            min={0}
            max={100}
            value={form.refundPercentBeforeDeadline}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                refundPercentBeforeDeadline: clampPercent(
                  Number(event.target.value)
                ),
              }))
            }
            style={inputStyle}
            disabled={isBusy}
          />
          <span style={fieldHelpStyle}>Percent</span>
        </label>

        <label style={labelStyle}>
          Refund after deadline
          <input
            type="number"
            min={0}
            max={100}
            value={form.refundPercentAfterDeadline}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                refundPercentAfterDeadline: clampPercent(
                  Number(event.target.value)
                ),
              }))
            }
            style={inputStyle}
            disabled={isBusy}
          />
          <span style={fieldHelpStyle}>Percent</span>
        </label>
      </div>

      <div style={sectionStyle}>
        <ToggleRow
          title="Guest self-cancellation"
          description="Allow guests to cancel from their guest portal when policy rules allow it."
          checked={form.guestSelfCancellationEnabled}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              guestSelfCancellationEnabled: next,
            }))
          }
        />

        <ToggleRow
          title="Auto refund eligible cancellations"
          description="Let Pin&Go automatically process refunds when the policy clearly allows it."
          checked={form.autoRefundEligibleCancellations}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              autoRefundEligibleCancellations: next,
            }))
          }
        />

        <ToggleRow
          title="Require host approval outside policy"
          description="Escalate cancellations outside the refund window instead of refunding automatically."
          checked={form.requireHostApprovalOutsidePolicy}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              requireHostApprovalOutsidePolicy: next,
            }))
          }
        />
      </div>

      <div style={gridStyle}>
        <ToggleRow
          title="Refund cleaning fee"
          description="Include cleaning fee in eligible refunds."
          checked={form.cleaningFeeRefundable}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              cleaningFeeRefundable: next,
            }))
          }
        />

        <ToggleRow
          title="Refund amenities"
          description="Include selected amenity charges in eligible refunds."
          checked={form.amenitiesRefundable}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              amenitiesRefundable: next,
            }))
          }
        />

        <ToggleRow
          title="Refund taxes"
          description="Include taxes in eligible refunds when legally appropriate."
          checked={form.taxesRefundable}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              taxesRefundable: next,
            }))
          }
        />
      </div>

      <div style={summaryStyle}>
        <strong>Guest-facing summary</strong>
        <p>{summary}</p>
      </div>

      <div style={footerStyle}>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          {savedAt
            ? `Last saved ${new Date(savedAt).toLocaleString()}`
            : "Policy changes apply to new reservations only. Existing reservations keep their accepted policy snapshot."}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy || !propertyId}
          style={{
            ...buttonStyle,
            opacity: isBusy || !propertyId ? 0.65 : 1,
            cursor: isBusy || !propertyId ? "not-allowed" : "pointer",
          }}
        >
          {loadState === "saving" ? "Saving..." : "Save policy"}
        </button>
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: 20,
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  padding: 20,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 22,
  color: "#0f172a",
  lineHeight: 1.2,
};

const descriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 720,
};

const statusBadgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(37, 99, 235, 0.1)",
  color: "#1d4ed8",
  border: "1px solid rgba(37, 99, 235, 0.18)",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 16,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 16,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#0f172a",
  background: "#ffffff",
  fontSize: 14,
  boxSizing: "border-box",
};

const fieldHelpStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const hintBoxStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderRadius: 14,
  padding: "12px 14px",
  background: "rgba(239, 246, 255, 0.72)",
  border: "1px solid rgba(147, 197, 253, 0.4)",
  color: "#1e3a8a",
  fontSize: 13,
  lineHeight: 1.45,
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(255,255,255,0.84)",
};

const summaryStyle: CSSProperties = {
  marginTop: 16,
  borderRadius: 16,
  padding: "14px 16px",
  background: "rgba(240, 253, 244, 0.78)",
  border: "1px solid rgba(134, 239, 172, 0.36)",
  color: "#14532d",
  fontSize: 14,
  lineHeight: 1.5,
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: 18,
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(37, 99, 235, 0.25)",
  borderRadius: 12,
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 14px",
  fontWeight: 900,
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  borderRadius: 14,
  padding: "12px 14px",
  background: "rgba(254, 242, 242, 0.9)",
  border: "1px solid rgba(252, 165, 165, 0.35)",
  color: "#991b1b",
  fontSize: 13,
};

export default CancellationPolicyCard;
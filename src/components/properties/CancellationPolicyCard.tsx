import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  getCancellationPolicy,
  saveCancellationPolicy,
} from "../../api/cancellationPolicy";
import type {
  CancellationPolicyType,
  CancellationRefundBasis,
  CancellationRefundRule,
  CancellationNonRefundableScenario,
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
  refundRules: CancellationRefundRule[];
  nonRefundableScenarios: CancellationNonRefundableScenario[];
  guestFacingSummary: string;
  cleaningFeeRefundable: boolean;
  amenitiesRefundable: boolean;
  taxesRefundable: boolean;
  nonRefundableDiscountPercent: number | null;
  description: string;
};

type DashboardCancellationPolicyV11 = DashboardCancellationPolicy & {
  refundRules?: CancellationRefundRule[] | null;
  nonRefundableScenarios?: CancellationNonRefundableScenario[] | null;
  guestFacingSummary?: string | null;
};

type SaveCancellationPolicyV11Input = SaveCancellationPolicyInput & {
  refundRules: CancellationRefundRule[];
  nonRefundableScenarios: CancellationNonRefundableScenario[];
  guestFacingSummary: string;
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

const DEFAULT_NON_REFUNDABLE_SCENARIOS: CancellationNonRefundableScenario[] = [
  "EARLY_DEPARTURE",
  "DELAYED_ARRIVAL",
  "REDUCED_NIGHTS",
  "WEATHER_RE_SCHEDULE",
  "OTHER",
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

const STRICT_TIERED_RULES: CancellationRefundRule[] = [
  {
    minHoursBeforeCheckIn: 720,
    refundPercent: 100,
    label: "Full refund",
  },
  {
    minHoursBeforeCheckIn: 336,
    refundPercent: 50,
    label: "Partial refund",
  },
  {
    minHoursBeforeCheckIn: 0,
    refundPercent: 0,
    label: "No refund",
  },
];

const NON_REFUNDABLE_RULES: CancellationRefundRule[] = [
  {
    minHoursBeforeCheckIn: 0,
    refundPercent: 0,
    label: "No refund",
  },
];

const NON_REFUNDABLE_SCENARIO_OPTIONS: Array<{
  value: CancellationNonRefundableScenario;
  label: string;
}> = [
  { value: "EARLY_DEPARTURE", label: "Early departure" },
  { value: "DELAYED_ARRIVAL", label: "Delayed arrival" },
  { value: "REDUCED_NIGHTS", label: "Reducing reserved nights" },
  { value: "WEATHER_RE_SCHEDULE", label: "Weather-related reschedules" },
  { value: "OTHER", label: "Other post-booking changes" },
];

function getPreset(type: CancellationPolicyType): Partial<PolicyForm> {
  if (type === "MODERATE") {
    return {
      name: "Moderate",
      freeCancellationHoursBeforeCheckIn: 120,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 50,
      refundRules: [],
      nonRefundableScenarios: [],
      guestFacingSummary:
        "Guests can cancel for a full refund until 5 days before check-in. After that, a partial refund may apply according to the property's cancellation policy.",
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
      refundRules: [],
      nonRefundableScenarios: [],
      guestFacingSummary:
        "Guests can cancel for a full refund until 7 days before check-in. After that, a partial refund may apply according to the property's cancellation policy.",
      description:
        "Guests can cancel for a full refund until 7 days before check-in. After that, a partial refund may apply.",
    };
  }

  if (type === "STRICT") {
    return {
      name: "Strict",
      freeCancellationHoursBeforeCheckIn: 720,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 0,
      refundRules: STRICT_TIERED_RULES.map((rule) => ({ ...rule })),
      nonRefundableScenarios: [...DEFAULT_NON_REFUNDABLE_SCENARIOS],
      guestFacingSummary:
        "Travelers who cancel at least 30 days before check-in will get back 100% of the amount they've paid. If they cancel between 14 and 30 days before check-in, they'll get back 50%. Otherwise, they won't get a refund. No refunds will be made for early departures, delayed arrival, reducing nights, weather-related reschedules, or other post-booking changes.",
      description:
        "Cancel at least 30 days before check-in for a 100% refund. Cancel between 14 and 30 days before check-in for a 50% refund. Otherwise, no refund applies.",
    };
  }

  if (type === "NON_REFUNDABLE") {
    return {
      name: "Non-refundable",
      freeCancellationHoursBeforeCheckIn: 0,
      refundPercentBeforeDeadline: 0,
      refundPercentAfterDeadline: 0,
      refundRules: NON_REFUNDABLE_RULES.map((rule) => ({ ...rule })),
      nonRefundableScenarios: [...DEFAULT_NON_REFUNDABLE_SCENARIOS],
      guestFacingSummary:
        "This reservation is non-refundable. No refunds will be made for early departures, delayed arrival, reducing nights, weather-related reschedules, or other post-booking changes.",
      description:
        "This reservation is non-refundable unless the host approves an exception.",
    };
  }

  if (type === "CUSTOM") {
    return {
      name: "Custom",
      freeCancellationHoursBeforeCheckIn: 720,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 0,
      refundRules: STRICT_TIERED_RULES.map((rule) => ({ ...rule })),
      nonRefundableScenarios: [...DEFAULT_NON_REFUNDABLE_SCENARIOS],
      guestFacingSummary:
        "Travelers who cancel at least 30 days before check-in will get back 100% of the amount they've paid. If they cancel between 14 and 30 days before check-in, they'll get back 50%. Otherwise, they won't get a refund. No refunds will be made for early departures, delayed arrival, reducing nights, weather-related reschedules, or other post-booking changes.",
      description:
        "Custom cancellation policy. The host can edit refund windows, refund percentages, and non-refundable scenarios.",
    };
  }

  return {
    name: "Flexible",
    freeCancellationHoursBeforeCheckIn: 168,
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    refundRules: [],
    nonRefundableScenarios: [],
    guestFacingSummary:
      "Guests can cancel for a full refund until 7 days before check-in. After that, host approval may be required.",
    description:
      "Guests can cancel for a full refund until 7 days before check-in. After that, host approval may be required.",
  };
}

function policyToForm(policy: DashboardCancellationPolicy | null): PolicyForm {
  if (policy) {
    const policyV11 = policy as DashboardCancellationPolicyV11;
    const preset = getPreset(policy.type);

    const policyRefundRules = normalizeRefundRules(policyV11.refundRules ?? []);
    const presetRefundRules = normalizeRefundRules(preset.refundRules ?? []);

    const policyNonRefundableScenarios = normalizeNonRefundableScenarios(
      policyV11.nonRefundableScenarios ?? []
    );
    const presetNonRefundableScenarios = normalizeNonRefundableScenarios(
      preset.nonRefundableScenarios ?? []
    );

    const shouldUsePresetRefundRules =
      policyRefundRules.length === 0 &&
      (policy.type === "STRICT" ||
        policy.type === "CUSTOM" ||
        policy.type === "NON_REFUNDABLE");

    const shouldUsePresetScenarios =
      policyNonRefundableScenarios.length === 0 &&
      (policy.type === "STRICT" ||
        policy.type === "CUSTOM" ||
        policy.type === "NON_REFUNDABLE");

    const savedGuestFacingSummary =
      typeof policyV11.guestFacingSummary === "string"
        ? policyV11.guestFacingSummary.trim()
        : "";

    const savedDescription =
      typeof policy.description === "string" ? policy.description.trim() : "";

    const guestFacingSummary =
      savedGuestFacingSummary ||
      (policy.type === "CUSTOM" ? preset.guestFacingSummary ?? "" : "") ||
      savedDescription ||
      preset.guestFacingSummary ||
      "";

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
      refundRules: shouldUsePresetRefundRules
        ? presetRefundRules
        : policyRefundRules,
      nonRefundableScenarios: shouldUsePresetScenarios
        ? presetNonRefundableScenarios
        : policyNonRefundableScenarios,
      guestFacingSummary,
      cleaningFeeRefundable: policy.cleaningFeeRefundable,
      amenitiesRefundable: policy.amenitiesRefundable,
      taxesRefundable: policy.taxesRefundable,
      nonRefundableDiscountPercent: policy.nonRefundableDiscountPercent,
      description: policy.description ?? preset.description ?? "",
    };
  }

  const preset = getPreset("FLEXIBLE");

  return {
    name: preset.name ?? "Flexible",
    type: "FLEXIBLE",
    guestSelfCancellationEnabled: true,
    autoRefundEligibleCancellations: true,
    requireHostApprovalOutsidePolicy: true,
    freeCancellationHoursBeforeCheckIn:
      preset.freeCancellationHoursBeforeCheckIn ?? 168,
    refundBasis: "TOTAL_AMOUNT",
    refundPercentBeforeDeadline: preset.refundPercentBeforeDeadline ?? 100,
    refundPercentAfterDeadline: preset.refundPercentAfterDeadline ?? 0,
    refundRules: normalizeRefundRules(preset.refundRules ?? []),
    nonRefundableScenarios: normalizeNonRefundableScenarios(
      preset.nonRefundableScenarios ?? []
    ),
    guestFacingSummary: preset.guestFacingSummary ?? "",
    cleaningFeeRefundable: true,
    amenitiesRefundable: true,
    taxesRefundable: true,
    nonRefundableDiscountPercent: null,
    description:
      preset.description ??
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

function normalizeRefundRules(
  rules: CancellationRefundRule[] | null | undefined
): CancellationRefundRule[] {
  if (!Array.isArray(rules)) return [];

  return rules
    .map((rule) => {
      const refundPercent = clampPercent(Number(rule.refundPercent));

      return {
        ...rule,
        minHoursBeforeCheckIn: normalizeHours(
          Number(rule.minHoursBeforeCheckIn)
        ),
        refundPercent,
        label: (rule.label ?? "").trim() || `${refundPercent}% refund`,
      };
    })
    .sort(
      (first, second) =>
        second.minHoursBeforeCheckIn - first.minHoursBeforeCheckIn
    );
}

function normalizeNonRefundableScenarios(
  scenarios: CancellationNonRefundableScenario[] | null | undefined
): CancellationNonRefundableScenario[] {
  if (!Array.isArray(scenarios)) return [];

  const selected = new Set(scenarios);

  return DEFAULT_NON_REFUNDABLE_SCENARIOS.filter((scenario) =>
    selected.has(scenario)
  );
}

function getScenarioLabel(value: CancellationNonRefundableScenario) {
  return (
    NON_REFUNDABLE_SCENARIO_OPTIONS.find((item) => item.value === value)
      ?.label ?? value
  );
}

function formatHoursBeforeCheckIn(hours: number) {
  const normalizedHours = normalizeHours(hours);
  const days = normalizedHours / 24;

  if (normalizedHours === 0) return "0 hours";
  if (days >= 1 && Number.isInteger(days)) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${normalizedHours} hour${normalizedHours === 1 ? "" : "s"}`;
}

function formatRefundRuleWindow(
  rule: CancellationRefundRule,
  index: number,
  rules: CancellationRefundRule[]
) {
  const minHours = normalizeHours(Number(rule.minHoursBeforeCheckIn));
  const previousRule = index > 0 ? rules[index - 1] : null;
  const previousHours = previousRule
    ? normalizeHours(Number(previousRule.minHoursBeforeCheckIn))
    : null;

  if (minHours === 0 && previousHours && previousHours > 0) {
    return `less than ${formatHoursBeforeCheckIn(
      previousHours
    )} before check-in`;
  }

  if (previousHours && previousHours > minHours) {
    return `between ${formatHoursBeforeCheckIn(
      minHours
    )} and ${formatHoursBeforeCheckIn(previousHours)} before check-in`;
  }

  if (minHours === 0) {
    return "after booking";
  }

  return `at least ${formatHoursBeforeCheckIn(minHours)} before check-in`;
}

function getPolicySummary(form: PolicyForm) {
  const normalizedRules = normalizeRefundRules(form.refundRules);

  if (normalizedRules.length > 0) {
    const rulesSummary = normalizedRules
      .map((rule, index) => {
        const label = rule.label ? `${rule.label}: ` : "";

        return `${label}${rule.refundPercent}% refund ${formatRefundRuleWindow(
          rule,
          index,
          normalizedRules
        )}.`;
      })
      .join(" ");

    const scenariosSummary =
      form.nonRefundableScenarios.length > 0
        ? ` Non-refundable scenarios include ${form.nonRefundableScenarios
            .map(getScenarioLabel)
            .join(", ")}.`
        : "";

    return `${rulesSummary}${scenariosSummary}`;
  }

   const cancellationWindowText =
    form.freeCancellationHoursBeforeCheckIn === 0
      ? "after booking confirmation"
      : `until ${formatHoursBeforeCheckIn(
          form.freeCancellationHoursBeforeCheckIn
        )} before check-in`;
  
if (form.type === "NON_REFUNDABLE") {
    return "Guests cannot receive an automatic refund unless the host approves an exception.";
  }

   return `Guests receive ${form.refundPercentBeforeDeadline}% refund ${cancellationWindowText}. After that, ${form.refundPercentAfterDeadline}% refund applies${
    form.requireHostApprovalOutsidePolicy
      ? " with host approval outside policy."
      : "."
  }`;

}

function ToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        ...toggleRowStyle,
        opacity: disabled ? 0.68 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
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
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 18, height: 18 }}
      />
    </label>
  );
}

export function CancellationPolicyCard({
  propertyId,
}: CancellationPolicyCardProps) {
  const [form, setForm] = useState<PolicyForm>(policyToForm(null));
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const selectedType = useMemo(
    () => POLICY_TYPES.find((item) => item.value === form.type),
    [form.type]
  );

  const generatedSummary = useMemo(() => getPolicySummary(form), [form]);
   const guestFacingPreview = useMemo(() => {
    if (canEditGuestFacingSummary && form.guestFacingSummary.trim()) {
      return form.guestFacingSummary.trim();
    }

    return generatedSummary;
  }, [canEditGuestFacingSummary, form.guestFacingSummary, generatedSummary]);
   const normalizedRulesPreview = useMemo(
    () => normalizeRefundRules(form.refundRules),
    [form.refundRules]
  );

  const isBusy = loadState === "loading" || loadState === "saving";
  const canEditRefundRules = form.type === "CUSTOM";
  const canEditGuestFacingSummary = form.type === "CUSTOM";
  
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

  function handlePolicyTypeChange(nextType: CancellationPolicyType) {
    const preset = getPreset(nextType);

    setForm((current) => ({
      ...current,
      ...preset,
      type: nextType,
      refundRules:
        preset.refundRules !== undefined
          ? normalizeRefundRules(preset.refundRules)
          : current.refundRules,
      nonRefundableScenarios:
        preset.nonRefundableScenarios !== undefined
          ? normalizeNonRefundableScenarios(preset.nonRefundableScenarios)
          : current.nonRefundableScenarios,
    }));
  }

    function handleAddRefundRule() {
    if (!canEditRefundRules) return;

    const nextRule: CancellationRefundRule = {
      minHoursBeforeCheckIn: 0,
      refundPercent: 0,
      label: "New rule",
    };

    setForm((current) => ({
      ...current,
      refundRules: [...current.refundRules, nextRule],
    }));
  }
   function handleUpdateRefundRule(
    index: number,
    patch: Partial<CancellationRefundRule>
  ) {
    if (!canEditRefundRules) return;

    setForm((current) => ({
      ...current,
      refundRules: current.refundRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule
      ),
    }));
  }
   function handleDeleteRefundRule(index: number) {
    if (!canEditRefundRules) return;

    setForm((current) => ({
      ...current,
      refundRules: current.refundRules.filter(
        (_rule, ruleIndex) => ruleIndex !== index
      ),
    }));
  } 
  function handleScenarioToggle(
    scenario: CancellationNonRefundableScenario,
    checked: boolean
  ) {
    setForm((current) => {
      const selected = new Set(current.nonRefundableScenarios);

      if (checked) {
        selected.add(scenario);
      } else {
        selected.delete(scenario);
      }

      return {
        ...current,
        nonRefundableScenarios: DEFAULT_NON_REFUNDABLE_SCENARIOS.filter(
          (item) => selected.has(item)
        ),
      };
    });
  }

  async function handleSave() {
    try {
      setLoadState("saving");
      setError(null);

      const payload: SaveCancellationPolicyV11Input = {
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
        refundRules: normalizeRefundRules(form.refundRules),
        nonRefundableScenarios: normalizeNonRefundableScenarios(
          form.nonRefundableScenarios
        ),
        guestFacingSummary: guestFacingPreview.trim(),
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

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Direct Booking Rules</p>
          <h3 style={titleStyle}>Cancellation Policy</h3>
          <p style={descriptionStyle}>
            Configure how Pin&Go evaluates guest cancellations, refunds, tiered
            refund rules, non-refundable scenarios, and host approval rules for
            this property.
          </p>
        </div>

        <span style={statusBadgeStyle}>
          {loadState === "saving"
            ? "Saving"
            : loadState === "loading"
            ? "Loading"
            : "Policy Engine V1.1"}
        </span>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={sectionStyle}>
        <label style={labelStyle}>
          Policy type
          <select
            value={form.type}
            onChange={(event) =>
              handlePolicyTypeChange(
                event.target.value as CancellationPolicyType
              )
            }
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
               <label style={labelStyle}>
          Guest-facing summary
          <textarea
            value={
              canEditGuestFacingSummary
                ? form.guestFacingSummary
                : generatedSummary
            }
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                guestFacingSummary: event.target.value,
              }))
            }
            placeholder={generatedSummary}
            style={{
              ...inputStyle,
              minHeight: 110,
              resize: "vertical",
              background: canEditGuestFacingSummary ? "#ffffff" : "#f8fafc",
              color: canEditGuestFacingSummary ? "#0f172a" : "#475569",
            }}
            disabled={isBusy || !canEditGuestFacingSummary}
          />
          <span style={fieldHelpStyle}>
            {canEditGuestFacingSummary
              ? "Custom policies can use a host-defined guest-facing summary."
              : "This text is generated automatically from the selected policy rules and free cancellation window."}
          </span>
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

      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={panelTitleStyle}>Tiered refund rules</div>
            <div style={panelDescriptionStyle}>
              Add refund windows from most generous to least generous. Pin&Go
              saves rules from the highest check-in window to the lowest.
            </div>
          </div>
                   <button
            type="button"
            onClick={handleAddRefundRule}
            disabled={isBusy || !canEditRefundRules}
            style={{
              ...secondaryButtonStyle,
              opacity: isBusy || !canEditRefundRules ? 0.45 : 1,
              cursor:
                isBusy || !canEditRefundRules ? "not-allowed" : "pointer",
            }}
          >
            Add rule
          </button>
         
        </div>

                {!canEditRefundRules ? (
          <div style={lockedPresetNoticeStyle}>
            Standard policy presets are locked to keep guest-facing refund
            terms clear. Select Custom to add, remove, or edit refund rules.
          </div>
        ) : null}

        {form.refundRules.length === 0 ? (
          <div style={emptyStateStyle}>
            No tiered refund rules configured. Pin&Go will continue using the
            V1 refund deadline fields above.
          </div>
        ) : (
          <div style={rulesListStyle}>
            {form.refundRules.map((rule, index) => (
              <div key={index} style={ruleRowStyle}>
                <label style={labelStyle}>
                  Min hours before check-in
                  <input
                    type="number"
                    min={0}
                    value={rule.minHoursBeforeCheckIn}
                    onChange={(event) =>
                      handleUpdateRefundRule(index, {
                        minHoursBeforeCheckIn: normalizeHours(
                          Number(event.target.value)
                        ),
                      })
                    }
                    style={inputStyle}
                    disabled={isBusy || !canEditRefundRules}
                  />
                </label>

                <label style={labelStyle}>
                  Refund percent
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rule.refundPercent}
                    onChange={(event) =>
                      handleUpdateRefundRule(index, {
                        refundPercent: clampPercent(
                          Number(event.target.value)
                        ),
                      })
                    }
                    style={inputStyle}
                    disabled={isBusy}
                  />
                </label>

                <label style={labelStyle}>
                  Rule label
                  <input
                    value={rule.label ?? ""}
                    onChange={(event) =>
                      handleUpdateRefundRule(index, {
                        label: event.target.value,
                      })
                    }
                    style={inputStyle}
                    disabled={isBusy}
                  />
                </label>

                                <button
                  type="button"
                  onClick={() => handleDeleteRefundRule(index)}
                  disabled={isBusy || !canEditRefundRules}
                  style={{
                    ...dangerButtonStyle,
                    opacity: isBusy || !canEditRefundRules ? 0.45 : 1,
                    cursor:
                      isBusy || !canEditRefundRules
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {normalizedRulesPreview.length > 0 ? (
          <div style={rulesPreviewStyle}>
            <strong>Rule preview</strong>
            {normalizedRulesPreview.map((rule, index) => (
              <span key={`${rule.minHoursBeforeCheckIn}-${index}`}>
                {rule.label ? `${rule.label}: ` : ""}
                {rule.refundPercent}% refund{" "}
                {formatRefundRuleWindow(
                  rule,
                  index,
                  normalizedRulesPreview
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div style={panelStyle}>
        <div style={panelTitleStyle}>Non-refundable scenarios</div>
        <div style={panelDescriptionStyle}>
          Select scenarios where Pin&Go should not automatically refund the
          guest unless the host approves an exception.
        </div>

        <div style={scenarioGridStyle}>
          {NON_REFUNDABLE_SCENARIO_OPTIONS.map((scenario) => (
            <label key={scenario.value} style={scenarioOptionStyle}>
              <input
                type="checkbox"
                checked={form.nonRefundableScenarios.includes(scenario.value)}
                disabled={isBusy}
                onChange={(event) =>
                  handleScenarioToggle(scenario.value, event.target.checked)
                }
                style={{ width: 17, height: 17 }}
              />
              <span>{scenario.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <ToggleRow
          title="Guest self-cancellation"
          description="Allow guests to cancel from their guest portal when policy rules allow it."
          checked={form.guestSelfCancellationEnabled}
          disabled={isBusy}
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
          disabled={isBusy}
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
          disabled={isBusy}
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
          disabled={isBusy}
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
          disabled={isBusy}
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
          disabled={isBusy}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              taxesRefundable: next,
            }))
          }
        />
      </div>

      <div style={summaryStyle}>
        <strong>Checkout preview</strong>
        <p>{guestFacingPreview}</p>
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

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 16,
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,0.78)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
};

const panelTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
};

const panelDescriptionStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
  marginTop: 4,
};

const rulesListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const ruleRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
  alignItems: "end",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: 14,
  padding: 12,
  background: "rgba(248,250,252,0.9)",
};

const rulesPreviewStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  borderRadius: 14,
  padding: "12px 14px",
  background: "rgba(248, 250, 252, 0.94)",
  border: "1px dashed rgba(100, 116, 139, 0.32)",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.45,
};

const scenarioGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const scenarioOptionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 14,
  padding: "11px 12px",
  background: "rgba(255,255,255,0.84)",
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};

const lockedPresetNoticeStyle: CSSProperties = {
  border: "1px solid rgba(191, 219, 254, 0.9)",
  borderRadius: 14,
  padding: "10px 12px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.45,
};

const emptyStateStyle: CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  background: "rgba(248, 250, 252, 0.94)",
  border: "1px dashed rgba(100, 116, 139, 0.32)",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
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

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(37, 99, 235, 0.22)",
  borderRadius: 12,
  background: "rgba(37, 99, 235, 0.08)",
  color: "#1d4ed8",
  padding: "9px 12px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const dangerButtonStyle: CSSProperties = {
  border: "1px solid rgba(220, 38, 38, 0.2)",
  borderRadius: 12,
  background: "rgba(254, 242, 242, 0.92)",
  color: "#991b1b",
  padding: "10px 12px",
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
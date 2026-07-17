import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  GuestAccessApiError,
  getGuestAccessSettings,
  saveGuestAccessSettings,
} from "../../api/guestAccessSettings";
import type {
  GuestAccessMode,
  GuestAccessSettings,
  SaveGuestAccessSettingsInput,
} from "../../api/guestAccessSettings";

type LoadState = "idle" | "loading" | "ready" | "saving" | "error";

type GuestAccessSettingsCardProps = {
  propertyId: string;
};

type GuestAccessForm = {
  guestAccessMode: GuestAccessMode;
  cleaningNfcEnabled: boolean;
  title: string;
  guestFacingSummary: string;
  agreementText: string;
  rules: string[];
};

type AccessScenario =
  | "PASSWORD_ONLY"
  | "PASSWORD_PLUS_GUEST_NFC"
  | "PASSWORD_PLUS_GUEST_AND_CLEANING_NFC";

const EMPTY_FORM: GuestAccessForm = {
  guestAccessMode: "PASSCODE_ONLY",
  cleaningNfcEnabled: false,
  title: "Guest Agreement",
  guestFacingSummary:
    "Complete secure pre-check-in before access can be released.",
  agreementText: "",
  rules: [""],
};

function settingsToForm(
  settings: GuestAccessSettings | null
): GuestAccessForm {
  const agreement = settings?.activeAgreement;

   if (!agreement) {
    return {
      ...EMPTY_FORM,
      guestAccessMode:
        settings?.guestAccessMode ?? "PASSCODE_ONLY",
      cleaningNfcEnabled:
        settings?.cleaningNfcEnabled === true,
      rules: [""],
    };
  }
  return {
    guestAccessMode:
      settings?.guestAccessMode ?? "PASSCODE_ONLY",
    cleaningNfcEnabled:
      settings?.cleaningNfcEnabled === true,
    title: agreement.title ?? "",
    guestFacingSummary: agreement.guestFacingSummary ?? "",
    agreementText: agreement.agreementText ?? "",
    rules:
      Array.isArray(agreement.rules) && agreement.rules.length > 0
        ? agreement.rules
        : [""],
  };
}

function normalizeRules(rules: string[]) {
  return rules
    .map((rule) => rule.trim())
    .filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

function getAccessScenario(
  guestAccessMode: GuestAccessMode,
  cleaningNfcEnabled: boolean
): AccessScenario {
  if (
    guestAccessMode === "PASSCODE_PLUS_NFC" &&
    cleaningNfcEnabled
  ) {
    return "PASSWORD_PLUS_GUEST_AND_CLEANING_NFC";
  }

  if (guestAccessMode === "PASSCODE_PLUS_NFC") {
    return "PASSWORD_PLUS_GUEST_NFC";
  }

  return "PASSWORD_ONLY";
}

function scenarioLabel(scenario: AccessScenario) {
  if (
    scenario ===
    "PASSWORD_PLUS_GUEST_AND_CLEANING_NFC"
  ) {
    return "Password + Guest NFC + Cleaning NFC";
  }

  if (scenario === "PASSWORD_PLUS_GUEST_NFC") {
    return "Password + Guest NFC";
  }

  return "Password only";
}
function getErrorMessage(error: unknown) {
  if (error instanceof GuestAccessApiError) {
    if (error.code === "VALIDATION_ERROR") {
      return error.message || "Review the required configuration fields.";
    }

    if (error.code === "NOT_FOUND") {
      return (
        error.message ||
        "The property or Secure Guest Access configuration was not found."
      );
    }

    if (error.code === "SERVER_ERROR") {
      return (
        error.message ||
        "Pin&Go could not load Secure Guest Access settings."
      );
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to process Secure Guest Access settings.";
}

export function GuestAccessSettingsCard({
  propertyId,
}: GuestAccessSettingsCardProps) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [settings, setSettings] =
    useState<GuestAccessSettings | null>(null);
  const [form, setForm] = useState<GuestAccessForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const isBusy =
    loadState === "loading" || loadState === "saving";

  const selectedScenario = getAccessScenario(
    form.guestAccessMode,
    form.cleaningNfcEnabled
  );

  const normalizedRules = useMemo(
    () => normalizeRules(form.rules),
    [form.rules]
  );

  const maxGuestsConfigured =
    Number(settings?.maxGuests ?? 0) > 0;

  const formComplete =
    form.title.trim().length > 0 &&
    form.guestFacingSummary.trim().length > 0 &&
    form.agreementText.trim().length > 0 &&
    normalizedRules.length > 0;

  const canSave =
    Boolean(propertyId) &&
    !isBusy &&
    maxGuestsConfigured &&
    formComplete;

  async function loadSettings() {
    if (!propertyId) return;

    try {
      setLoadState("loading");
      setError(null);
      setSaveNotice(null);

      const response = await getGuestAccessSettings(propertyId);

      setSettings(response.settings);
      setForm(settingsToForm(response.settings));
      setLoadState("ready");
    } catch (loadError) {
      setLoadState("error");
      setError(getErrorMessage(loadError));
    }
  }

  useEffect(() => {
    void loadSettings();
  }, [propertyId]);

  function updateRule(index: number, value: string) {
    setForm((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? value : rule
      ),
    }));
  }

  function addRule() {
    setForm((current) => ({
      ...current,
      rules: [...current.rules, ""],
    }));
  }

  function removeRule(index: number) {
    setForm((current) => {
      const nextRules = current.rules.filter(
        (_rule, ruleIndex) => ruleIndex !== index
      );

      return {
        ...current,
        rules: nextRules.length > 0 ? nextRules : [""],
      };
    });
  }

  async function handleSave() {
    if (!canSave) return;

    const payload: SaveGuestAccessSettingsInput = {
      guestAccessMode: form.guestAccessMode,
      cleaningNfcEnabled: form.cleaningNfcEnabled,
      title: form.title.trim(),
      guestFacingSummary: form.guestFacingSummary.trim(),
      agreementText: form.agreementText.trim(),
      rules: normalizedRules,
    };
    try {
      setLoadState("saving");
      setError(null);
      setSaveNotice(null);

      const response = await saveGuestAccessSettings(
        propertyId,
        payload
      );

      setSettings(response.settings);
      setForm(settingsToForm(response.settings));

      setSaveNotice(
        response.newVersionCreated
          ? "A new Guest Agreement version was created. Existing reservations retain their original agreement snapshot."
          : "Secure Guest Access settings were saved. No duplicate agreement version was created."
      );

      setLoadState("ready");
    } catch (saveError) {
      setLoadState("error");
      setError(getErrorMessage(saveError));
    }
  }

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Guest Journey & Access</p>

          <h3 style={titleStyle}>Secure Guest Access</h3>

          <p style={descriptionStyle}>
            Configure the access mode, identity gate, Guest Agreement,
            property rules, and signed pre-check-in requirements used
            before Pin&Go releases guest access.
          </p>
        </div>

        <span
          style={
            settings?.configured
              ? configuredBadgeStyle
              : needsConfigurationBadgeStyle
          }
        >
          {loadState === "loading"
            ? "Loading"
            : loadState === "saving"
            ? "Saving"
            : settings?.configured
            ? "Configured"
            : "Needs configuration"}
        </span>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {saveNotice ? (
        <div style={successNoticeStyle}>{saveNotice}</div>
      ) : null}

      {!maxGuestsConfigured && loadState !== "loading" ? (
        <div style={warningStyle}>
          <strong>Maximum guests is required.</strong>
          <span>
            Save a value greater than zero in Property Settings before
            configuring Secure Guest Access.
          </span>
        </div>
      ) : null}

      <div style={summaryGridStyle}>
      <div style={summaryItemStyle}>
          <span style={summaryLabelStyle}>Access scenario</span>
          <strong style={summaryValueStyle}>
            {scenarioLabel(selectedScenario)}
          </strong>
        </div>
        <div style={summaryItemStyle}>
          <span style={summaryLabelStyle}>Maximum guests</span>
          <strong style={summaryValueStyle}>
            {maxGuestsConfigured ? settings?.maxGuests : "Not configured"}
          </strong>
        </div>

        <div style={summaryItemStyle}>
          <span style={summaryLabelStyle}>Access mode</span>
          <strong style={summaryValueStyle}>
            {modeLabel(form.guestAccessMode)}
          </strong>
        </div>

        <div style={summaryItemStyle}>
          <span style={summaryLabelStyle}>Agreement version</span>
          <strong style={summaryValueStyle}>
            {settings?.activeAgreement?.version ?? "Not created"}
          </strong>
        </div>
      </div>

      <div style={requirementsGridStyle}>
        <div style={requirementStyle}>
          <span style={requirementDotStyle} />
          <div>
            <strong>Identity verification required</strong>
            <p>
              Guests must complete the Stripe Identity flow before
              access becomes eligible.
            </p>
          </div>
        </div>

        <div style={requirementStyle}>
          <span style={requirementDotStyle} />
          <div>
            <strong>Guest signature required</strong>
            <p>
              The legal guest must accept and sign the active agreement
              during secure pre-check-in.
            </p>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div>
          <div style={sectionTitleStyle}>Access delivery mode</div>
          <div style={sectionDescriptionStyle}>
            A temporary time-bound guest password is always required.
            Guest NFC and Cleaning NFC are complementary access methods
            controlled by the selected property scenario.
          </div>
        </div>

               <div style={modeGridStyle}>
          <label
            style={{
              ...modeOptionStyle,
              ...(selectedScenario === "PASSWORD_ONLY"
                ? selectedModeOptionStyle
                : {}),
              opacity: isBusy ? 0.65 : 1,
            }}
          >
            <input
              type="radio"
              name={`guest-access-scenario-${propertyId}`}
              value="PASSWORD_ONLY"
              checked={selectedScenario === "PASSWORD_ONLY"}
              disabled={isBusy}
              onChange={() =>
                setForm((current) => ({
                  ...current,
                  guestAccessMode: "PASSCODE_ONLY",
                  cleaningNfcEnabled: false,
                }))
              }
            />

            <div>
              <strong>Password only</strong>
              <p>
                Pin&Go schedules a time-bound guest password two hours
                before check-in. Guest and cleaning NFC remain disabled.
              </p>
            </div>
          </label>

          <label
            style={{
              ...modeOptionStyle,
              ...(selectedScenario ===
              "PASSWORD_PLUS_GUEST_NFC"
                ? selectedModeOptionStyle
                : {}),
              opacity: isBusy ? 0.65 : 1,
            }}
          >
            <input
              type="radio"
              name={`guest-access-scenario-${propertyId}`}
              value="PASSWORD_PLUS_GUEST_NFC"
              checked={
                selectedScenario ===
                "PASSWORD_PLUS_GUEST_NFC"
              }
              disabled={isBusy}
              onChange={() =>
                setForm((current) => ({
                  ...current,
                  guestAccessMode: "PASSCODE_PLUS_NFC",
                  cleaningNfcEnabled: false,
                }))
              }
            />

            <div>
              <strong>Password + Guest NFC</strong>
              <p>
                The time-bound password remains mandatory. Pin&Go also
                prepares Guest NFC, while Cleaning NFC remains disabled.
              </p>
            </div>
          </label>

          <label
            style={{
              ...modeOptionStyle,
              ...(selectedScenario ===
              "PASSWORD_PLUS_GUEST_AND_CLEANING_NFC"
                ? selectedModeOptionStyle
                : {}),
              opacity: isBusy ? 0.65 : 1,
            }}
          >
            <input
              type="radio"
              name={`guest-access-scenario-${propertyId}`}
              value="PASSWORD_PLUS_GUEST_AND_CLEANING_NFC"
              checked={
                selectedScenario ===
                "PASSWORD_PLUS_GUEST_AND_CLEANING_NFC"
              }
              disabled={isBusy}
              onChange={() =>
                setForm((current) => ({
                  ...current,
                  guestAccessMode: "PASSCODE_PLUS_NFC",
                  cleaningNfcEnabled: true,
                }))
              }
            />

            <div>
              <strong>
                Password + Guest NFC + Cleaning NFC
              </strong>
              <p>
                Pin&Go prepares the mandatory guest password, Guest NFC,
                and time-bound Cleaning NFC after the assigned cleaner
                confirms availability.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div style={sectionStyle}>
        <div>
          <div style={sectionTitleStyle}>Guest Agreement</div>
          <div style={sectionDescriptionStyle}>
            Editing the agreement or its rules creates a new active
            version when the contractual content changes.
          </div>
        </div>

        <label style={labelStyle}>
          Agreement title
          <input
            value={form.title}
            disabled={isBusy}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Guest Agreement"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Guest-facing summary
          <textarea
            value={form.guestFacingSummary}
            disabled={isBusy}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                guestFacingSummary: event.target.value,
              }))
            }
            placeholder="Explain what guests must complete before receiving access."
            style={summaryTextareaStyle}
          />
        </label>

        <label style={labelStyle}>
          Agreement text
          <textarea
            value={form.agreementText}
            disabled={isBusy}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                agreementText: event.target.value,
              }))
            }
            placeholder="Enter the complete Guest Agreement."
            style={agreementTextareaStyle}
          />
        </label>
      </div>

      <div style={rulesPanelStyle}>
        <div style={rulesHeaderStyle}>
          <div>
            <div style={sectionTitleStyle}>Property rules</div>
            <div style={sectionDescriptionStyle}>
              Every rule is shown to the guest and must be accepted
              during secure pre-check-in.
            </div>
          </div>

          <button
            type="button"
            onClick={addRule}
            disabled={isBusy}
            style={{
              ...secondaryButtonStyle,
              opacity: isBusy ? 0.6 : 1,
              cursor: isBusy ? "not-allowed" : "pointer",
            }}
          >
            Add rule
          </button>
        </div>

        <div style={rulesListStyle}>
          {form.rules.map((rule, index) => (
            <div key={index} style={ruleRowStyle}>
              <label style={labelStyle}>
                Rule {index + 1}
                <input
                  value={rule}
                  disabled={isBusy}
                  onChange={(event) =>
                    updateRule(index, event.target.value)
                  }
                  placeholder="Example: No smoking inside the property."
                  style={inputStyle}
                />
              </label>

              <button
                type="button"
                onClick={() => removeRule(index)}
                disabled={isBusy}
                style={{
                  ...dangerButtonStyle,
                  opacity: isBusy ? 0.6 : 1,
                  cursor: isBusy ? "not-allowed" : "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {normalizedRules.length === 0 ? (
          <div style={emptyStateStyle}>
            Add at least one guest-facing property rule before saving.
          </div>
        ) : null}
      </div>

      <div style={versionNoticeStyle}>
        <strong>Immutable reservation evidence</strong>
        <p>
          Updating this agreement does not rewrite existing reservation
          snapshots. Each reservation keeps the version and terms that
          applied when its secure pre-check-in was created.
        </p>
      </div>

      <div style={footerStyle}>
        <div style={footerDetailsStyle}>
          <span>
            Active agreement:{" "}
            <strong>
              {settings?.activeAgreement?.isActive
                ? "Yes"
                : "Not available"}
            </strong>
          </span>

          <span>
            Last updated:{" "}
            <strong>
              {formatDate(settings?.activeAgreement?.updatedAt)}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...primaryButtonStyle,
            opacity: canSave ? 1 : 0.6,
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {loadState === "saving"
            ? "Saving..."
            : "Save Secure Guest Access"}
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
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
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
  maxWidth: 760,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.55,
};

const configuredBadgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: "8px 12px",
  background: "#ecfdf5",
  color: "#065f46",
  border: "1px solid #a7f3d0",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const needsConfigurationBadgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: "8px 12px",
  background: "#fffbeb",
  color: "#92400e",
  border: "1px solid #fde68a",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const errorStyle: CSSProperties = {
  marginTop: 16,
  borderRadius: 14,
  padding: "12px 14px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
};

const successNoticeStyle: CSSProperties = {
  marginTop: 16,
  borderRadius: 14,
  padding: "12px 14px",
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#065f46",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
};

const warningStyle: CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 4,
  borderRadius: 14,
  padding: "12px 14px",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 13,
  lineHeight: 1.45,
};

const summaryGridStyle: CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryItemStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  borderRadius: 14,
  padding: 13,
  background: "#f8fafc",
  border: "1px solid rgba(148, 163, 184, 0.24)",
};

const summaryLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const summaryValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
};

const requirementsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const requirementStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  borderRadius: 14,
  padding: 14,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
  fontSize: 13,
  lineHeight: 1.45,
};

const requirementDotStyle: CSSProperties = {
  width: 9,
  height: 9,
  marginTop: 5,
  flex: "0 0 auto",
  borderRadius: 999,
  background: "#2563eb",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 18,
  borderTop: "1px solid rgba(148, 163, 184, 0.2)",
  paddingTop: 18,
};

const sectionTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
};

const sectionDescriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
};

const modeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const modeOptionStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  borderRadius: 16,
  padding: 15,
  background: "#ffffff",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  color: "#334155",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1.45,
};

const selectedModeOptionStyle: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #93c5fd",
  color: "#1e3a8a",
  boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.08)",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
};

const summaryTextareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 92,
  resize: "vertical",
  lineHeight: 1.5,
};

const agreementTextareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 220,
  resize: "vertical",
  lineHeight: 1.55,
};

const rulesPanelStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 18,
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(148, 163, 184, 0.24)",
};

const rulesHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
};

const rulesListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const ruleRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: 10,
  alignItems: "end",
  borderRadius: 14,
  padding: 12,
  background: "#f8fafc",
  border: "1px solid rgba(148, 163, 184, 0.2)",
};

const emptyStateStyle: CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  background: "#f8fafc",
  border: "1px dashed rgba(100, 116, 139, 0.32)",
  color: "#64748b",
  fontSize: 13,
};

const versionNoticeStyle: CSSProperties = {
  marginTop: 18,
  borderRadius: 16,
  padding: "14px 16px",
  background: "#f8fafc",
  border: "1px dashed rgba(100, 116, 139, 0.32)",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginTop: 18,
};

const footerDetailsStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#64748b",
  fontSize: 13,
};

const primaryButtonStyle: CSSProperties = {
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
  background: "#fef2f2",
  color: "#991b1b",
  padding: "10px 12px",
  fontWeight: 900,
};
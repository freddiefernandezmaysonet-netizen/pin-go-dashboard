import { useMemo, useState } from "react";

type DemoResult = {
  eventId?: string;
  eventStatus?: string | null;
  eventError?: string | null;
  reservation?: any;
  checkIn?: string;
  checkOut?: string;
  paymentState?: string;
  delivery?: {
    email?: {
      enabled?: boolean;
      to?: string | null;
    };
    sms?: {
      enabled?: boolean;
      to?: string | null;
    };
    preferredLanguage?: "es" | "en";
  };
  message?: string;
  error?: string;
};

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AdminDemoCenterPage() {
  const defaultTimes = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60 * 1000);
    const end = new Date(now.getTime() + 65 * 60 * 1000);

    return {
      checkIn: toDatetimeLocalValue(start),
      checkOut: toDatetimeLocalValue(end),
    };
  }, []);

  const [checkIn, setCheckIn] = useState(defaultTimes.checkIn);
  const [checkOut, setCheckOut] = useState(defaultTimes.checkOut);
  const [guestName, setGuestName] = useState("Pin&Go Demo Guest");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"es" | "en">(
    "es"
  );
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const runDemo = async () => {
    setLoading(true);
    setResult(null);

    try {
      if (!checkIn || !checkOut) {
        setResult({ error: "Select check-in and check-out time first." });
        return;
      }

      if (!guestName.trim()) {
        setResult({ error: "Enter the demo guest name." });
        return;
      }

      if (!guestEmail.trim()) {
        setResult({ error: "Enter the email that should receive the access code." });
        return;
      }

      if (smsConsent && !guestPhone.trim()) {
        setResult({ error: "Enter a phone number before enabling SMS delivery." });
        return;
      }

      const checkInIso = new Date(checkIn).toISOString();
      const checkOutIso = new Date(checkOut).toISOString();

      if (new Date(checkOutIso) <= new Date(checkInIso)) {
        setResult({ error: "Check-out must be after check-in." });
        return;
      }

      const apiBase = (import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(
        /\/$/,
        ""
      );

      const res = await fetch(`${apiBase}/api/internal/admin/demo/run`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkIn: checkInIso,
          checkOut: checkOutIso,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim() || null,
          preferredLanguage,
          smsConsent,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setResult({
          error:
            data?.error ??
            data?.message ??
            `Demo failed with status ${res.status}`,
        });
        return;
      }

      setResult(data.data);
    } catch (err: any) {
      setResult({
        error: err?.message ?? "Demo request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const reservation = result?.reservation;
  const grant = reservation?.accessGrants?.[0];
  const nfc = reservation?.NfcAssignment?.[0];

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        display: "grid",
        gap: 24,
      }}
    >
      <section
        style={{
          borderRadius: 28,
          padding: 34,
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 55%, #1d4ed8 100%)",
          color: "#fff",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#bfdbfe",
            marginBottom: 12,
          }}
        >
          Internal Sales Tool
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 42,
            lineHeight: 1.05,
            fontWeight: 950,
          }}
        >
          Pin&Go Real Pipeline Demo
        </h1>

        <p
          style={{
            marginTop: 14,
            maxWidth: 720,
            fontSize: 16,
            lineHeight: 1.65,
            color: "#dbeafe",
          }}
        >
          Simulates a real Lodgify booking entering Pin&Go through the ingest
          pipeline. This should create the reservation, access, NFC assignment,
          payment state, and automation exactly like production.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginTop: 26,
          }}
        >
          <Field
            label="Check-in"
            value={checkIn}
            onChange={setCheckIn}
          />

          <Field
            label="Check-out"
            value={checkOut}
            onChange={setCheckOut}
          />

          <TextField
            label="Demo guest name"
            type="text"
            value={guestName}
            onChange={setGuestName}
            placeholder="Pin&Go Demo Guest"
            required
          />

          <TextField
            label="Access email"
            type="email"
            value={guestEmail}
            onChange={setGuestEmail}
            placeholder="you@example.com"
            required
          />

          <TextField
            label="Mobile phone"
            type="tel"
            value={guestPhone}
            onChange={setGuestPhone}
            placeholder="+17875550123"
            required={smsConsent}
          />

          <label
            style={{
              display: "grid",
              gap: 8,
              padding: 14,
              borderRadius: 18,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#bfdbfe",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Guest language
            </span>

            <select
              value={preferredLanguage}
              onChange={(event) =>
                setPreferredLanguage(event.target.value === "en" ? "en" : "es")
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.95)",
                padding: "11px 12px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>

          <div
            style={{
              padding: 14,
              borderRadius: 18,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#bfdbfe",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Payment
            </div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>PAID</div>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#dbeafe",
            fontWeight: 750,
            lineHeight: 1.45,
          }}
        >
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(event) => setSmsConsent(event.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            Send the access code by SMS. I confirm that this number is authorized
            to receive transactional messages for this controlled internal demo.
          </span>
        </label>

        <p
          style={{
            margin: "14px 0 0",
            color: "#bfdbfe",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Email will be sent through the production delivery flow when the
          access is created. SMS follows the same flow only when the confirmation
          above is selected.
        </p>

        <button
          onClick={runDemo}
          disabled={loading}
          style={{
            marginTop: 26,
            padding: "14px 22px",
            borderRadius: 999,
            border: "none",
            background: loading ? "#93c5fd" : "#ffffff",
            color: "#0f172a",
            fontWeight: 950,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
          }}
        >
          {loading ? "Running Real Pipeline..." : "Run Real Pipeline Demo"}
        </button>
      </section>

      {loading && (
        <section
          style={{
            borderRadius: 22,
            padding: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Processing demo booking...</h2>
          <p style={{ color: "#6b7280", marginBottom: 0 }}>
            Pin&Go is creating a Lodgify-style ingest event and running the real
            PMS pipeline.
          </p>
        </section>
      )}

      {result?.error && (
        <section
          style={{
            borderRadius: 22,
            padding: 24,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Demo failed</h2>
          <p style={{ marginBottom: 0, fontWeight: 800 }}>{result.error}</p>
        </section>
      )}

      {result && !result.error && (
        <section
          style={{
            borderRadius: 24,
            padding: 26,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 13px",
              borderRadius: 999,
              background:
                result.eventStatus === "FAILED" ? "#fee2e2" : "#dcfce7",
              color: result.eventStatus === "FAILED" ? "#991b1b" : "#166534",
              fontWeight: 950,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {result.eventStatus === "FAILED"
              ? "Pipeline Failed"
              : "Pipeline Executed"}
          </div>

          <h2 style={{ marginTop: 0 }}>Demo Result</h2>

          {result.eventError && (
            <div
              style={{
                marginBottom: 18,
                padding: 14,
                borderRadius: 16,
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontWeight: 800,
              }}
            >
              {result.eventError}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            <InfoCard label="Event Status" value={result.eventStatus ?? "—"} />
            <InfoCard label="Payment State" value={result.paymentState ?? "PAID"} />
            <InfoCard label="Reservation ID" value={reservation?.id ?? "—"} />
            <InfoCard label="Guest" value={reservation?.guestName ?? "—"} />
            <InfoCard
              label="Email delivery"
              value={
                result.delivery?.email?.enabled
                  ? `Scheduled via production flow → ${result.delivery.email.to ?? "—"}`
                  : "—"
              }
            />
            <InfoCard
              label="SMS delivery"
              value={
                result.delivery?.sms?.enabled
                  ? `Scheduled via production flow → ${result.delivery.sms.to ?? "—"}`
                  : "Not requested"
              }
            />
            <InfoCard
              label="Message language"
              value={
                result.delivery?.preferredLanguage === "es"
                  ? "Español"
                  : "English"
              }
            />
            <InfoCard label="Check-in" value={formatDate(reservation?.checkIn ?? result.checkIn)} />
            <InfoCard label="Check-out" value={formatDate(reservation?.checkOut ?? result.checkOut)} />
            <InfoCard label="Access Status" value={grant?.status ?? "—"} />
            <InfoCard
              label="Lock"
              value={
                grant?.lock?.displayName ??
                grant?.lock?.ttlockLockName ??
                grant?.lockId ??
                "—"
              }
            />
            <InfoCard
              label="Passcode"
              value={
                grant?.accessCodeMasked ??
                (grant?.ttlockKeyboardPwdId ? `TTLock ID ${grant.ttlockKeyboardPwdId}` : "—")
              }
            />
            <InfoCard
              label="NFC"
              value={
                nfc
                  ? `${nfc.status ?? "CREATED"}`
                  : "No NFC assignment found"
              }
            />
          </div>

          <details style={{ marginTop: 24 }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 900,
                color: "#1d4ed8",
              }}
            >
              View raw response
            </summary>

            <pre
              style={{
                marginTop: 12,
                padding: 16,
                borderRadius: 14,
                background: "#0f172a",
                color: "#dbeafe",
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 8,
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#bfdbfe",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>

      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(255,255,255,0.95)",
          padding: "11px 12px",
          fontWeight: 800,
          color: "#0f172a",
        }}
      />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#111827",
          fontWeight: 900,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TextField({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: "text" | "email" | "tel";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 8,
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#bfdbfe",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
        {required ? " *" : ""}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(255,255,255,0.95)",
          padding: "11px 12px",
          fontWeight: 800,
          color: "#0f172a",
        }}
      />
    </label>
  );
}

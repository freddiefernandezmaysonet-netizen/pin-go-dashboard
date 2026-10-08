import { useState } from "react";
import { requestCleanerAccount } from "../../api/cleaner";

export function CleanerAccountSetup({ staffId, linked, currentEmail, disabled, onSaved }: { staffId: string; linked: boolean; currentEmail: string | null; disabled: boolean; onSaved: () => Promise<void> }) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (linked) return <p>Cleaner account active / Cuenta de cleaner activa</p>;
  return <form onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(null); setSaved(false);
    try { await requestCleanerAccount(staffId, email); setSaved(true); await onSaved(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(code === "EMAIL_ALREADY_REGISTERED" ? "This email already has an account; it was not changed. / Este email ya tiene una cuenta; no se modificó."
        : code === "STAFF_ACCOUNT_ALREADY_LINKED" ? "This cleaner already has an account. / Este cleaner ya tiene una cuenta."
        : "Could not prepare the account. Check the email and your permissions. / No se pudo preparar la cuenta. Revisa el email y tus permisos.");
    }
    finally { setBusy(false); }
  }}>
    <label htmlFor={`cleaner-email-${staffId}`}>Cleaner account email / Email de la cuenta</label>
    <input id={`cleaner-email-${staffId}`} type="email" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} disabled={busy || disabled} style={{ display: "block", width: "100%", padding: 12, margin: "8px 0", minHeight: 48 }} />
    <button type="submit" disabled={busy || disabled} style={{ minHeight: 48 }}>Prepare account / Preparar cuenta</button>
    <p>The next cleaning confirmation includes activation. No additional SMS. / La próxima confirmación incluye la activación, sin otro SMS.</p>
    {currentEmail || saved ? <p role="status">Awaiting activation / Pendiente de activación</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}

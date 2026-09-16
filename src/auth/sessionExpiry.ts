export type SessionLoginReason = "session_expired" | "reauth_required";

export function sessionLoginReasonForError(
  errorCode: string | null | undefined
): SessionLoginReason | null {
  if (errorCode === "SESSION_EXPIRED") return "session_expired";
  if (errorCode === "SESSION_REAUTH_REQUIRED") return "reauth_required";
  return null;
}

export function loginPathForSessionError(
  errorCode: string | null | undefined
): string | null {
  const reason = sessionLoginReasonForError(errorCode);
  return reason ? `/login?reason=${reason}` : null;
}

export function sessionNoticeFromSearch(search: string): string | null {
  const reason = new URLSearchParams(search).get("reason");

  if (reason === "session_expired") {
    return "Tu sesión expiró por seguridad. Inicia sesión nuevamente. / Your session expired for security. Please sign in again.";
  }

  if (reason === "reauth_required") {
    return "Actualizamos la seguridad de tu sesión. Inicia sesión nuevamente. / We updated your session security. Please sign in again.";
  }

  return null;
}

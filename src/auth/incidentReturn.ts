// Only a canonical incident detail path may survive authentication. This is
// navigation context, never authorization; the destination rechecks access.
export function incidentReturnPath(value: unknown): string | null {
  return typeof value === "string" && /^\/pin-ai\/incidents\/GI-[A-F0-9]{12}$/.test(value)
    ? value : null;
}

export function incidentLoginPath(loginPath: string, pathname: string): string {
  const destination = incidentReturnPath(pathname);
  return destination ? `${loginPath}${loginPath.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(destination)}` : loginPath;
}

export function incidentReturnFromSearch(search: string): string | null {
  const values = new URLSearchParams(search).getAll("returnTo");
  return values.length === 1 ? incidentReturnPath(values[0]) : null;
}

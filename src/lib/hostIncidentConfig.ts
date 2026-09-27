export function canManageHostIncidents(role?: string) {
  return role === "ORG_ADMIN" || role === "ADMIN" || role === "PLATFORM_ADMIN";
}

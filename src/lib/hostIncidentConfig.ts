export const hostIncidentsEnabled = import.meta.env.VITE_PIN_AI_HOST_INCIDENT_ENABLED === "true";
export function canManageHostIncidents(role?: string) {
  return role === "ORG_ADMIN" || role === "ADMIN" || role === "PLATFORM_ADMIN";
}

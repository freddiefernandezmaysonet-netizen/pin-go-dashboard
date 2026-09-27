import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { createIncidentApi } from "../../api/hostIncidents";
import { canManageHostIncidents } from "../../lib/hostIncidentConfig";
import { HostIncidentWorkspace } from "./HostIncidentWorkspace";

const api = createIncidentApi(import.meta.env.VITE_API_BASE ?? "http://localhost:3000");
export default function HostIncidentsPage() {
  const { user, loading } = useAuth();
  const { reference } = useParams();
  const navigate = useNavigate();
  if (loading) return <p role="status">Cargando / Loading…</p>;
  if (!user?.orgId || !canManageHostIncidents(user.role)) return <Navigate to="/overview" replace />;
  return <HostIncidentWorkspace key={`${user.orgId}:${user.id}:${user.role}`} api={api} reference={reference}
    onSelect={ref => navigate(`/pin-ai/incidents/${encodeURIComponent(ref)}`)} />;
}

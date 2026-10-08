import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { RequireAuth } from "./RequireAuth";

export function RequireCleaner({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Cargando / Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "CLEANER" ? <RequireAuth>{children}</RequireAuth> : <Navigate to="/overview" replace />;
}
export function RequireHost({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Cargando / Loading…</p>;
  return user?.role === "CLEANER" ? <Navigate to="/my-cleanings" replace /> : <RequireAuth>{children}</RequireAuth>;
}

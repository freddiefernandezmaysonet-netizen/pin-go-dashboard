import { useEffect, useMemo, useState } from "react";

type TeamRole = "ADMIN" | "MEMBER" | "ORG_ADMIN" | "PLATFORM_ADMIN";

type TeamUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: TeamRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TeamUsersResponse = {
  ok: true;
  users: TeamUser[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data as T;
}

function fmt(d?: string | null) {
  if (!d) return "—";

  const dt = new Date(d);

  if (isNaN(dt.getTime())) return d;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(dt);
}

function roleStyles(role: TeamRole) {
  if (role === "ADMIN" || role === "ORG_ADMIN") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (role === "PLATFORM_ADMIN") {
    return {
      background: "#f3e8ff",
      color: "#7e22ce",
      border: "1px solid #d8b4fe",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#4b5563",
    border: "1px solid #e5e7eb",
  };
}

function activeStyles(active: boolean) {
  if (active) {
    return {
      background: "#ecfdf5",
      color: "#065f46",
      border: "1px solid #a7f3d0",
    };
  }

  return {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  };
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");

  async function loadUsers() {
    setLoading(true);
    setErr(null);

    try {
      const data = await api<TeamUsersResponse>("/api/team/users");
      setUsers(data.users);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const activeUsers = useMemo(
    () => users.filter((u) => u.isActive).length,
    [users]
  );

  async function createUser(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      const data = await api<{
        ok: true;
        temporaryPassword: string;
      }>("/api/team/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          fullName,
          role,
        }),
      });

      setEmail("");
      setFullName("");
      setRole("MEMBER");

      setSuccess(
        `User created successfully. Temporary password: ${data.temporaryPassword}`
      );

      await loadUsers();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(
    userId: string,
    role: "ADMIN" | "MEMBER"
  ) {
    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      await api(`/api/team/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      setSuccess("User role updated.");
      await loadUsers();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(user: TeamUser) {
    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      await api(`/api/team/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      setSuccess(
        user.isActive
          ? "User deactivated successfully."
          : "User activated successfully."
      );

      await loadUsers();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user: TeamUser) {
    const confirmed = window.confirm(
      `Reset password for ${user.email}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      const data = await api<{
        ok: true;
        temporaryPassword: string;
      }>(`/api/team/users/${user.id}/reset-password`, {
        method: "POST",
      });

      setSuccess(
        `Temporary password generated: ${data.temporaryPassword}`
      );

      await loadUsers();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              fontWeight: 600,
            }}
          >
            Total Users
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
              marginTop: 4,
            }}
          >
            {users.length}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              fontWeight: 600,
            }}
          >
            Active Users
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
              marginTop: 4,
            }}
          >
            {activeUsers}
          </div>
        </div>

        <div style={{ marginLeft: "auto", color: "#666", fontSize: 13 }}>
          {loading ? "Loading…" : `${users.length} users`}
        </div>
      </div>

      <form
        onSubmit={createUser}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 12,
              color: "#666",
              fontWeight: 600,
            }}
          >
            Full Name
          </div>

          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              minWidth: 200,
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 12,
              color: "#666",
              fontWeight: 600,
            }}
          >
            Email
          </div>

          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              minWidth: 240,
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 12,
              color: "#666",
              fontWeight: 600,
            }}
          >
            Role
          </div>

          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "ADMIN" | "MEMBER")
            }
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              minWidth: 140,
            }}
          >
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Creating…" : "Create User"}
        </button>
      </form>

      {err ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <b>Error:</b> {err}
        </div>
      ) : null}

      {success ? (
        <div
          style={{
            border: "1px solid #a7f3d0",
            background: "#ecfdf5",
            padding: 12,
            borderRadius: 12,
            color: "#065f46",
          }}
        >
          <b>Success:</b> {success}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                {[
                  "User",
                  "Role",
                  "Status",
                  "Last Login",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontSize: 12,
                      color: "#666",
                      padding: 12,
                      borderBottom: "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const roleStyle = roleStyles(user.role);
                  const activeStyle = activeStyles(user.isActive);

                  const lockedRole =
                    user.role === "ORG_ADMIN" ||
                    user.role === "PLATFORM_ADMIN";

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <td style={{ padding: 12 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          {user.fullName || "Unnamed User"}
                        </div>

                        <div
                          style={{
                            color: "#666",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {user.email}
                        </div>
                      </td>

                      <td style={{ padding: 12 }}>
                        {lockedRole ? (
                          <span
                            style={{
                              fontSize: 12,
                              padding: "5px 10px",
                              borderRadius: 999,
                              background: roleStyle.background,
                              color: roleStyle.color,
                              border: roleStyle.border,
                              fontWeight: 700,
                            }}
                          >
                            {user.role}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={!user.isActive || saving}
                            onChange={(e) =>
                              updateRole(
                                user.id,
                                e.target.value as "ADMIN" | "MEMBER"
                              )
                            }
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                            }}
                          >
                            <option value="MEMBER">MEMBER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        )}
                      </td>

                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: activeStyle.background,
                            color: activeStyle.color,
                            border: activeStyle.border,
                            fontWeight: 700,
                          }}
                        >
                          {user.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: 12,
                          color: "#374151",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmt(user.lastLoginAt)}
                      </td>

                      <td style={{ padding: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => resetPassword(user)}
                            disabled={!user.isActive || saving}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              cursor:
                                !user.isActive || saving
                                  ? "not-allowed"
                                  : "pointer",
                              color: "#111827",
                              fontWeight: 600,
                            }}
                          >
                            Reset Password
                          </button>

                          <button
                            onClick={() => toggleUser(user)}
                            disabled={saving}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: user.isActive
                                ? "1px solid #fecaca"
                                : "1px solid #a7f3d0",
                              background: user.isActive
                                ? "#fef2f2"
                                : "#ecfdf5",
                              cursor: saving
                                ? "not-allowed"
                                : "pointer",
                              color: user.isActive
                                ? "#991b1b"
                                : "#065f46",
                              fontWeight: 700,
                            }}
                          >
                            {user.isActive
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
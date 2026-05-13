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

const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data as T;
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");

  const activeUsers = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users]
  );

  const adminUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.isActive &&
          (user.role === "ADMIN" ||
            user.role === "ORG_ADMIN" ||
            user.role === "PLATFORM_ADMIN")
      ).length,
    [users]
  );

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<{ ok: true; users: TeamUser[] }>(
        "/api/team/users"
      );
      setUsers(data.users);
    } catch (err: any) {
      setError(err?.message || "Failed to load team users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest<{
        ok: true;
        user: TeamUser;
        temporaryPassword: string;
        message: string;
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
        `User created. Temporary password for ${data.user.email}: ${data.temporaryPassword}`
      );

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(user: TeamUser, nextRole: "ADMIN" | "MEMBER") {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest<{ ok: true; user: TeamUser }>(
        `/api/team/users/${user.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        }
      );

      setSuccess(`Role updated for ${user.email}`);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to update role");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: TeamUser) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest<{ ok: true; user: TeamUser }>(
        `/api/team/users/${user.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: !user.isActive }),
        }
      );

      setSuccess(
        user.isActive
          ? `User deactivated: ${user.email}`
          : `User activated: ${user.email}`
      );

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to update user status");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user: TeamUser) {
    const confirmed = window.confirm(
      `Generate a new temporary password for ${user.email}? Existing sessions will be invalidated.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest<{
        ok: true;
        email: string;
        temporaryPassword: string;
        message: string;
      }>(`/api/team/users/${user.id}/reset-password`, {
        method: "POST",
      });

      setSuccess(
        `Temporary password for ${data.email}: ${data.temporaryPassword}`
      );

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Organization
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Team Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Add admins and members to your organization without changing the
              existing Pin&amp;Go authentication flow.
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading || saving}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Total users</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {users.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Active users</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {activeUsers}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Admins</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {adminUsers}
            </p>
          </div>
        </div>

        {(error || success) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form
            onSubmit={createUser}
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-bold text-slate-950">
              Add team user
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The user will be created in your same organization with a
              temporary password.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Full name
                </label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Example: Maria Rivera"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="user@example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as "ADMIN" | "MEMBER")
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create user"}
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-950">
                Organization users
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Manage access for admins and members in this organization.
              </p>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-slate-600">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                No users found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600">
                        User
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600">
                        Last login
                      </th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">
                    {users.map((user) => {
                      const lockedRole =
                        user.role === "ORG_ADMIN" ||
                        user.role === "PLATFORM_ADMIN";

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-950">
                              {user.fullName || "Unnamed user"}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {user.email}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {lockedRole ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {user.role}
                              </span>
                            ) : (
                              <select
                                value={user.role}
                                disabled={saving || !user.isActive}
                                onChange={(event) =>
                                  updateRole(
                                    user,
                                    event.target.value as "ADMIN" | "MEMBER"
                                  )
                                }
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                user.isActive
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                              }`}
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {formatDate(user.lastLoginAt)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={saving || !user.isActive}
                                onClick={() => resetPassword(user)}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Reset
                              </button>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => toggleActive(user)}
                                className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  user.isActive
                                    ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                                }`}
                              >
                                {user.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
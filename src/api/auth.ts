const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "http://localhost:3000" : "");

if (!API_BASE) {
  throw new Error("Missing VITE_API_BASE");
}

function brandHostnameHeader() {
  const hostname = window.location.hostname.trim().toLowerCase();
  return hostname
    ? { "X-Pin-Go-Brand-Hostname": hostname }
    : {};
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  orgId: string;
  role?: string;
  organizationName?: string | null;
  organizationSlug?: string | null;
};

export type LoginSuccess = {
  ok: true;
  user: AuthenticatedUser;
  mfaRequired?: false;
};

export type LoginMfaRequired = {
  ok: true;
  mfaRequired: true;
  challengeToken: string;
  destination: string;
  expiresAt: string;
  resendAfterSeconds: number;
};

export type LoginResult = LoginSuccess | LoginMfaRequired;

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: brandHostnameHeader(),
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.user;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...brandHostnameHeader(),
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? "LOGIN_FAILED");
  }

  return data as LoginResult;
}

export async function verifyLoginMfa(input: {
  challengeToken: string;
  code: string;
  trustDevice: boolean;
}): Promise<{ ok: true; user: AuthenticatedUser; trustedDevice: boolean }> {
  const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...brandHostnameHeader(),
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error ?? "MFA_VERIFY_FAILED") as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }

  return data;
}

export async function resendLoginMfa(challengeToken: string): Promise<{
  ok: true;
  mfaRequired: true;
  challengeToken: string;
  destination: string;
  expiresAt: string;
  resendAfterSeconds: number;
}> {
  const res = await fetch(`${API_BASE}/auth/mfa/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...brandHostnameHeader(),
    },
    credentials: "include",
    body: JSON.stringify({ challengeToken }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error ?? "MFA_RESEND_FAILED") as Error & {
      status?: number;
      retryAfterSeconds?: number;
    };
    error.status = res.status;
    error.retryAfterSeconds = data?.retryAfterSeconds;
    throw error;
  }

  return data;
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: brandHostnameHeader(),
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("LOGOUT_FAILED");
  }
}

export async function registerOrganization(input: {
  organizationName: string;
  name: string;
  email: string;
  password: string;
  role?: "ADMIN" | "MEMBER";
}) {
  const res = await fetch(`${API_BASE}/api/auth/register-organization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      organizationName: input.organizationName,
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role ?? "ADMIN",
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? "REGISTER_ORGANIZATION_FAILED");
  }

  return data;
}

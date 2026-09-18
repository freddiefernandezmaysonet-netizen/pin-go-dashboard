import { loginPathForSessionError } from "../auth/sessionExpiry";

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

function redirectForSessionError(errorCode: string | null | undefined) {
  const path = loginPathForSessionError(errorCode);
  if (!path) return false;
  window.location.assign(path);
  return true;
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

export type AuthSessionError =
  | "SESSION_EXPIRED"
  | "SESSION_REAUTH_REQUIRED"
  | null;

export type FetchMeState = {
  user: AuthenticatedUser | null;
  sessionError: AuthSessionError;
};

function getAuthSessionError(
  errorCode: string | null | undefined
): AuthSessionError {
  return errorCode === "SESSION_EXPIRED" ||
    errorCode === "SESSION_REAUTH_REQUIRED"
    ? errorCode
    : null;
}

export async function fetchMeState(): Promise<FetchMeState> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: brandHostnameHeader(),
    credentials: "include",
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      user: null,
      sessionError:
        res.status === 401 ? getAuthSessionError(data?.error) : null,
    };
  }

  return {
    user: data.user,
    sessionError: null,
  };
}

export async function fetchMe() {
  const state = await fetchMeState();
  return state.user;
}

export async function signalSessionActivity(): Promise<{
  supported: boolean;
  active: boolean;
  touched: boolean;
  unavailable?: boolean;
  sessionError?: AuthSessionError;
}> {
  const res = await fetch(`${API_BASE}/auth/session/activity`, {
    method: "POST",
    headers: brandHostnameHeader(),
    credentials: "include",
  });
  const data = await res.json().catch(() => null);

  if (res.status === 404) {
    return { supported: false, active: true, touched: false };
  }

  if (res.status === 401) {
    return {
      supported: true,
      active: false,
      touched: false,
      sessionError: getAuthSessionError(data?.error),
    };
  }

  if (res.status === 503) {
    return {
      supported: true,
      active: true,
      touched: false,
      unavailable: true,
    };
  }

  if (!res.ok) {
    return { supported: true, active: true, touched: false };
  }

  return {
    supported: true,
    active: data?.active !== false,
    touched: data?.touched === true,
  };
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

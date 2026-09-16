/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { fetchMe, signalSessionActivity } from "../api/auth";

const SESSION_ACTIVITY_SIGNAL_INTERVAL_MS = 4 * 60 * 1000;

type User = {
  id: string;
  email: string;
  orgId: string;
  role: string;
  organizationName?: string | null;
  organizationSlug?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  async function refresh() {
    try {
      const u = await fetchMe();
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let lastSignalAt = 0;
    let inFlight = false;

    const signal = () => {
      const now = Date.now();
      if (
        inFlight ||
        now - lastSignalAt < SESSION_ACTIVITY_SIGNAL_INTERVAL_MS
      ) {
        return;
      }

      lastSignalAt = now;
      inFlight = true;
      void signalSessionActivity()
        .catch((error) => {
          console.error("[AuthProvider] session activity signal failed", error);
        })
        .finally(() => {
          inFlight = false;
        });
    };

    const signalWhenVisible = () => {
      if (document.visibilityState === "visible") {
        signal();
      }
    };

    window.addEventListener("pointerdown", signal, { passive: true });
    window.addEventListener("touchstart", signal, { passive: true });
    window.addEventListener("wheel", signal, { passive: true });
    window.addEventListener("scroll", signal, { passive: true });
    window.addEventListener("keydown", signal);
    window.addEventListener("focus", signal);
    document.addEventListener("visibilitychange", signalWhenVisible);

    return () => {
      window.removeEventListener("pointerdown", signal);
      window.removeEventListener("touchstart", signal);
      window.removeEventListener("wheel", signal);
      window.removeEventListener("scroll", signal);
      window.removeEventListener("keydown", signal);
      window.removeEventListener("focus", signal);
      document.removeEventListener("visibilitychange", signalWhenVisible);
    };
  }, [userId]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

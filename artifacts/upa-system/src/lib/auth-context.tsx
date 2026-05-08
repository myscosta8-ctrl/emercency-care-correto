import { createContext, useState, useCallback, useEffect, useRef } from "react";
import type { AuthUser } from "@workspace/api-client-react";
import { setExtraHeaders } from "@workspace/api-client-react";
import { temPermissao } from "@/lib/permissions";
import type { Acao } from "@/lib/permissions";

const AUTH_KEY        = "upa_auth_user";
const HIDDEN_KEY      = "upa_hidden_at";
const IDLE_MS         = 10 * 60 * 1000;  // 10 min sem interação
const HIDDEN_MS       = 2  * 60 * 1000;  // 2 min com página fechada/em segundo plano

const IDLE_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

function forceLogout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(HIDDEN_KEY);
  setExtraHeaders(null);
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  window.location.replace(`${base}/login`);
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export interface AuthContextValue {
  activeUser: AuthUser | null;
  isLoading:  boolean;
  login:      (login: string, password: string) => Promise<void>;
  logout:     () => void;
  setActiveLogin: (login: string) => void;
  pode:       (acao: Acao) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  activeUser:     null,
  isLoading:      false,
  login:          async () => {},
  logout:         () => {},
  setActiveLogin: () => {},
  pode:           () => false,
  refreshUser:    async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeUser, setActiveUser] = useState<AuthUser | null>(loadUser);

  useEffect(() => {
    const stored = loadUser();
    if (stored?.id) {
      setExtraHeaders({ "x-staff-id": String(stored.id) });
    }
  }, []);

  // ── Verificar se a sessão expirou enquanto a aba estava fechada ──────────
  useEffect(() => {
    const hiddenAt = localStorage.getItem(HIDDEN_KEY);
    if (hiddenAt && loadUser()) {
      const elapsed = Date.now() - Number(hiddenAt);
      if (elapsed >= HIDDEN_MS) {
        forceLogout();
        return;
      }
    }
    localStorage.removeItem(HIDDEN_KEY);
  }, []);

  // ── Timer de visibilidade (página em segundo plano / fechada) ─────────────
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeUser) return;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        // Registra o momento em que a página foi escondida
        localStorage.setItem(HIDDEN_KEY, String(Date.now()));
        // Timer local: caso a aba continue aberta mas minimizada
        hiddenTimerRef.current = setTimeout(() => {
          if (document.visibilityState === "hidden") forceLogout();
        }, HIDDEN_MS);
      } else {
        // Voltou a ser visível — checa se o tempo já expirou
        if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
        const hiddenAt = localStorage.getItem(HIDDEN_KEY);
        if (hiddenAt) {
          const elapsed = Date.now() - Number(hiddenAt);
          if (elapsed >= HIDDEN_MS) { forceLogout(); return; }
        }
        localStorage.removeItem(HIDDEN_KEY);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
    };
  }, [activeUser]);

  // ── Timer de inatividade (10 min sem interação com página aberta) ─────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeUser) return;

    function resetIdle() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (loadUser()) forceLogout();
      }, IDLE_MS);
    }

    resetIdle(); // inicia ao montar

    for (const ev of IDLE_EVENTS) {
      document.addEventListener(ev, resetIdle, { passive: true });
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      for (const ev of IDLE_EVENTS) {
        document.removeEventListener(ev, resetIdle);
      }
    };
  }, [activeUser]);

  const login = useCallback(async (loginVal: string, password: string) => {
    const base   = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const res    = await fetch(`${base}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ login: loginVal, password }),
    });
    if (!res.ok) throw new Error("Credenciais inválidas");
    const user: AuthUser = await res.json();
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    setExtraHeaders({ "x-staff-id": String(user.id) });
    setActiveUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setExtraHeaders(null);
    setActiveUser(null);
  }, []);

  const setActiveLogin = useCallback((loginVal: string) => {
    const stored = loadUser();
    if (stored && stored.login === loginVal) {
      setActiveUser(stored);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = loadUser();
    if (!stored) return;
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/api/staff/${stored.id}`, {
        headers: { "x-staff-id": String(stored.id) },
      });
      if (res.ok) {
        const s = await res.json();
        const updated: AuthUser = {
          id:                 s.id,
          login:              s.login,
          name:               s.name,
          role:               s.role,
          sector:             s.sector,
          corenCrm:           s.corenCrm ?? "",
          mustChangePassword: s.mustChangePassword ?? false,
          setoresAtuacao:     s.setoresAtuacao ?? "todos",
          turno:              s.turno ?? "",
          consultorio:        s.consultorio ?? "",
          customPermissions:  s.customPermissions ?? "",
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
        setActiveUser(updated);
      }
    } catch {
    }
  }, []);

  const pode = useCallback(
    (acao: Acao) => temPermissao(activeUser, acao),
    [activeUser],
  );

  return (
    <AuthContext.Provider value={{ activeUser, isLoading: false, login, logout, setActiveLogin, pode, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

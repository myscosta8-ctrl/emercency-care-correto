import { createContext, useState, useCallback, useEffect } from "react";
import type { AuthUser } from "@workspace/api-client-react";
import { setExtraHeaders } from "@workspace/api-client-react";
import { temPermissao } from "@/lib/permissions";
import type { Acao } from "@/lib/permissions";

const AUTH_KEY = "upa_auth_user";

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

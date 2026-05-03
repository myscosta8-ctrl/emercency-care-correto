import { createContext, useContext, useState, useEffect } from "react";
import { useListStaff } from "@workspace/api-client-react";
import type { StaffMember } from "@workspace/api-client-react";
import { temPermissao } from "@/lib/permissions";
import type { Acao } from "@/lib/permissions";

interface AuthContextValue {
  activeUser: StaffMember | null;
  isLoading: boolean;
  setActiveLogin: (login: string) => void;
  pode: (acao: Acao) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  activeUser: null,
  isLoading: true,
  setActiveLogin: () => {},
  pode: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: staff, isLoading } = useListStaff();
  const [login, setLogin] = useState<string>(
    () => localStorage.getItem("upa_active_staff") ?? ""
  );

  useEffect(() => {
    const sync = () => setLogin(localStorage.getItem("upa_active_staff") ?? "");
    window.addEventListener("upa_auth_change", sync);
    return () => window.removeEventListener("upa_auth_change", sync);
  }, []);

  const handleSetLogin = (l: string) => {
    setLogin(l);
    localStorage.setItem("upa_active_staff", l);
    window.dispatchEvent(new Event("upa_auth_change"));
  };

  const activeUser = (staff ?? []).find(m => m.login === login) ?? null;
  const pode = (acao: Acao) =>
    temPermissao(activeUser, acao);

  return (
    <AuthContext.Provider value={{ activeUser, isLoading, setActiveLogin: handleSetLogin, pode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

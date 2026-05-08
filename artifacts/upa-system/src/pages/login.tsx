import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/use-auth";
import { getRoleHome } from "@/lib/role-home";

export default function LoginPage() {
  const { activeUser, login } = useAuth();
  const [, setLocation] = useLocation();
  const [loginVal, setLoginVal]   = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeUser) setLocation(getRoleHome(activeUser.role));
  }, [activeUser, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginVal.trim() || !password) {
      setError("Preencha login e senha.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await login(loginVal.trim(), password);
    } catch {
      setError("Login ou senha incorretos. Verifique suas credenciais.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Institutional top bar */}
      <div className="bg-[#1565C0] text-white text-center py-2 text-xs font-medium tracking-wide px-4">
        SEMSA — Secretaria Municipal de Saúde · Prefeitura Municipal de Breves
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Login card */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

          {/* Card header with branding */}
          <div className="bg-[#1E88E5] px-8 py-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <img
                src={`${import.meta.env.BASE_URL}logo-sistema-transp.png`}
                alt="Emergency Care logo"
                className="h-28 w-auto object-contain drop-shadow-lg"
              />
              <div>
                <div className="text-white font-black text-lg tracking-wide leading-tight">UPA BREVES</div>
                <div className="text-blue-100 text-xs font-medium leading-snug">
                  Unidade de Pronto Atendimento
                </div>
              </div>
            </div>
            <p className="text-blue-100 text-sm font-medium mt-3">Gestão de Pacientes</p>
          </div>

          {/* Form body */}
          <div className="px-8 py-7 space-y-5">
            <p className="text-center text-sm text-gray-500 font-medium">Acesso Profissional</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login" className="text-gray-700 text-sm font-semibold">
                  Login
                </Label>
                <Input
                  id="login"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="Seu login de acesso"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value)}
                  disabled={isLoading}
                  className="border-gray-200 bg-gray-50 focus-visible:ring-[#1E88E5] focus-visible:border-[#1E88E5]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-700 text-sm font-semibold">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10 border-gray-200 bg-gray-50 focus-visible:ring-[#1E88E5] focus-visible:border-[#1E88E5]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-[#1E88E5] hover:bg-[#1565C0] text-white font-semibold rounded-lg transition-colors h-10"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando…
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    <LogIn className="h-4 w-4" />
                    Entrar no Sistema
                  </span>
                )}
              </Button>
            </form>
          </div>

          {/* Card footer */}
          <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 text-center">
            <p className="text-xs text-gray-400">
              Acesso restrito a profissionais autorizados pela UPA Breves
            </p>
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-gray-500 font-medium">
            Sistema de Gestão Hospitalar — UPA Breves
          </p>
          <p className="text-xs text-gray-400">
            © 2025 SEMSA — Prefeitura Municipal de Breves
          </p>
        </div>
      </div>
    </div>
  );
}

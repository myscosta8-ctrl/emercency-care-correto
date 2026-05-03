import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [loginVal,   setLoginVal]   = useState("");
  const [isPending,  setIsPending]  = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginVal.trim()) { setError("Informe seu login ou e-mail."); return; }
    setError("");
    setIsPending(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      await fetch(`${base}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ login: loginVal.trim() }),
      });
      setSubmitted(true);
    } catch {
      setError("Erro ao processar solicitação. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">UPA Breves</h1>
          <p className="text-sm text-muted-foreground">Redefinição de senha</p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Solicitação enviada!</p>
              <p className="text-sm text-muted-foreground">
                Um link de redefinição de senha foi enviado.<br />
                Verifique com o administrador do sistema.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/login")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao login
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu login ou e-mail cadastrado. O administrador receberá o link de redefinição.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-reset" className="text-sm">Login ou e-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-reset"
                    type="text"
                    value={loginVal}
                    onChange={e => setLoginVal(e.target.value)}
                    placeholder="Seu login ou e-mail"
                    className="pl-9"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Enviando…" : "Solicitar redefinição"}
              </Button>
            </form>
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-center transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

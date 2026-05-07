import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Activity, Eye, EyeOff, KeyRound, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const search          = useSearch();
  const params          = new URLSearchParams(search);
  const token           = params.get("token") ?? "";

  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [isPending,       setIsPending]       = useState(false);
  const [errors,          setErrors]          = useState<string[]>([]);
  const [done,            setDone]            = useState(false);
  const [apiError,        setApiError]        = useState("");

  function validate(): string[] {
    const errs: string[] = [];
    if (newPassword.length < 8) errs.push("A senha deve ter no mínimo 8 caracteres.");
    if (newPassword !== confirmPassword) errs.push("As senhas não coincidem.");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setApiError("");
    setIsPending(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res  = await fetch(`${base}/api/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Erro ao redefinir senha");
      }
      setDone(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Erro ao redefinir senha. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="font-semibold">Link inválido</p>
          <p className="text-sm text-muted-foreground">Este link de redefinição é inválido ou está incompleto.</p>
          <Button variant="outline" onClick={() => setLocation("/login")}>Voltar ao login</Button>
        </div>
      </div>
    );
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
          <p className="text-sm text-muted-foreground">Nova senha</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold">Senha redefinida!</p>
              <p className="text-sm text-muted-foreground">Sua senha foi alterada com sucesso.</p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Ir para o login
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-pwd">Nova senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-pwd"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-pwd"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {errors.length > 0 && (
                <ul className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 space-y-0.5">
                  {errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}

              {apiError && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                  {apiError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

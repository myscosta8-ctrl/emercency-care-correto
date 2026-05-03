import { useState } from "react";
import { useLocation } from "wouter";
import { ShieldAlert, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/use-auth";
import { useToast } from "@/hooks/use-toast";

async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(input);
  const hash    = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ChangePasswordPage() {
  const { activeUser, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [isPending,       setIsPending]       = useState(false);
  const [errors,          setErrors]          = useState<string[]>([]);

  function validate(): string[] {
    const errs: string[] = [];
    if (newPassword.length < 6) errs.push("A senha deve ter no mínimo 6 caracteres.");
    if (newPassword !== confirmPassword) errs.push("As senhas não coincidem.");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setIsPending(true);

    try {
      const hashed = await sha256hex(newPassword + "upa_salt_2026");
      const base   = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res    = await fetch(`${base}/api/auth/change-password`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-id":   String(activeUser?.id ?? ""),
        },
        body: JSON.stringify({ password: hashed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Erro ao alterar senha");
      }

      await refreshUser();
      toast({ title: "Senha alterada com sucesso!" });
      setLocation("/");
    } catch (err) {
      toast({
        title:       "Erro ao alterar senha",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant:     "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Alterar Senha</h1>
          <p className="text-sm text-amber-400 font-medium">
            Por segurança, você deve alterar sua senha no primeiro acesso.
          </p>
          {activeUser && (
            <p className="text-xs text-muted-foreground">
              Usuário: <span className="font-semibold text-foreground">{activeUser.name}</span>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-sm">Nova senha</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-9 pr-10"
                  autoComplete="new-password"
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
              <Label htmlFor="confirm-password" className="text-sm">Confirmar nova senha</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
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
              <ul className="text-sm text-destructive space-y-1">
                {errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          UPA Breves — Sistema de Gestão de Pacientes
        </p>
      </div>
    </div>
  );
}

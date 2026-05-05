import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./layout";
import { Key, Copy, CheckCircle, Clock, User, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

interface PendingReset {
  id: string;
  token: string;
  userId: number;
  userName: string;
  userLogin: string;
  expiresAt: string;
  createdAt: string;
}

export default function RedefinicaoSenhaPage() {
  const { activeUser } = useAuth();
  const { toast }      = useToast();
  const [resets,   setResets]   = useState<PendingReset[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const fetchResets = useCallback(async () => {
    if (!activeUser) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/auth/password-resets`, {
        headers: { "x-staff-id": String(activeUser.id) },
      });
      if (!res.ok) throw new Error();
      setResets(await res.json());
    } catch {
      toast({ title: "Erro ao carregar solicitações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeUser, base, toast]);

  useEffect(() => { fetchResets(); }, [fetchResets]);

  function copyLink(token: string, id: string) {
    const origin = window.location.origin;
    const appBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const link = `${origin}${appBase}/reset-password?token=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      toast({ title: "Link copiado!", description: "Envie o link ao usuário pelo WhatsApp ou e-mail." });
      setTimeout(() => setCopiedId(null), 3000);
    }).catch(() => {
      toast({ title: "Falha ao copiar", description: link, variant: "destructive" });
    });
  }

  function formatExpiry(dateStr: string) {
    const d    = new Date(dateStr);
    const diff = d.getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    const mins  = Math.floor(diff / 60000);
    if (mins < 60) return `Expira em ${mins} min`;
    const hours = Math.floor(mins / 60);
    return `Expira em ${hours}h ${mins % 60}min`;
  }

  return (
    <AdminLayout title="Redefinição de Senha">
      <div className="space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Redefinição de Senha</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Solicitações pendentes. Copie o link e envie ao usuário.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={fetchResets} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : resets.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            <Key className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma solicitação pendente</p>
            <p className="text-xs mt-1 opacity-70">Quando um usuário clicar em "Esqueci minha senha", o pedido aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resets.map(r => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.userLogin}</p>
                    <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatExpiry(r.expiresAt)}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={copiedId === r.id ? "default" : "outline"}
                  className={cn(
                    "gap-1.5 shrink-0 transition-colors",
                    copiedId === r.id && "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                  )}
                  onClick={() => copyLink(r.token, r.id)}
                >
                  {copiedId === r.id
                    ? <><CheckCircle className="h-4 w-4" /> Copiado!</>
                    : <><Copy className="h-4 w-4" /> Copiar link</>}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground text-sm">Como funciona</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>O usuário clica em <strong>"Esqueci minha senha"</strong> na tela de login e informa seu login.</li>
              <li>O pedido aparece aqui com um link único válido por <strong>1 hora</strong>.</li>
              <li>Você copia o link e envia ao usuário (WhatsApp, e-mail, SMS, etc.).</li>
              <li>O usuário abre o link e define uma nova senha — o link expira após o uso.</li>
            </ol>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

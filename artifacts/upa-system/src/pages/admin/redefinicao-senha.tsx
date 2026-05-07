import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./layout";
import { Key, Copy, CheckCircle, Clock, User, RefreshCw, Search, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

interface PendingReset {
  id: string;
  token: string;
  userId: number;
  userName: string;
  userLogin: string;
  userEmail?: string;
  expiresAt: string;
  createdAt: string;
}

interface StaffEntry {
  id: number;
  name: string;
  login: string;
  email: string;
  role: string;
}

export default function RedefinicaoSenhaPage() {
  const { activeUser } = useAuth();
  const { toast }      = useToast();
  const [resets,   setResets]   = useState<PendingReset[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [staffList,    setStaffList]    = useState<StaffEntry[]>([]);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [selected,     setSelected]     = useState<StaffEntry | null>(null);
  const [generating,   setGenerating]   = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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

  const fetchStaff = useCallback(async () => {
    if (!activeUser) return;
    try {
      const res = await fetch(`${base}/api/staff`, {
        headers: { "x-staff-id": String(activeUser.id) },
      });
      if (!res.ok) throw new Error();
      const data: StaffEntry[] = await res.json();
      setStaffList(data.filter(s => s.id !== activeUser.id));
    } catch {
      // silently ignore
    }
  }, [activeUser, base]);

  useEffect(() => {
    fetchResets();
    fetchStaff();
  }, [fetchResets, fetchStaff]);

  const filtered = searchQuery.trim().length > 0
    ? staffList.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.login.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    try {
      const res = await fetch(`${base}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ login: selected.login }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Link gerado!", description: `Link de redefinição criado para ${selected.name}.` });
      setSelected(null);
      setSearchQuery("");
      await fetchResets();
    } catch {
      toast({ title: "Erro ao gerar link", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  function copyLink(token: string, id: string) {
    const origin = window.location.origin;
    const appBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const link = `${origin}${appBase}/reset-password?token=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      toast({ title: "Link copiado!", description: "Envie ao usuário pelo WhatsApp, e-mail ou SMS." });
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
              Gere um link de redefinição para qualquer funcionário e envie diretamente a ele.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={fetchResets} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* ── Gerador de link ─────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Gerar link de redefinição</h2>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Buscar funcionário</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Nome ou login…"
                value={selected ? `${selected.name} (${selected.login})` : searchQuery}
                onChange={e => {
                  if (selected) setSelected(null);
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                  {filtered.slice(0, 10).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 text-left"
                      onMouseDown={() => { setSelected(s); setShowDropdown(false); }}
                    >
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.login}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full gap-2"
            disabled={!selected || generating}
            onClick={handleGenerate}
          >
            <Key className="h-4 w-4" />
            {generating ? "Gerando…" : "Gerar link de redefinição"}
          </Button>

          {selected && (
            <p className="text-xs text-muted-foreground text-center">
              Será gerado um link válido por <strong>1 hora</strong> para <strong>{selected.name}</strong>.
            </p>
          )}
        </div>

        {/* ── Links pendentes ─────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Links pendentes</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse h-20" />
              ))}
            </div>
          ) : resets.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhum link pendente</p>
              <p className="text-xs mt-1 opacity-70">Use o formulário acima para gerar um link para qualquer funcionário.</p>
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
                      <p className="text-xs text-muted-foreground truncate">Login: <span className="font-mono">{r.userLogin}</span></p>
                      {r.userEmail && (
                        <p className="text-xs text-blue-400 truncate">✉ {r.userEmail}</p>
                      )}
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
        </div>

        {/* ── Instruções ─────────────────────────────────────────── */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-sm">Como funciona</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Busque o funcionário pelo nome ou login e clique em <strong>"Gerar link de redefinição"</strong>.</li>
            <li>Copie o link gerado e envie ao usuário (WhatsApp, e-mail, SMS, etc.).</li>
            <li>O usuário abre o link e define uma nova senha — válido por <strong>1 hora</strong> e expira após o uso.</li>
          </ol>
        </div>

      </div>
    </AdminLayout>
  );
}

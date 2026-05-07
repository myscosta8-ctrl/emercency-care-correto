import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/use-auth";
import { usePode } from "@/hooks/use-pode";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowRightLeft, Plus, Send, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface NirEntry {
  id: number;
  patientId: number;
  tipo: string;
  conteudo: string;
  statusVaga: string;
  prioridade: string;
  destino: string;
  staffId: number | null;
  staffName?: string;
  createdAt: string;
}

const TIPO_CFG: Record<string, { label: string; color: string }> = {
  atualizacao:     { label: "Atualização Clínica", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  solicitacao_vaga:{ label: "Solicitação de Vaga",  color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  parecer:         { label: "Parecer NIR",           color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  pendencia:       { label: "Pendência",             color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  aguardando:  { label: "Aguardando",   color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  autorizado:  { label: "Autorizado",   color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  transferido: { label: "Transferido",  color: "bg-green-500/15 text-green-400 border-green-500/30" },
  negado:      { label: "Negado",       color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const PRIO_CFG: Record<string, { label: string; color: string }> = {
  eletivo:   { label: "Eletivo",   color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  urgente:   { label: "Urgente",   color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  emergencia:{ label: "Emergência",color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export function PatientNirTab({ patientId }: { patientId: number }) {
  const { activeUser } = useAuth();
  const pode = usePode();
  const { toast } = useToast();

  const [entries, setEntries] = useState<NirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tipo, setTipo]           = useState("atualizacao");
  const [conteudo, setConteudo]   = useState("");
  const [statusVaga, setStatusVaga] = useState("aguardando");
  const [prioridade, setPrioridade] = useState("eletivo");
  const [destino, setDestino]     = useState("");

  const canEdit = pode("mudar_setor") || pode("registrar_prescricao");

  const load = useCallback(() => {
    if (!activeUser) return;
    fetch(`/api/patients/${patientId}/nir`, {
      headers: { "x-staff-id": String(activeUser.id) },
    })
      .then(r => r.json())
      .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [patientId, activeUser]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!conteudo.trim() || !activeUser) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/patients/${patientId}/nir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-id": String(activeUser.id),
        },
        body: JSON.stringify({ tipo, conteudo, statusVaga, prioridade, destino }),
      });
      if (!resp.ok) throw new Error();
      toast({ title: "Registro NIR salvo com sucesso" });
      setConteudo("");
      setDestino("");
      load();
    } catch {
      toast({ title: "Erro ao salvar registro NIR", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Regulação / NIR
        </h3>
        {entries.length > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {entries.length}
          </span>
        )}
        <button
          type="button"
          onClick={load}
          className="ml-auto text-muted-foreground/60 hover:text-primary transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      {canEdit && (
        <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="h-3 w-3" /> Novo Registro NIR
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de Registro</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CFG).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status da Vaga</label>
              <Select value={statusVaga} onValueChange={setStatusVaga}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CFG).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prioridade Clínica</label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIO_CFG).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Destino / Unidade de Referência</label>
            <Input
              placeholder="Ex: Hospital Regional de Belém..."
              value={destino}
              onChange={e => setDestino(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Conteúdo / Atualização Clínica *
            </label>
            <Textarea
              placeholder="Descreva a situação clínica, pendências, informações para a regulação..."
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!conteudo.trim() || submitting}
              onClick={handleSubmit}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-lg border border-border/50">
          <ArrowRightLeft className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum registro de regulação ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const tipoCfg   = TIPO_CFG[entry.tipo]   ?? { label: entry.tipo,       color: "bg-muted/20 text-muted-foreground border-border/30" };
            const statusCfg = STATUS_CFG[entry.statusVaga] ?? { label: entry.statusVaga, color: "bg-muted/20 text-muted-foreground border-border/30" };
            const prioCfg   = PRIO_CFG[entry.prioridade]  ?? { label: entry.prioridade, color: "bg-muted/20 text-muted-foreground border-border/30" };
            return (
              <div key={entry.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                <div className="flex items-center flex-wrap gap-2 px-4 py-2 bg-muted/20 border-b border-border/40">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", tipoCfg.color)}>
                    {tipoCfg.label}
                  </span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", statusCfg.color)}>
                    {statusCfg.label}
                  </span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", prioCfg.color)}>
                    {prioCfg.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {entry.destino && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Destino:</span> {entry.destino}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{entry.conteudo}</p>
                  {entry.staffName && (
                    <p className="text-xs text-muted-foreground/60">{entry.staffName}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

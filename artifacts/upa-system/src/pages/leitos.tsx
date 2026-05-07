import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, BedDouble, AlertTriangle, ShieldAlert, RefreshCw, Biohazard,
  Lightbulb, Info, ShieldCheck, Plus, Trash2, Clock, Timer, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/use-auth";
import { temPermissao } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { ISOLATION_PROTOCOLS, suggestIsolationType } from "@/lib/isolation-protocols";
import type { IsolationType as IsoType } from "@/lib/isolation-protocols";

/* ─── Types ─────────────────────────────────────────────────────────── */

export type Sector =
  | "triagem"
  | "sala_vermelha"
  | "observacao_adulto"
  | "observacao_pediatrica"
  | "observacao_pre_adulto";

const SECTOR_LABELS: Record<Sector, string> = {
  triagem:                "Triagem",
  sala_vermelha:          "Sala Vermelha",
  observacao_adulto:      "Observação Adulto",
  observacao_pediatrica:  "Observação Pediátrica",
  observacao_pre_adulto:  "Pré-Observação",
};

const SECTOR_ORDER: Sector[] = [
  "triagem",
  "sala_vermelha",
  "observacao_adulto",
  "observacao_pediatrica",
  "observacao_pre_adulto",
];

const SECTOR_DOT: Record<Sector, string> = {
  triagem:                "bg-teal-500",
  sala_vermelha:          "bg-red-500",
  observacao_adulto:      "bg-blue-500",
  observacao_pediatrica:  "bg-emerald-500",
  observacao_pre_adulto:  "bg-orange-500",
};

interface BedPatient {
  id:          number;
  fullName:    string;
  triageLevel: string;
  sector:      string;
  diagnosis:   string | null;
}

interface Bed {
  id:              number;
  bedId:           string;
  sector:          Sector;
  bedNumber:       number;
  isIsolation:     boolean;
  isExtra:         boolean;
  extraReason:     string | null;
  isOccupied:      boolean;
  patientId:       number | null;
  admissionTime:   string | null;
  isolationActive: boolean;
  isolationType:   string | null;
  isolationReason: string | null;
  patient:         BedPatient | null;
}

type IsolationType = IsoType;

const ISOLATION_LABELS: Record<IsolationType, string> = {
  contact:  "Contato",
  droplet:  "Gotículas",
  airborne: "Aerossóis",
};

const ISOLATION_COLORS: Record<IsolationType, string> = {
  contact:  "text-orange-400",
  droplet:  "text-blue-400",
  airborne: "text-purple-400",
};

/* ─── Stay-time utilities ────────────────────────────────────────────── */

function stayHours(admissionTime: string | null): number {
  if (!admissionTime) return 0;
  return (Date.now() - new Date(admissionTime).getTime()) / 3_600_000;
}

function formatStay(admissionTime: string | null): string {
  if (!admissionTime) return "";
  const ms   = Date.now() - new Date(admissionTime).getTime();
  const h    = Math.floor(ms / 3_600_000);
  const m    = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function stayTextColor(hours: number): string {
  if (hours >= 24) return "text-red-400";
  if (hours >= 12) return "text-orange-400";
  if (hours >= 6)  return "text-yellow-400";
  return "text-green-400";
}

/* ─── Bed card coloring ──────────────────────────────────────────────── */

function bedColor(bed: Bed, tick: number): string {
  void tick;
  const hours = stayHours(bed.admissionTime);
  if (bed.isOccupied && hours >= 24)  return "border-red-500 bg-red-950/40 hover:bg-red-950/60";
  if (bed.isolationActive)            return "border-purple-500 bg-purple-950/40 hover:bg-purple-950/60";
  if (!bed.isOccupied)
    return bed.isExtra
      ? "border-orange-500/70 border-dashed bg-orange-950/20 hover:bg-orange-950/30"
      : "border-green-600 bg-green-950/30 hover:bg-green-950/50";
  if (bed.patient?.triageLevel === "red") return "border-red-500 bg-red-950/40 hover:bg-red-950/60";
  return "border-yellow-500 bg-yellow-950/30 hover:bg-yellow-950/50";
}

function bedDotColor(bed: Bed, tick: number): string {
  void tick;
  const hours = stayHours(bed.admissionTime);
  if (bed.isOccupied && hours >= 24) return "bg-red-400 animate-pulse";
  if (bed.isolationActive)            return "bg-purple-400";
  if (!bed.isOccupied)                return bed.isExtra ? "bg-orange-400" : "bg-green-400";
  if (bed.patient?.triageLevel === "red") return "bg-red-400";
  return "bg-yellow-400";
}

/* ─── Infection control alert box ────────────────────────────────────── */

function IsolationAlertBox({ type }: { type: IsolationType }) {
  const protocol = ISOLATION_PROTOCOLS[type];
  return (
    <div className={`rounded-lg border p-3 space-y-2.5 ${protocol.bgColor} ${protocol.borderColor}`}>
      <div className="flex items-center gap-2">
        <ShieldCheck className={`h-4 w-4 flex-shrink-0 ${protocol.color}`} />
        <p className={`text-xs font-bold uppercase tracking-wider ${protocol.color}`}>PRECAUÇÃO NECESSÁRIA</p>
        <span className="ml-auto text-lg leading-none">{protocol.icon}</span>
      </div>
      <p className={`text-sm font-semibold ${protocol.color}`}>Precaução por {protocol.label}</p>
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Usar para</p>
        <ul className="space-y-0.5">
          {protocol.indications.map(ind => (
            <li key={ind} className="text-[11px] text-white/70 flex items-start gap-1.5">
              <span className="text-white/30 mt-0.5">•</span>{ind}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-1 border-t border-white/10 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Medidas obrigatórias</p>
        <ul className="space-y-1">
          {protocol.measures.map(m => (
            <li key={m.text} className="text-[11px] text-white/80 flex items-start gap-2">
              <span className="text-base leading-none">{m.icon}</span>
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/10 pt-2">
        <Info className="h-3 w-3 text-white/30 flex-shrink-0" />
        <p className="text-[10px] text-white/40 italic">Seguir protocolo conforme ANVISA e CDC</p>
      </div>
    </div>
  );
}

/* ─── Add extra bed modal ────────────────────────────────────────────── */

interface AddExtraBedModalProps {
  sector:    Sector;
  authId:    number | undefined;
  onClose:   () => void;
  onCreated: () => void;
}

function AddExtraBedModal({ sector, authId, onClose, onCreated }: AddExtraBedModalProps) {
  const { toast }    = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/beds/extra", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authId ? { "x-staff-id": String(authId) } : {}),
        },
        body: JSON.stringify({ sector, extra_reason: reason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao criar leito extra");
      }
      toast({ title: "Leito extra criado com sucesso" });
      onCreated();
      onClose();
    } catch (e) {
      toast({ title: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-orange-400" />
            Adicionar Leito Extra
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="rounded-lg border border-orange-500/20 bg-orange-950/20 px-3 py-2">
            <p className="text-xs text-orange-300 font-medium">{SECTOR_LABELS[sector]}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              O leito extra será identificado como EXTRA e aparecerá com borda tracejada.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Motivo / justificativa (opcional)</Label>
            <Input
              className="bg-white/5 border-white/10 text-sm h-8 placeholder:text-muted-foreground/40"
              placeholder="Ex: superlotação, reforma de leito..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving ? "Criando..." : "Criar Leito Extra"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Bed detail modal ───────────────────────────────────────────────── */

interface BedModalProps {
  bed:      Bed | null;
  canEdit:  boolean;
  authId:   number | undefined;
  onClose:  () => void;
  onSaved:  () => void;
}

interface FreePatient { id: number; fullName: string; careStatus: string; triageLevel: string; }

function BedModal({ bed, canEdit, authId, onClose, onSaved }: BedModalProps) {
  const { toast } = useToast();
  const [isolationActive, setIsolationActive] = useState(false);
  const [isolationType,   setIsolationType]   = useState<IsolationType | "">("");
  const [isolationReason, setIsolationReason] = useState("");
  const [deleting,        setDeleting]        = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [tick,            setTick]            = useState(0);
  const [freePatients,    setFreePatients]    = useState<FreePatient[]>([]);
  const [assignPatientId, setAssignPatientId] = useState<number | "">("");

  useEffect(() => {
    if (!bed) return;
    setIsolationActive(bed.isolationActive);
    setIsolationType((bed.isolationType as IsolationType) ?? "");
    setIsolationReason(bed.isolationReason ?? "");
    setAssignPatientId("");
  }, [bed]);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Carrega pacientes em obs/internados sem leito quando o leito está livre
  useEffect(() => {
    if (!bed || bed.isOccupied || !canEdit) return;
    fetch("/api/patients", { headers: authId ? { "x-staff-id": String(authId) } : {} })
      .then(r => r.json())
      .then((data: { patients?: unknown[] }) => {
        const list = (data.patients ?? data) as Record<string, unknown>[];
        const eligible = list
          .filter(p =>
            (p.careStatus === "Em Observação" || p.careStatus === "Internado") &&
            !p.bedId
          )
          .map(p => ({
            id:          p.id as number,
            fullName:    p.fullName as string,
            careStatus:  p.careStatus as string,
            triageLevel: p.triageLevel as string,
          }));
        setFreePatients(eligible);
      })
      .catch(() => {});
  }, [bed, canEdit, authId]);

  if (!bed) return null;

  const suggested = suggestIsolationType(isolationReason || bed.patient?.diagnosis || "");
  const showSuggestion = isolationActive && canEdit && !!suggested && suggested !== isolationType;
  const hours = stayHours(bed.admissionTime);
  const isoColor = isolationType ? ISOLATION_COLORS[isolationType as IsolationType] : "";

  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(authId ? { "x-staff-id": String(authId) } : {}),
  });

  const handleSave = async () => {
    if (isolationActive && !isolationType) {
      toast({ title: "Selecione o tipo de isolamento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Se um paciente foi selecionado para atribuição, primeiro atualiza o status dele via /api/patients/:id/status
      if (!bed.isOccupied && assignPatientId) {
        const patRes = await fetch(`/api/patients/${assignPatientId}/status`, {
          method: "PUT", headers: headers(),
          body: JSON.stringify({ bed_id: bed.id }),
        });
        if (!patRes.ok) {
          const err = await patRes.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? "Erro ao atribuir paciente");
        }
      }
      const res = await fetch(`/api/beds/${bed.id}`, {
        method: "PUT", headers: headers(),
        body: JSON.stringify({
          isolationActive,
          isolationType:   isolationActive ? isolationType || null : null,
          isolationReason: isolationActive ? isolationReason || null : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao salvar");
      }
      toast({ title: assignPatientId ? "Paciente atribuído ao leito com sucesso" : "Leito atualizado com sucesso" });
      onSaved(); onClose();
    } catch (e) { toast({ title: String((e as Error).message), variant: "destructive" }); }
    finally     { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/beds/${bed.id}`, { method: "DELETE", headers: headers() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Erro ao remover leito");
      }
      toast({ title: `Leito ${bed.bedId} removido` });
      onSaved(); onClose();
    } catch (e) { toast({ title: String((e as Error).message), variant: "destructive" }); }
    finally     { setDeleting(false); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <BedDouble className="h-4 w-4 text-sky-400" />
            Leito {bed.bedId}
            {bed.isIsolation && (
              <Badge className="bg-purple-700/50 text-purple-200 text-[10px] border border-purple-500/40">Isolamento</Badge>
            )}
            {bed.isExtra && (
              <Badge className="bg-orange-700/50 text-orange-200 text-[10px] border border-orange-500/40 border-dashed">EXTRA</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Patient + stay time */}
          <div className="rounded-lg border border-white/8 bg-white/4 p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paciente</p>
            {bed.isOccupied && bed.patient ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{bed.patient.fullName}</p>
                    {bed.patient.diagnosis && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{bed.patient.diagnosis}</p>
                    )}
                  </div>
                  <Badge className={`flex-shrink-0 text-[10px] capitalize ${
                    bed.patient.triageLevel === "red"    ? "bg-red-800/60 text-red-200 border-red-600/40" :
                    bed.patient.triageLevel === "orange" ? "bg-orange-800/60 text-orange-200 border-orange-600/40" :
                    bed.patient.triageLevel === "yellow" ? "bg-yellow-800/60 text-yellow-200 border-yellow-600/40" :
                                                          "bg-green-800/60 text-green-200 border-green-600/40"
                  }`}>{bed.patient.triageLevel}</Badge>
                </div>

                {/* Stay time block */}
                {bed.admissionTime && (
                  <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 border ${
                    hours >= 24 ? "border-red-500/40 bg-red-950/30"    :
                    hours >= 12 ? "border-orange-500/40 bg-orange-950/30" :
                    hours >= 6  ? "border-yellow-500/40 bg-yellow-950/30" :
                                  "border-green-500/40 bg-green-950/30"
                  }`}>
                    <Timer className={`h-3.5 w-3.5 flex-shrink-0 ${stayTextColor(hours)}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${stayTextColor(hours)}`}>
                        Tempo no leito: {formatStay(bed.admissionTime)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Admitido em {new Date(bed.admissionTime).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {hours >= 24 && (
                      <span title="Tempo prolongado de permanência" className="text-red-400 text-base">⚠️</span>
                    )}
                  </div>
                )}

                {hours >= 24 && (
                  <p className="text-[11px] text-red-300 flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    Tempo prolongado de permanência
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground italic">Leito livre</p>
                {canEdit && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Atribuir paciente</Label>
                    {freePatients.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 italic">
                        Nenhum paciente em Observação/Internado sem leito no momento
                      </p>
                    ) : (
                      <Select
                        value={assignPatientId === "" ? "" : String(assignPatientId)}
                        onValueChange={v => setAssignPatientId(v === "" ? "" : Number(v))}
                      >
                        <SelectTrigger className="h-8 bg-white/5 border-white/10 text-sm">
                          <SelectValue placeholder="Selecionar paciente..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                          <SelectItem value="">— Nenhum —</SelectItem>
                          {freePatients.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.fullName}
                              <span className="ml-2 text-[10px] text-muted-foreground">({p.careStatus})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extra bed info */}
          {bed.isExtra && (
            <div className="rounded-lg border border-orange-500/20 border-dashed bg-orange-950/10 p-3 space-y-2">
              <p className="text-xs text-orange-300 font-medium flex items-center gap-1.5">
                <Plus className="h-3 w-3" />
                Leito Extra
              </p>
              {bed.extraReason && (
                <p className="text-[11px] text-muted-foreground">{bed.extraReason}</p>
              )}
              {canEdit && !bed.isOccupied && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {deleting ? "Removendo..." : "Remover leito extra"}
                </Button>
              )}
              {bed.isOccupied && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  Remova o paciente antes de excluir este leito
                </p>
              )}
            </div>
          )}

          {/* Isolation control */}
          <div className={`rounded-lg border p-3 space-y-3 ${
            bed.isIsolation ? "border-purple-500/30 bg-purple-950/20" : "border-white/6 bg-white/3 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`h-4 w-4 ${bed.isIsolation ? "text-purple-400" : "text-muted-foreground"}`} />
                <Label className={`text-sm font-medium ${bed.isIsolation ? "text-white" : "text-muted-foreground"}`}>
                  Precaução de isolamento
                </Label>
              </div>
              {canEdit ? (
                <Switch
                  checked={isolationActive}
                  onCheckedChange={v => {
                    if (!bed.isIsolation) {
                      toast({ title: "Apenas leitos de isolamento podem ativar precaução", variant: "destructive" });
                      return;
                    }
                    setIsolationActive(v);
                    if (!v) { setIsolationType(""); setIsolationReason(""); }
                  }}
                  disabled={!bed.isIsolation}
                  className="data-[state=checked]:bg-purple-600"
                />
              ) : (
                <span className={`text-xs font-medium ${isolationActive ? "text-purple-300" : "text-muted-foreground"}`}>
                  {isolationActive ? "Ativo" : "Inativo"}
                </span>
              )}
            </div>

            {!bed.isIsolation && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                Isolamento não disponível neste leito
              </p>
            )}

            {bed.isIsolation && isolationActive && (
              <div className="space-y-3 border-t border-purple-500/20 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Diagnóstico / motivo</Label>
                  {canEdit ? (
                    <Textarea
                      className="h-16 resize-none bg-white/5 border-white/10 text-sm placeholder:text-muted-foreground/50"
                      placeholder="Ex: suspeita de tuberculose..."
                      value={isolationReason}
                      onChange={e => setIsolationReason(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{isolationReason || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de precaução</Label>
                  {canEdit ? (
                    <Select value={isolationType} onValueChange={v => setIsolationType(v as IsolationType)}>
                      <SelectTrigger className="h-8 bg-white/5 border-white/10 text-sm">
                        <SelectValue placeholder="Selecionar tipo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                        <SelectItem value="contact">🧤 Contato</SelectItem>
                        <SelectItem value="droplet">😷 Gotículas</SelectItem>
                        <SelectItem value="airborne">🌬️ Aerossóis</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className={`text-sm font-medium ${isoColor}`}>
                      {isolationType ? ISOLATION_LABELS[isolationType as IsolationType] : "—"}
                    </p>
                  )}
                </div>

                {showSuggestion && (
                  <button
                    type="button"
                    onClick={() => setIsolationType(suggested!)}
                    className="w-full text-left rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-2 flex items-start gap-2 hover:bg-sky-950/60 transition-colors"
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-medium text-sky-300">Sugestão baseada no diagnóstico</p>
                      <p className="text-[11px] text-sky-400/80 mt-0.5">
                        Clicar para aplicar: <strong>{ISOLATION_LABELS[suggested!]}</strong>
                      </p>
                    </div>
                  </button>
                )}
              </div>
            )}

            {bed.isIsolation && !isolationActive && canEdit && (
              <p className="text-[11px] text-muted-foreground">
                Ative a precaução para configurar o tipo e motivo de isolamento.
              </p>
            )}
          </div>

          {isolationActive && isolationType && (
            <IsolationAlertBox type={isolationType as IsolationType} />
          )}

          {canEdit && (
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving || deleting}>Cancelar</Button>
              <Button
                size="sm" onClick={handleSave} disabled={saving || deleting}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Bed card ────────────────────────────────────────────────────────── */

interface BedCardProps {
  bed:     Bed;
  tick:    number;
  onClick: (bed: Bed) => void;
}

function BedCard({ bed, tick, onClick }: BedCardProps) {
  const hours = stayHours(bed.admissionTime);

  return (
    <button
      className={`relative rounded-lg border p-2.5 text-left transition-colors cursor-pointer w-full ${bedColor(bed, tick)}`}
      onClick={() => onClick(bed)}
      title={bed.isOccupied && bed.patient ? bed.patient.fullName : "Leito livre"}
    >
      {/* Dot */}
      <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${bedDotColor(bed, tick)}`} />

      {/* Icons top-left */}
      <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5">
        {bed.isIsolation && (
          <Biohazard className={`h-3 w-3 ${bed.isolationActive ? "text-purple-300" : "text-purple-500/50"}`} />
        )}
        {bed.isOccupied && hours >= 24 && (
          <span className="text-[10px] leading-none">⚠️</span>
        )}
      </span>

      {/* Bed ID */}
      <p className={`text-[11px] font-bold tracking-wide mt-1 ${
        (bed.isIsolation || (bed.isOccupied && hours >= 24)) ? "ml-3.5" : ""
      }`}>
        {bed.bedId}
      </p>

      {/* Extra label */}
      {bed.isExtra && (
        <span className="absolute bottom-1 right-1 text-[8px] font-bold text-orange-400/80 tracking-widest">
          EXTRA
        </span>
      )}

      {bed.isOccupied && bed.patient ? (
        <div className="mt-0.5 space-y-0.5 pr-3">
          <p className="text-[10px] font-medium text-white/90 leading-tight truncate">
            {bed.patient.fullName.split(" ")[0]}
          </p>
          {bed.admissionTime && (
            <p className={`text-[9px] leading-tight font-medium ${stayTextColor(hours)}`}>
              {formatStay(bed.admissionTime)}
            </p>
          )}
          {bed.isolationActive && bed.isolationType && (
            <p className={`text-[9px] font-medium leading-tight ${ISOLATION_COLORS[bed.isolationType as IsolationType]}`}>
              {ISOLATION_LABELS[bed.isolationType as IsolationType]}
            </p>
          )}
        </div>
      ) : (
        <p className={`mt-1 text-[10px] ${bed.isExtra ? "text-orange-400/70" : "text-green-400/70"}`}>Livre</p>
      )}
    </button>
  );
}

/* ─── Sector stats bar ────────────────────────────────────────────────── */

function SectorStats({ beds, tick }: { beds: Bed[]; tick: number }) {
  const total     = beds.length;
  const occupied  = beds.filter(b => b.isOccupied).length;
  const free      = total - occupied;
  const isolation = beds.filter(b => b.isolationActive).length;
  const over24    = beds.filter(b => b.isOccupied && stayHours(b.admissionTime) >= 24).length;
  void tick;

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
        {free} livre{free !== 1 ? "s" : ""}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />
        {occupied} ocupado{occupied !== 1 ? "s" : ""}
      </span>
      {isolation > 0 && (
        <span className="flex items-center gap-1 text-purple-400">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 inline-block" />
          {isolation} iso
        </span>
      )}
      {over24 > 0 && (
        <span className="flex items-center gap-1 text-red-400">
          ⚠️ {over24} &gt;24h
        </span>
      )}
      <span className="text-white/30">|</span>
      <span className="text-white/50">{occupied}/{total}</span>
    </div>
  );
}

/* ─── Global stay stats panel ─────────────────────────────────────────── */

function GlobalStatsPanel({ beds, tick }: { beds: Bed[]; tick: number }) {
  void tick;
  const occupied = beds.filter(b => b.isOccupied && b.admissionTime);
  if (occupied.length === 0) return null;

  const hoursArr  = occupied.map(b => stayHours(b.admissionTime));
  const avgHours  = hoursArr.reduce((s, h) => s + h, 0) / hoursArr.length;
  const maxHours  = Math.max(...hoursArr);
  const over24    = hoursArr.filter(h => h >= 24).length;

  const fmt = (h: number) => `${Math.floor(h)}h ${Math.floor((h % 1) * 60)}m`;

  return (
    <div className="rounded-lg border border-white/6 bg-white/3 px-4 py-3 flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-[11px] text-muted-foreground">Permanência média:</span>
        <span className={`text-[11px] font-semibold ${stayTextColor(avgHours)}`}>{fmt(avgHours)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-yellow-400" />
        <span className="text-[11px] text-muted-foreground">Maior permanência:</span>
        <span className={`text-[11px] font-semibold ${stayTextColor(maxHours)}`}>{fmt(maxHours)}</span>
      </div>
      {over24 > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-950/20 px-2 py-0.5">
          <AlertTriangle className="h-3 w-3 text-red-400" />
          <span className="text-[11px] font-semibold text-red-300">{over24} paciente{over24 !== 1 ? "s" : ""} &gt; 24h</span>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────── */

export default function LeitosPage() {
  const { activeUser } = useAuth();
  const [beds,           setBeds]           = useState<Bed[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedBed,    setSelectedBed]    = useState<Bed | null>(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [extraSector,    setExtraSector]    = useState<Sector | null>(null);
  const [tick,           setTick]           = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canEdit = temPermissao(
    activeUser ? { role: activeUser.role } : null,
    "registrar_sinais_vitais",
  );

  const fetchBeds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    try {
      const res = await fetch("/api/beds", {
        headers: activeUser ? { "x-staff-id": String(activeUser.id) } : {},
      });
      if (res.ok) setBeds(await res.json() as Bed[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUser]);

  useEffect(() => { fetchBeds(); }, [fetchBeds]);

  /* Auto-refresh every 30 seconds (data + stay time tick) */
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTick(v => v + 1);
      fetchBeds(true);
    }, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchBeds]);

  const bedsBySector = useMemo(() => SECTOR_ORDER.map(sector => ({
    sector,
    beds: beds.filter(b => b.sector === sector).sort((a, b) => a.bedNumber - b.bedNumber),
  })), [beds]);

  const totalOccupied   = beds.filter(b => b.isOccupied).length;
  const totalBeds       = beds.length;
  const totalIsolations = beds.filter(b => b.isolationActive).length;
  const totalOver24     = beds.filter(b => b.isOccupied && stayHours(b.admissionTime) >= 24).length;

  return (
    <div className="min-h-screen bg-[#080c10] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/6 bg-[#080c10]/95 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-sky-400" />
              <h1 className="text-sm font-semibold">Gestão de Leitos</h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground">
            <span><span className="text-white font-medium">{totalOccupied}</span>/{totalBeds} ocupados</span>
            {totalIsolations > 0 && (
              <span className="flex items-center gap-1 text-purple-300">
                <ShieldAlert className="h-3 w-3" />
                {totalIsolations} iso
              </span>
            )}
            {totalOver24 > 0 && (
              <span className="flex items-center gap-1 text-red-300 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {totalOver24} &gt;24h
              </span>
            )}
          </div>

          <Button
            variant="ghost" size="sm" onClick={() => fetchBeds(true)} disabled={refreshing}
            className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">Atualizar</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-6 space-y-5">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground px-1">
          <span className="font-medium text-white/40 uppercase tracking-wide text-[10px]">Legenda:</span>
          {[
            { color: "bg-green-500",  label: "Livre" },
            { color: "bg-yellow-500", label: "Ocupado" },
            { color: "bg-red-500",    label: "Crítico / &gt;24h" },
            { color: "bg-purple-500", label: "Isolamento" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5" dangerouslySetInnerHTML={{ __html:
              `<span class="h-2.5 w-2.5 rounded ${color} opacity-80 inline-block"></span> ${label}` }} />
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded border border-dashed border-orange-500/70 inline-block" />
            Extra
          </span>
          <span className="flex items-center gap-1.5">
            <Biohazard className="h-3 w-3 text-purple-400" /> Iso disponível
          </span>
          <span className="flex items-center gap-1.5 text-[10px]">
            <span className="text-green-400 font-mono">&lt;6h</span>
            <span className="text-yellow-400 font-mono">6–12h</span>
            <span className="text-orange-400 font-mono">12–24h</span>
            <span className="text-red-400 font-mono">&gt;24h</span>
            <span className="text-muted-foreground">permanência</span>
          </span>
        </div>

        {/* Global stay stats */}
        {!loading && <GlobalStatsPanel beds={beds} tick={tick} />}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />Carregando leitos...
          </div>
        ) : (
          bedsBySector.map(({ sector, beds: sectorBeds }) => (
            <section key={sector} className="space-y-3">
              {/* Sector header */}
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${SECTOR_DOT[sector]}`} />
                  {SECTOR_LABELS[sector]}
                </h2>
                <div className="flex items-center gap-3">
                  <SectorStats beds={sectorBeds} tick={tick} />
                  {canEdit && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setExtraSector(sector)}
                      className="h-6 px-2 text-[10px] text-orange-400/70 hover:text-orange-300 hover:bg-orange-950/30 gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Leito Extra
                    </Button>
                  )}
                </div>
              </div>

              {/* Bed grid */}
              <div className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))" }}>
                {sectorBeds.map(bed => (
                  <BedCard key={bed.id} bed={bed} tick={tick} onClick={setSelectedBed} />
                ))}
              </div>
            </section>
          ))
        )}

        {!loading && beds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <BedDouble className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum leito cadastrado</p>
          </div>
        )}
      </main>

      {/* Modals */}
      <BedModal
        bed={selectedBed}
        canEdit={canEdit}
        authId={activeUser?.id}
        onClose={() => setSelectedBed(null)}
        onSaved={() => fetchBeds(true)}
      />

      {extraSector && (
        <AddExtraBedModal
          sector={extraSector}
          authId={activeUser?.id}
          onClose={() => setExtraSector(null)}
          onCreated={() => fetchBeds(true)}
        />
      )}
    </div>
  );
}

import { useState, useEffect, memo } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, BedDouble, Clock, PhoneCall, RefreshCw,
  Pencil, LogOut, FlaskConical,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { useUpdatePatientStatus } from "@workspace/api-client-react";
import type { Patient, PatientPendingExamsItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BedPickerInline } from "@/components/bed-picker-inline";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TRIAGE_CONFIG, CARE_STATUS_CONFIG, CARE_STATUS_KEYS,
  type TriageKey, type CareStatusKey,
  minutesSince, hoursSince, formatElapsed,
} from "@/lib/care-status-config";

export const BED_SECTORS    = new Set(["sala_vermelha", "observacao_adulto", "observacao_pediatrica", "observacao_pre_adulto"]);
export const RECLASSIFY_ROLES    = new Set(["enfermeiro", "administrador", "diretoria_geral"]);
export const RECLASSIFY_STATUSES = new Set(["Em Triagem", "Aguardando Atendimento"]);

export interface PatientRowProps {
  patient: Patient;
  onEdit: (p: Patient) => void;
  onAlta: (p: Patient) => void;
  onReclassify: (p: Patient) => void;
  onChamarTriagem?: (p: Patient) => void;
  isCritical?: boolean;
  criticalDetail?: string;
  pendingExams?: PatientPendingExamsItem[];
}

export const PatientRow = memo(function PatientRow({
  patient, onEdit, onAlta, onReclassify, onChamarTriagem,
  isCritical = false, criticalDetail, pendingExams,
}: PatientRowProps) {
  const { pode, activeUser } = useAuth();
  const cfg   = TRIAGE_CONFIG[patient.triage_level as TriageKey]   ?? TRIAGE_CONFIG.blue;
  const csCfg = CARE_STATUS_CONFIG[patient.careStatus as CareStatusKey] ?? CARE_STATUS_CONFIG["Em Triagem"];

  const careStatus     = patient.careStatus as CareStatusKey;
  const agTriagemAlert = careStatus === "Aguardando Triagem" && minutesSince(patient.createdAt) > 15;
  const triageAlert    = careStatus === "Em Triagem"         && minutesSince(patient.createdAt) > 30;
  const obsAlert       = careStatus === "Em Observação"      && hoursSince(patient.careStatusChangedAt as string) > 6;
  const hasTimeAlert   = agTriagemAlert || triageAlert || obsAlert;

  return (
    <div className={cn(
      "group relative flex items-stretch border-l-4 border-b border-border/30 last:border-b-0 transition-colors",
      isCritical
        ? "border-l-red-500 bg-red-50"
        : cn(cfg.border, "hover:bg-muted/20"),
    )}>
      {isCritical && (
        <div className="absolute inset-0 bg-red-100/60 animate-pulse pointer-events-none" />
      )}

      <Link href={`/patients/${patient.id}`} className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0 cursor-pointer">
        <div className="w-11 shrink-0 text-center">
          {isCritical ? (
            <AlertTriangle className="h-4 w-4 text-red-400 mx-auto animate-pulse" />
          ) : (
            <div className="text-sm font-mono font-bold text-foreground leading-tight">
              {patient.bed || <BedDouble className="h-3.5 w-3.5 text-muted-foreground mx-auto" />}
            </div>
          )}
        </div>

        <div className={cn(
          "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded leading-tight hidden md:block",
          isCritical ? "bg-red-100 text-red-700" : cn(cfg.bg, cfg.text),
        )}>
          {isCritical ? "⚠ CRÍTICO" : cfg.label}
        </div>
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0 md:hidden",
          isCritical ? "bg-red-500 animate-pulse" : cfg.dot,
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "font-semibold text-sm leading-tight truncate",
              isCritical ? "text-red-700" : "text-foreground",
            )}>
              {patient.full_name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{patient.age}a</span>

            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0 rounded border leading-5 shrink-0",
              csCfg.bg, csCfg.color, csCfg.border,
            )}>
              {csCfg.label}
            </span>

            {hasTimeAlert && (
              <span className={cn(
                "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0 rounded border leading-5 shrink-0",
                agTriagemAlert ? "bg-amber-100 text-amber-700 border-amber-300"
                  : triageAlert ? "bg-orange-100 text-orange-700 border-orange-300"
                  : "bg-purple-100 text-purple-700 border-purple-300",
              )}>
                <Clock className="h-2.5 w-2.5" />
                {agTriagemAlert
                  ? `Ag. ${formatElapsed(patient.createdAt)}`
                  : triageAlert
                  ? `Triagem ${formatElapsed(patient.createdAt)}`
                  : `Obs. ${formatElapsed(patient.careStatusChangedAt as string)}`}
              </span>
            )}
          </div>

          {isCritical && criticalDetail ? (
            <p className="text-xs font-semibold text-red-600 leading-tight mt-0.5">{criticalDetail}</p>
          ) : patient.diagnosis ? (
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{patient.diagnosis}</p>
          ) : null}

          {pendingExams && pendingExams.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {pendingExams.slice(0, 3).map(ex => {
                const names = [...ex.laboratoriais, ...ex.imagem];
                const label = names.length > 0 ? names.slice(0, 2).join(", ") : (ex.laboratoriais.length > 0 ? "Lab" : "Imagem");
                const urgentCls = ex.prioridade === "urgente"
                  ? "bg-amber-100 text-amber-700 border-amber-300"
                  : "bg-cyan-100 text-cyan-700 border-cyan-300";
                return (
                  <span key={ex.id} className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0 rounded border leading-5",
                    urgentCls,
                  )}>
                    <FlaskConical className="h-2.5 w-2.5" />
                    {label}
                    {ex.prioridade === "urgente" && <span className="ml-0.5 opacity-80">⚡</span>}
                  </span>
                );
              })}
              {pendingExams.length > 3 && (
                <span className="text-[10px] text-cyan-600 leading-5">+{pendingExams.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {isCritical && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-300 uppercase tracking-wider shrink-0 hidden sm:inline-flex items-center gap-1">
            PACIENTE CRÍTICO
          </span>
        )}
      </Link>

      <div className="flex items-center gap-0.5 px-1.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        {patient.careStatus === "Aguardando Triagem" &&
         RECLASSIFY_ROLES.has(activeUser?.role ?? "") &&
         pode("mudar_setor") &&
         onChamarTriagem && (
          <button
            type="button"
            title="Chamar paciente para triagem"
            onClick={e => { e.preventDefault(); onChamarTriagem(patient); }}
            className="h-8 px-2 flex items-center justify-center gap-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 hover:text-blue-700 text-[10px] font-bold transition-colors whitespace-nowrap"
          >
            <PhoneCall className="h-3 w-3" />
            Chamar
          </button>
        )}
        {pode("mudar_setor") &&
         RECLASSIFY_ROLES.has(activeUser?.role ?? "") &&
         (RECLASSIFY_STATUSES.has(patient.careStatus ?? "") || patient.sector === "sala_vermelha") && (
          <button
            type="button"
            title="Reclassificar paciente"
            onClick={e => { e.preventDefault(); onReclassify(patient); }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        {pode("editar_paciente") && (
          <button
            type="button"
            title="Editar"
            onClick={e => { e.preventDefault(); onEdit(patient); }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {pode("excluir_paciente") && (
          <button
            type="button"
            title="Alta"
            onClick={e => { e.preventDefault(); onAlta(patient); }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

interface ReclassifyModalProps {
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
}

export function ReclassifyModal({ patient, onClose, onSuccess, userId }: ReclassifyModalProps) {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const reclassify = useUpdatePatientStatus();
  const [triageLevel,      setTriageLevel]      = useState<string>("");
  const [careStatus,       setCareStatus]       = useState<string>("");
  const [selectedBedId,    setSelectedBedId]    = useState<number | null>(null);
  const [alertaEnfermeiro, setAlertaEnfermeiro] = useState<string>("");

  const needsBedPick = (careStatus === "Em Observação" || careStatus === "Internado")
    && BED_SECTORS.has(patient?.sector ?? "");

  useEffect(() => {
    if (patient) {
      setTriageLevel(patient.triage_level);
      setCareStatus(patient.careStatus as string);
      setSelectedBedId(null);
      setAlertaEnfermeiro((patient as unknown as Record<string, unknown>).alertaEnfermeiro as string ?? "");
    }
  }, [patient]);

  useEffect(() => { setSelectedBedId(null); }, [careStatus]);

  const triageLevels = [
    { value: "red",    label: "Vermelho — Emergência" },
    { value: "orange", label: "Laranja — Muito Urgente" },
    { value: "yellow", label: "Amarelo — Urgente" },
    { value: "green",  label: "Verde — Pouco Urgente" },
    { value: "blue",   label: "Azul — Não Urgente" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (needsBedPick && !selectedBedId) {
      toast({ title: "Selecione um leito para continuar", variant: "destructive" });
      return;
    }
    reclassify.mutate(
      {
        id: patient.id,
        data: {
          triage_level: triageLevel as "red" | "orange" | "yellow" | "green" | "blue",
          care_status: careStatus as "Em Triagem" | "Aguardando Atendimento" | "Em Atendimento (Cons. 1)" | "Em Atendimento (Cons. 2)" | "Em Observação" | "Internado" | "Em Transferência" | "Alta",
          user_id: userId,
          alertaEnfermeiro,
          ...(selectedBedId ? { bed_id: selectedBedId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Paciente reclassificado com sucesso" });
          onSuccess();
        },
        onError: () => toast({ title: "Erro ao reclassificar paciente", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={!!patient} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reclassificar Paciente</DialogTitle>
          <DialogDescription>
            {patient?.full_name} — altere triagem e/ou status de cuidado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nível de Triagem (Manchester)
            </label>
            <select
              value={triageLevel}
              onChange={e => setTriageLevel(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {triageLevels.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status de Cuidado
            </label>
            <select
              value={careStatus}
              onChange={e => setCareStatus(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CARE_STATUS_KEYS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(careStatus === "Em Triagem" || careStatus === "Aguardando Atendimento") && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠ Pacientes neste status são exibidos na área de Recepção/Triagem.
              </p>
            )}
            {(careStatus === "Em Medicação" || careStatus === "Aguardando Exames" || careStatus === "Aguardando Reavaliação") && (
              <p className="text-[11px] text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-2 py-1">
                ℹ Status de acompanhamento pós-consulta — paciente permanece no setor atual.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1">
              ⚠ Alerta de Gravidade (visível ao médico)
            </label>
            <textarea
              value={alertaEnfermeiro}
              onChange={e => setAlertaEnfermeiro(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Ex: Febre 40°C, Picada de cobra há 5h, Angina com irradiação..."
              className="w-full rounded-md border border-orange-500/40 bg-orange-950/20 px-3 py-2 text-sm text-orange-100 placeholder:text-orange-400/40 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Esta nota aparece em destaque na fila médica. Deixe em branco para limpar o alerta.
            </p>
          </div>

          {needsBedPick && (
            <BedPickerInline
              sector={patient?.sector ?? ""}
              authId={activeUser?.id}
              selectedBedId={selectedBedId}
              onSelect={id => setSelectedBedId(id)}
            />
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1"
              disabled={reclassify.isPending || (needsBedPick && !selectedBedId)}
            >
              {reclassify.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, Users, Activity, RotateCcw, Plus, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── types ───────────────────────────────────────────────────────────────────

interface PatientAlert {
  id: number;
  patientId: number;
  type: "alergia" | "risco_queda" | "isolamento" | "critico" | "retorno_72h" | "outro";
  descricao: string;
  ativo: boolean;
  createdAt: string;
  createdByName: string;
  deactivatedAt: string | null;
  deactivatedByName: string;
  motivoDesativacao: string;
}

// ── config ──────────────────────────────────────────────────────────────────

const ALERT_CONFIG: Record<PatientAlert["type"], {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}> = {
  alergia:     { label: "Alergia",          icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/40" },
  risco_queda: { label: "Risco de Queda",   icon: ShieldAlert,   color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/40" },
  isolamento:  { label: "Isolamento",       icon: Users,         color: "text-violet-400", bg: "bg-violet-500/15", border: "border-violet-500/40" },
  critico:     { label: "Paciente Crítico", icon: Activity,      color: "text-red-300",    bg: "bg-red-900/30",    border: "border-red-400/50" },
  retorno_72h: { label: "Retorno <72h",     icon: RotateCcw,     color: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/40" },
  outro:       { label: "Outro",            icon: AlertTriangle, color: "text-cyan-400",   bg: "bg-cyan-500/15",   border: "border-cyan-500/40" },
};

const ALERT_TYPE_OPTIONS: PatientAlert["type"][] = [
  "alergia", "risco_queda", "isolamento", "critico", "retorno_72h", "outro",
];

// ── API helpers ─────────────────────────────────────────────────────────────

function getStaffId(): string {
  return localStorage.getItem("upa_staff_id") ?? "0";
}

async function fetchAlerts(patientId: number): Promise<PatientAlert[]> {
  const r = await fetch(`/api/patients/${patientId}/alerts`, {
    headers: { "x-staff-id": getStaffId() },
  });
  if (!r.ok) return [];
  return r.json();
}

async function createAlert(patientId: number, body: {
  type: PatientAlert["type"]; descricao: string; createdByName: string;
}): Promise<PatientAlert> {
  const r = await fetch(`/api/patients/${patientId}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-staff-id": getStaffId() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Erro ao criar alerta");
  return r.json();
}

async function deactivateAlert(patientId: number, alertId: number, body: {
  deactivatedByName: string; motivoDesativacao: string;
}): Promise<PatientAlert> {
  const r = await fetch(`/api/patients/${patientId}/alerts/${alertId}/deactivate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-staff-id": getStaffId() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Erro ao desativar alerta");
  return r.json();
}

// ── component ────────────────────────────────────────────────────────────────

interface Props {
  patientId: number;
  userName: string;
}

export function PatientAlertsPanel({ patientId, userName }: Props) {
  const qc = useQueryClient();
  const alertsKey = ["patient-alerts", patientId];

  const { data: alerts = [] } = useQuery({
    queryKey: alertsKey,
    queryFn: () => fetchAlerts(patientId),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<PatientAlert["type"]>("alergia");
  const [newDescricao, setNewDescricao] = useState("");

  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [deactMotivo, setDeactMotivo] = useState("");

  const [showInactive, setShowInactive] = useState(false);

  const createMut = useMutation({
    mutationFn: () => createAlert(patientId, { type: newType, descricao: newDescricao, createdByName: userName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertsKey });
      setShowForm(false);
      setNewDescricao("");
      setNewType("alergia");
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (alertId: number) => deactivateAlert(patientId, alertId, { deactivatedByName: userName, motivoDesativacao: deactMotivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertsKey });
      setDeactivatingId(null);
      setDeactMotivo("");
    },
  });

  const activeAlerts   = alerts.filter(a => a.ativo);
  const inactiveAlerts = alerts.filter(a => !a.ativo);

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border/40">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex-1">
          Alertas Clínicos
        </span>
        {activeAlerts.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {activeAlerts.length} ativo{activeAlerts.length !== 1 ? "s" : ""}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs gap-1"
          onClick={() => setShowForm(v => !v)}
        >
          <Plus className="h-3 w-3" />
          Novo
        </Button>
      </div>

      {/* New alert form */}
      {showForm && (
        <div className="px-3 py-3 bg-amber-500/5 border-b border-amber-500/20 space-y-2">
          <div className="flex gap-2 flex-wrap">
            {ALERT_TYPE_OPTIONS.map(type => {
              const cfg = ALERT_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewType(type)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors",
                    newType === type
                      ? cn(cfg.bg, cfg.color, cfg.border)
                      : "border-border/40 text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <Input
            className="h-8 text-sm"
            placeholder="Descrição do alerta (ex: alergia a dipirona, risco de queda alto...)"
            value={newDescricao}
            onChange={e => setNewDescricao(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newDescricao.trim()) createMut.mutate();
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1"
              disabled={!newDescricao.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <Plus className="h-3 w-3" />
              Registrar Alerta
            </Button>
          </div>
        </div>
      )}

      {/* Active alerts */}
      <div className="divide-y divide-border/25">
        {activeAlerts.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground/50">
            Nenhum alerta clínico ativo
          </div>
        ) : (
          activeAlerts.map(alert => {
            const cfg = ALERT_CONFIG[alert.type];
            const Icon = cfg.icon;
            const isDeactivating = deactivatingId === alert.id;
            return (
              <div key={alert.id} className={cn("px-3 py-2.5 border-l-4", cfg.border)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-xs font-bold", cfg.color)}>{cfg.label}</span>
                      {alert.descricao && (
                        <span className="text-xs text-foreground">{alert.descricao}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Registrado por {alert.createdByName || "—"} em {new Date(alert.createdAt).toLocaleString("pt-BR")}
                    </p>
                    {/* Deactivate inline form */}
                    {isDeactivating && (
                      <div className="mt-2 flex gap-2 items-center flex-wrap">
                        <Input
                          className="h-7 text-xs flex-1 min-w-[160px]"
                          placeholder="Motivo da desativação (opcional)"
                          value={deactMotivo}
                          onChange={e => setDeactMotivo(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") deactivateMut.mutate(alert.id);
                            if (e.key === "Escape") { setDeactivatingId(null); setDeactMotivo(""); }
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          variant="outline"
                          disabled={deactivateMut.isPending}
                          onClick={() => deactivateMut.mutate(alert.id)}
                        >
                          <Check className="h-3 w-3" />
                          Confirmar
                        </Button>
                        <Button
                          size="sm" className="h-7 text-xs" variant="ghost"
                          onClick={() => { setDeactivatingId(null); setDeactMotivo(""); }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                  {!isDeactivating && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      title="Desativar alerta"
                      onClick={() => setDeactivatingId(alert.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Inactive alerts toggle */}
      {inactiveAlerts.length > 0 && (
        <div className="border-t border-border/25">
          <button
            type="button"
            className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/20 transition-colors"
            onClick={() => setShowInactive(v => !v)}
          >
            {showInactive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {inactiveAlerts.length} alerta(s) desativado(s)
          </button>
          {showInactive && (
            <div className="divide-y divide-border/20">
              {inactiveAlerts.map(alert => {
                const cfg = ALERT_CONFIG[alert.type];
                const Icon = cfg.icon;
                return (
                  <div key={alert.id} className="px-3 py-2 flex items-start gap-2 opacity-50">
                    <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1.5 items-center flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground line-through">{cfg.label}</span>
                        {alert.descricao && <span className="text-xs text-muted-foreground/70 line-through">{alert.descricao}</span>}
                      </div>
                      {alert.motivoDesativacao && (
                        <p className="text-[10px] text-muted-foreground/60">Motivo: {alert.motivoDesativacao}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/50">
                        Desativado por {alert.deactivatedByName || "—"} em {alert.deactivatedAt ? new Date(alert.deactivatedAt).toLocaleString("pt-BR") : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

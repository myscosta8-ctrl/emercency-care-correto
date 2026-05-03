import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useGetPatientPharmacyEntries,
  useAddPatientPharmacyEntry,
  useUpdatePharmacyEntryStatus,
  getGetPatientPharmacyEntriesQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pill, CheckCircle, XCircle, Clock, ChevronRight, ArrowLeft, Plus } from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

const TRIAGE = {
  red:    { dot: "bg-red-500",    label: "Vermelho",  order: 0 },
  orange: { dot: "bg-orange-500", label: "Laranja",   order: 1 },
  yellow: { dot: "bg-yellow-400", label: "Amarelo",   order: 2 },
  green:  { dot: "bg-green-500",  label: "Verde",     order: 3 },
  blue:   { dot: "bg-blue-500",   label: "Azul",      order: 4 },
} as const;
type TriageKey = keyof typeof TRIAGE;

type PharmStatus = "pendente" | "dispensado" | "devolvido";

const STATUS_CONFIG: Record<PharmStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pendente:   { label: "Pendente",   icon: Clock,       color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  dispensado: { label: "Dispensado", icon: CheckCircle, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
  devolvido:  { label: "Devolvido",  icon: XCircle,     color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
};

function PharmacyPanel({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeUser } = useAuth();
  const [filter, setFilter]         = useState<PharmStatus>("pendente");
  const [showForm, setShowForm]     = useState(false);
  const [medication, setMedication] = useState("");
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);
  const { data: entries, isLoading } = useGetPatientPharmacyEntries(patient.id, {
    query: { enabled: true, queryKey: getGetPatientPharmacyEntriesQueryKey(patient.id) },
  });
  const addEntry     = useAddPatientPharmacyEntry();
  const updateStatus = useUpdatePharmacyEntryStatus();

  const t = TRIAGE[(patient.triage_level ?? "blue") as TriageKey];
  const filtered = (entries ?? []).filter(e => e.status === filter);

  const handleAdd = async () => {
    if (!medication.trim()) return;
    setSaving(true);
    try {
      await addEntry.mutateAsync({
        id: patient.id,
        data: {
          userId:     activeUser?.id ?? 0,
          medication: medication.trim(),
          status:     "pendente",
          notes:      notes.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPatientPharmacyEntriesQueryKey(patient.id) });
      toast({ title: "Medicamento registrado" });
      setMedication(""); setNotes(""); setShowForm(false); setFilter("pendente");
    } catch {
      toast({ title: "Erro ao registrar medicamento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (entryId: number, status: PharmStatus) => {
    try {
      await updateStatus.mutateAsync({
        id: patient.id,
        entryId,
        data: { status },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPatientPharmacyEntriesQueryKey(patient.id) });
      toast({ title: status === "dispensado" ? "Medicamento dispensado" : "Medicamento devolvido" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="md:hidden p-1 hover:bg-muted rounded">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", t.dot)} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{patient.full_name}</p>
          <p className="text-xs text-muted-foreground">{t.label}</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs shrink-0" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3 w-3" />
          Novo
        </Button>
      </div>

      {showForm && (
        <div className="border-b border-border p-4 space-y-2 bg-muted/10 shrink-0">
          <div className="space-y-1">
            <Label className="text-xs">Medicamento *</Label>
            <Input
              value={medication}
              onChange={e => setMedication(e.target.value)}
              placeholder="Ex: Dipirona 500mg VO 6/6h"
              className="h-9 text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Dosagem, via, observações..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !medication.trim()} className="flex-1">
              {saving ? "Salvando..." : "Registrar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="flex border-b border-border shrink-0">
        {(["pendente", "dispensado", "devolvido"] as PharmStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = (entries ?? []).filter(e => e.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "flex-1 py-2 text-xs font-medium transition-colors",
                filter === s ? `${cfg.color} border-b-2 border-current` : "text-muted-foreground hover:text-foreground",
              )}
            >
              {cfg.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Pill className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum medicamento com status "{STATUS_CONFIG[filter].label}"</p>
          </div>
        )}
        {filtered.map(entry => {
          const cfg = STATUS_CONFIG[(entry.status ?? "pendente") as PharmStatus];
          const Icon = cfg.icon;
          return (
            <div key={entry.id} className={cn("rounded-lg border p-3 flex items-start gap-3", cfg.bg)}>
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{entry.medication}</p>
                {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(entry.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
              {entry.status === "pendente" && (
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatus(entry.id, "dispensado")}
                  >
                    Dispensar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => handleStatus(entry.id, "devolvido")}
                  >
                    Devolver
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FarmaciaPage() {
  const [selected, setSelected] = useState<Patient | null>(null);
  const { data: patients } = useListPatients();

  const sorted = (patients ?? []).sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3, blue: 4 };
    return (order[a.triage_level as TriageKey] ?? 4) - (order[b.triage_level as TriageKey] ?? 4);
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader title="Farmácia — Dispensação de Medicamentos" />

      <div className="flex flex-1 overflow-hidden">
        <aside className={cn(
          "border-r border-border flex flex-col",
          "w-full md:w-72",
          selected ? "hidden md:flex" : "flex",
        )}>
          <div className="px-4 py-2 border-b border-border shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {sorted.length} paciente{sorted.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ul className="flex-1 overflow-auto divide-y divide-border">
            {sorted.map(p => {
              const t = TRIAGE[(p.triage_level ?? "blue") as TriageKey];
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSelected(p)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors",
                      selected?.id === p.id ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <span className={cn("h-3 w-3 rounded-full shrink-0", t.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{t.label}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
            {sorted.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum paciente internado</li>
            )}
          </ul>
        </aside>

        <main className={cn("flex-1 overflow-hidden", selected ? "flex flex-col" : "hidden md:flex")}>
          {selected ? (
            <PharmacyPanel key={selected.id} patient={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Pill className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um paciente para gerenciar medicamentos</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

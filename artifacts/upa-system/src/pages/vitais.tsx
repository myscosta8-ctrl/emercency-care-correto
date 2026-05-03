import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useGetPatientVitals,
  useRecordPatientVitals,
  getGetPatientVitalsQueryKey,
  getGetPatientQueryKey,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HeartPulse, Wind, Droplet, Thermometer, Gauge, ChevronRight, ArrowLeft } from "lucide-react";
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

interface VitalsFormState {
  systolic: string;
  diastolic: string;
  hr: string;
  rr: string;
  spo2: string;
  temp: string;
  glucose: string;
  note: string;
}

const EMPTY: VitalsFormState = {
  systolic: "", diastolic: "", hr: "", rr: "", spo2: "", temp: "", glucose: "", note: "",
};

function VitalsPanel({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeUser } = useAuth();
  const [form, setForm] = useState<VitalsFormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const recordVitals = useRecordPatientVitals();
  const { data: history } = useGetPatientVitals(patient.id, {
    query: { enabled: true, queryKey: getGetPatientVitalsQueryKey(patient.id) },
  });

  const set = (field: keyof VitalsFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const bp = (form.systolic && form.diastolic) ? `${form.systolic}/${form.diastolic}` : undefined;
      await recordVitals.mutateAsync({
        id: patient.id,
        data: {
          bp,
          hr:      form.hr      ? Number(form.hr)      : undefined,
          rr:      form.rr      ? Number(form.rr)      : undefined,
          spo2:    form.spo2    ? Number(form.spo2)    : undefined,
          temp:    form.temp    ? Number(form.temp)    : undefined,
          glucose: form.glucose ? Number(form.glucose) : undefined,
          note:    form.note || undefined,
          responsible: activeUser?.name ?? "Técnico",
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPatientVitalsQueryKey(patient.id) });
      await queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
      await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      toast({ title: "Sinais vitais salvos" });
      setForm(EMPTY);
    } catch {
      toast({ title: "Erro ao salvar sinais vitais", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const t = TRIAGE[(patient.triage_level ?? "blue") as TriageKey];
  const last = history?.[0];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="md:hidden p-1 hover:bg-muted rounded">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", t.dot)} />
        <div>
          <p className="font-semibold text-sm">{patient.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {patient.bed ? `Leito ${patient.bed} · ` : ""}{t.label}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {last && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Último registro — {format(new Date(last.createdAt), "dd/MM HH:mm", { locale: ptBR })}
            </p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
              {last.bp   && <span><span className="text-muted-foreground">PA  </span>{last.bp} mmHg</span>}
              {last.hr   && <span><span className="text-muted-foreground">FC  </span>{last.hr} bpm</span>}
              {last.rr   && <span><span className="text-muted-foreground">FR  </span>{last.rr} irpm</span>}
              {last.spo2 && <span><span className="text-muted-foreground">SpO₂ </span>{last.spo2}%</span>}
              {last.temp && <span><span className="text-muted-foreground">Temp </span>{last.temp}°C</span>}
              {last.glucose && <span><span className="text-muted-foreground">HGT </span>{last.glucose}</span>}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Novo Registro</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Gauge className="h-3 w-3" /> Sistólica (mmHg)
              </Label>
              <Input value={form.systolic} onChange={set("systolic")} type="number" placeholder="120" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Gauge className="h-3 w-3" /> Diastólica (mmHg)
              </Label>
              <Input value={form.diastolic} onChange={set("diastolic")} type="number" placeholder="80" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <HeartPulse className="h-3 w-3" /> FC (bpm)
              </Label>
              <Input value={form.hr} onChange={set("hr")} type="number" placeholder="72" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Wind className="h-3 w-3" /> FR (irpm)
              </Label>
              <Input value={form.rr} onChange={set("rr")} type="number" placeholder="16" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Droplet className="h-3 w-3" /> SpO₂ (%)
              </Label>
              <Input value={form.spo2} onChange={set("spo2")} type="number" min="0" max="100" placeholder="98" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> Temperatura (°C)
              </Label>
              <Input value={form.temp} onChange={set("temp")} type="number" step="0.1" placeholder="36.5" className="h-10" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">HGT / Glicemia (mg/dL)</Label>
              <Input value={form.glucose} onChange={set("glucose")} type="number" placeholder="100" className="h-10" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={form.note}
                onChange={set("note")}
                placeholder="Observações adicionais..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-11 font-semibold gap-2">
          <HeartPulse className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Sinais Vitais"}
        </Button>
      </div>
    </div>
  );
}

export default function VitaisPage() {
  const [selected, setSelected] = useState<Patient | null>(null);
  const { data: patients } = useListPatients();

  const sorted = (patients ?? []).sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3, blue: 4 };
    return (order[a.triage_level as TriageKey] ?? 4) - (order[b.triage_level as TriageKey] ?? 4);
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader title="Técnico de Enfermagem — Sinais Vitais" />

      <div className="flex flex-1 overflow-hidden">
        <aside className={cn(
          "border-r border-border flex flex-col",
          "w-full md:w-72",
          selected ? "hidden md:flex" : "flex",
        )}>
          <div className="px-4 py-2 border-b border-border shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {sorted.length} paciente{sorted.length !== 1 ? "s" : ""} · selecione para registrar
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
                      <p className="text-xs text-muted-foreground">
                        {p.bed ? `Leito ${p.bed} · ` : ""}{t.label}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
            {sorted.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum paciente internado
              </li>
            )}
          </ul>
        </aside>

        <main className={cn("flex-1 overflow-hidden", selected ? "flex flex-col" : "hidden md:flex")}>
          {selected ? (
            <VitalsPanel key={selected.id} patient={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <HeartPulse className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um paciente para registrar os sinais vitais</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

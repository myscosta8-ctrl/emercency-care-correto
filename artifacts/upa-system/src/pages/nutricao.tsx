import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useGetPatientNutritionalAssessments,
  useAddPatientNutritionalAssessment,
  getGetPatientNutritionalAssessmentsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UtensilsCrossed, Send, ChevronRight, ArrowLeft } from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
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

function AssessmentPanel({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeUser } = useAuth();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: assessments, isLoading } = useGetPatientNutritionalAssessments(patient.id, {
    query: { enabled: true, queryKey: getGetPatientNutritionalAssessmentsQueryKey(patient.id) },
  });
  const addAssessment = useAddPatientNutritionalAssessment();
  const t = TRIAGE[(patient.triage_level ?? "blue") as TriageKey];

  const handleSend = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addAssessment.mutateAsync({
        id: patient.id,
        data: { userId: activeUser?.id ?? 0, content: content.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPatientNutritionalAssessmentsQueryKey(patient.id) });
      toast({ title: "Avaliação nutricional registrada" });
      setContent("");
    } catch {
      toast({ title: "Erro ao registrar avaliação", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
            {patient.diagnosis ? `${patient.diagnosis} · ` : ""}{t.label}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando avaliações...</p>}
        {!isLoading && (assessments?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <UtensilsCrossed className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma avaliação nutricional registrada</p>
          </div>
        )}
        {assessments?.map(a => (
          <div key={a.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {format(new Date(a.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p className="text-sm whitespace-pre-wrap">{a.content}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-4 space-y-2 shrink-0">
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Registre a avaliação nutricional: estado nutricional, necessidades calóricas, plano alimentar, conduta..."
          rows={4}
          className="resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={saving || !content.trim()}
          className="w-full gap-2"
        >
          <Send className="h-4 w-4" />
          {saving ? "Registrando..." : "Registrar Avaliação Nutricional"}
        </Button>
      </div>
    </div>
  );
}

export default function NutricaoPage() {
  const [selected, setSelected] = useState<Patient | null>(null);
  const { data: patients } = useListPatients();

  const sorted = (patients ?? []).sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3, blue: 4 };
    return (order[a.triage_level as TriageKey] ?? 4) - (order[b.triage_level as TriageKey] ?? 4);
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader title="Nutrição — Avaliação Nutricional" />

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
                      <p className="text-xs text-muted-foreground truncate">
                        {p.diagnosis ?? t.label}
                      </p>
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
            <AssessmentPanel key={selected.id} patient={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <UtensilsCrossed className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um paciente para registrar avaliação nutricional</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

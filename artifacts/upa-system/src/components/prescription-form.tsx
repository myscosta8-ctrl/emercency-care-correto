import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientPrescription,
  useAddPatientExamRequest,
  useListStaff,
  getGetPatientPrescriptionsQueryKey,
  getGetPatientExamRequestsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardCheck, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MedicalPrescriptionForm } from "@/components/medical-prescription-form";
import type { PrescricaoMedicaData } from "@/components/medical-prescription-form";

const TYPE_OPTIONS = [
  {
    value: "nursing",
    label: "Enfermagem",
    icon: ClipboardCheck,
    color: "border-blue-500/40 text-blue-400 bg-blue-500/10",
  },
  {
    value: "medical",
    label: "Médica",
    icon: Stethoscope,
    color: "border-purple-500/40 text-purple-400 bg-purple-500/10",
  },
] as const;

const NURSING_ROLES = ["enfermeiro", "tecnico_enfermagem"];

const nursingSchema = z.object({
  userId:  z.coerce.number().min(1, "Selecione o profissional responsável"),
  content: z.string().min(1, "Preencha o conteúdo da prescrição"),
});
type NursingValues = z.infer<typeof nursingSchema>;

interface PrescriptionFormProps {
  patient: Patient;
  /** ID do usuário logado — pré-preenche o seletor de profissional */
  userId?: number;
  /**
   * Quando definido, fixa o tipo e oculta o seletor.
   * "medical" → prescrição médica; "nursing" → prescrição de cuidados de enfermagem.
   */
  forceType?: "nursing" | "medical";
  onSuccess: () => void;
  onCancel: () => void;
}

export function PrescriptionForm({ patient, userId = 0, forceType, onSuccess, onCancel }: PrescriptionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPrescription = useAddPatientPrescription();
  const createExamRequest = useAddPatientExamRequest();
  const { data: staffList } = useListStaff();
  const activeStaff = (staffList ?? []).filter(s => s.active);

  const [type, setType] = useState<"nursing" | "medical">(forceType ?? "nursing");

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Staff filtrado conforme o tipo de prescrição
  const nursingStaff = activeStaff.filter(s => NURSING_ROLES.includes(s.role));
  const medStaff     = activeStaff.filter(s => s.role === "medico");

  const form = useForm<NursingValues>({
    resolver: zodResolver(nursingSchema),
    defaultValues: { userId: userId > 0 ? userId : 0, content: "" },
  });

  function saveNursing(data: NursingValues) {
    createPrescription.mutate(
      { id: patient.id, data: { userId: data.userId, type: "nursing", content: data.content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(patient.id) });
          toast({ title: "Prescrição de enfermagem registrada" });
          onSuccess();
        },
        onError: () => toast({ title: "Não foi possível registrar a prescrição", variant: "destructive" }),
      }
    );
  }

  function saveMedical(text: string, data: PrescricaoMedicaData) {
    // Usa o ID do usuário logado; fallback para o primeiro médico da lista
    const resolvedUserId = userId > 0
      ? userId
      : (medStaff[0]?.id ?? activeStaff[0]?.id ?? 0);

    createPrescription.mutate(
      { id: patient.id, data: { userId: resolvedUserId, type: "medical", content: text } },
      {
        onSuccess: (prescription) => {
          queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(patient.id) });
          const totalExames = data.exames.laboratoriais.length + data.exames.imagem.length;
          if (totalExames > 0) {
            createExamRequest.mutate(
              {
                id: patient.id,
                data: {
                  prescriptionId: prescription.id,
                  laboratoriais: data.exames.laboratoriais,
                  imagem: data.exames.imagem,
                  prioridade: data.exames.prioridade,
                  justificativa: data.exames.justificativa,
                },
              },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getGetPatientExamRequestsQueryKey(patient.id) });
                },
                onError: () => toast({ title: "Prescrição salva, mas falha ao registrar exames estruturados", variant: "destructive" }),
              }
            );
          }
          toast({ title: "Prescrição médica registrada" });
          onSuccess();
        },
        onError: () => toast({ title: "Não foi possível registrar a prescrição", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-4">
      {/* Type selector — só aparece quando o tipo não está fixado */}
      {!forceType && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tipo de Prescrição</p>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md border text-sm font-medium transition-all",
                    type === opt.value
                      ? opt.color
                      : "border-border/50 text-muted-foreground hover:border-border"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Medical form */}
      {type === "medical" && (
        <MedicalPrescriptionForm
          patientName={patient.full_name}
          onSerialize={saveMedical}
          onCancel={onCancel}
          isPending={createPrescription.isPending}
        />
      )}

      {/* Nursing form */}
      {type === "nursing" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(saveNursing)} className="space-y-4">
            <div className="bg-blue-500/5 rounded-lg px-4 py-3 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-0.5">
                <ClipboardCheck className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold uppercase tracking-wider text-blue-400">Prescrição de Cuidados de Enfermagem</span>
              </div>
              <p className="text-xs text-muted-foreground">{patient.full_name} · {dateLabel}</p>
            </div>

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Profissional responsável <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Prioriza enfermeiros/técnicos; fallback para todos */}
                      {(nursingStaff.length > 0 ? nursingStaff : activeStaff).map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} — {s.role === "enfermeiro" ? "Enfermeiro(a)" : s.role === "tecnico_enfermagem" ? "Técnico de Enfermagem" : s.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cuidados prescritos <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        "Ex:\n1. Curativo simples em região sacra 1x/dia\n2. Mudança de decúbito 2/2h\n3. Controle de diurese\n4. Verificar acesso venoso 4/4h\n5. Glicemia capilar em jejum e pós-prandial"
                      }
                      className="min-h-[160px] font-mono text-sm resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={createPrescription.isPending}>
                {createPrescription.isPending ? "Registrando..." : "Registrar Prescrição"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

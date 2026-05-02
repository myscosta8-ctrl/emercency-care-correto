import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddVitals,
  getGetPatientQueryKey,
  getListPatientsQueryKey,
  getGetPatientHistoryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react/src/generated/api.schemas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PLAN =
  `- Manter monitorização\n- Administrar medicação conforme prescrição\n- Reavaliar em ___ minutos\n- Comunicado equipe médica`;

const schema = z.object({
  subjective: z.string().default(""),
  systolicBp: z.coerce.number().min(0).default(0),
  diastolicBp: z.coerce.number().min(0).default(0),
  heartRate: z.coerce.number().min(0).default(0),
  respiratoryRate: z.coerce.number().min(0).default(0),
  spO2: z.coerce.number().min(0).max(100).default(0),
  temperature: z.coerce.number().min(0).default(0),
  glucose: z.coerce.number().min(0).default(0),
  generalCondition: z.string().default(""),
  consciousnessLevel: z.string().default(""),
  painScale: z.coerce.number().min(0).max(10).default(0),
  assessment: z.string().default(""),
  plan: z.string().default(DEFAULT_PLAN),
  responsible: z.string().min(1, "Informe o profissional responsável"),
  note: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

interface VitalsUpdateFormProps {
  patient: Patient;
  onSuccess: () => void;
  onCancel: () => void;
}

function SoapSection({ letter, title, colorClass, children }: {
  letter: string;
  title: string;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border-l-[3px] ${colorClass} pl-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">{letter}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ToggleGroup({ options, value, onChange, colorActive = "bg-primary text-primary-foreground border-primary" }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  colorActive?: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? "" : opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
            value === opt.value
              ? colorActive
              : "bg-background border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function VitalsUpdateForm({ patient, onSuccess, onCancel }: VitalsUpdateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjective: "",
      systolicBp: patient.systolicBp || 0,
      diastolicBp: patient.diastolicBp || 0,
      heartRate: patient.heartRate || 0,
      respiratoryRate: patient.respiratoryRate || 0,
      spO2: patient.spO2 || 0,
      temperature: patient.temperature || 0,
      glucose: patient.glucose || 0,
      generalCondition: "",
      consciousnessLevel: "",
      painScale: 0,
      assessment: "",
      plan: DEFAULT_PLAN,
      responsible: patient.nurse || "",
      note: "",
    },
  });

  const addVitals = useAddVitals();

  function onSubmit(data: FormValues) {
    addVitals.mutate({ id: patient.id, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patient.id) });
        toast({ title: "Evolução de enfermagem registrada com sucesso" });
        onSuccess();
      },
      onError: () => toast({ title: "Não foi possível registrar a evolução", variant: "destructive" }),
    });
  }

  const generalCondition = form.watch("generalCondition");
  const consciousnessLevel = form.watch("consciousnessLevel");
  const painScale = form.watch("painScale");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Header */}
        <div className="mb-5 pb-4 border-b border-border/50">
          <p className="text-xs text-muted-foreground">
            Data/Hora:{" "}
            <span className="font-mono text-foreground">
              {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Paciente: <strong className="text-foreground">{patient.name}</strong></p>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">

          {/* S — SUBJETIVO */}
          <SoapSection letter="S" title="Subjetivo" colorClass="border-blue-500/70">
            <FormField
              control={form.control}
              name="subjective"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Paciente refere</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      placeholder="Dor, dispneia, náusea, tontura..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SoapSection>

          {/* O — OBJETIVO */}
          <SoapSection letter="O" title="Objetivo" colorClass="border-green-500/70">
            <div className="space-y-4">

              {/* Vital Signs Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">PA (mmHg)</label>
                  <div className="flex items-center gap-1.5">
                    <FormField control={form.control} name="systolicBp" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl><Input type="number" min={0} placeholder="120" className="text-center" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <span className="text-muted-foreground font-mono">/</span>
                    <FormField control={form.control} name="diastolicBp" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl><Input type="number" min={0} placeholder="80" className="text-center" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <FormField control={form.control} name="heartRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">FC (bpm)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="respiratoryRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">FR (irpm)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="spO2" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">SpO₂ (%)</FormLabel>
                    <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="temperature" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Temp. (°C)</FormLabel>
                    <FormControl><Input type="number" min={0} step="0.1" {...field} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="glucose" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">HGT (mg/dL)</FormLabel>
                    <FormControl><Input type="number" min={0} step="0.1" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Estado Geral */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Estado geral</label>
                <ToggleGroup
                  options={[
                    { value: "bom", label: "Bom" },
                    { value: "regular", label: "Regular" },
                    { value: "grave", label: "Grave" },
                  ]}
                  value={generalCondition}
                  onChange={v => form.setValue("generalCondition", v)}
                  colorActive="bg-triage-green text-white border-triage-green"
                />
              </div>

              {/* Nível de Consciência */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Nível de consciência</label>
                <ToggleGroup
                  options={[
                    { value: "lucido", label: "Lúcido" },
                    { value: "sonolento", label: "Sonolento" },
                    { value: "torporoso", label: "Torporoso" },
                    { value: "inconsciente", label: "Inconsciente" },
                  ]}
                  value={consciousnessLevel}
                  onChange={v => form.setValue("consciousnessLevel", v)}
                />
              </div>

              {/* Dor */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">
                  Dor — escala 0–10{" "}
                  {painScale > 0 && (
                    <span className={cn(
                      "font-bold",
                      painScale <= 3 ? "text-triage-green" :
                      painScale <= 6 ? "text-triage-yellow" :
                      "text-triage-red"
                    )}>{painScale}/10</span>
                  )}
                </label>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => form.setValue("painScale", i)}
                      className={cn(
                        "w-8 h-8 text-xs font-bold rounded-md border transition-colors",
                        painScale === i
                          ? i === 0 ? "bg-triage-green text-white border-triage-green"
                          : i <= 3 ? "bg-triage-green text-white border-triage-green"
                          : i <= 6 ? "bg-triage-yellow text-black border-triage-yellow"
                          : "bg-triage-red text-white border-triage-red"
                          : "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SoapSection>

          {/* A — AVALIAÇÃO */}
          <SoapSection letter="A" title="Avaliação" colorClass="border-orange-500/70">
            <FormField
              control={form.control}
              name="assessment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      placeholder="Paciente em condição estável/instável/crítica, com quadro de..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SoapSection>

          {/* P — PLANO */}
          <SoapSection letter="P" title="Plano" colorClass="border-purple-500/70">
            <FormField
              control={form.control}
              name="plan"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono text-xs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SoapSection>

          {/* Profissional + Observação */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <FormField
              control={form.control}
              name="responsible"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Profissional <span className="text-destructive text-xs">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do Técnico(a) ou Enfermeiro(a)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    Observação adicional
                    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Intercorrências, procedimentos realizados..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onCancel} disabled={addVitals.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={addVitals.isPending}>
            {addVitals.isPending ? "Registrando..." : "Registrar Evolução"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

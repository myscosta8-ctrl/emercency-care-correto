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

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNurse } from "@/hooks/use-nurse";
import { Activity } from "lucide-react";

const schema = z.object({
  systolicBp:    z.coerce.number().min(0).default(0),
  diastolicBp:   z.coerce.number().min(0).default(0),
  heartRate:     z.coerce.number().min(0).default(0),
  respiratoryRate: z.coerce.number().min(0).default(0),
  spO2:          z.coerce.number().min(0).max(100).default(0),
  temperature:   z.coerce.number().min(0).default(0),
  glucose:       z.coerce.number().min(0).default(0),
  note:          z.string().default(""),
  responsible:   z.string().min(1, "Informe o nome do profissional"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  patient: Patient;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VitalsRecordForm({ patient, onSuccess, onCancel }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addVitals = useAddVitals();
  const { nurseName, setNurseName } = useNurse();

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      systolicBp:     patient.systolicBp ?? 0,
      diastolicBp:    patient.diastolicBp ?? 0,
      heartRate:      patient.heartRate ?? 0,
      respiratoryRate: patient.respiratoryRate ?? 0,
      spO2:           patient.spO2 ?? 0,
      temperature:    patient.temperature ?? 0,
      glucose:        patient.glucose ?? 0,
      note:           "",
      responsible:    nurseName || (patient.nurse ?? ""),
    },
  });

  function onSubmit(data: FormValues) {
    addVitals.mutate(
      {
        id: patient.id,
        data: {
          systolicBp:     data.systolicBp || undefined,
          diastolicBp:    data.diastolicBp || undefined,
          heartRate:      data.heartRate || undefined,
          respiratoryRate: data.respiratoryRate || undefined,
          spO2:           data.spO2 || undefined,
          temperature:    data.temperature || undefined,
          glucose:        data.glucose || undefined,
          note:           data.note,
          responsible:    data.responsible,
          subjective:     "",
          assessment:     "",
          plan:           "",
        },
      },
      {
        onSuccess: () => {
          setNurseName(data.responsible);
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patient.id) });
          toast({ title: "Sinais vitais registrados com sucesso" });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Não foi possível registrar os sinais vitais", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Header */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/50">
          <div className="flex items-center gap-2 mb-0.5">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Registro de Sinais Vitais
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {patient.name} · {dateLabel}
          </p>
        </div>

        {/* PA row */}
        <div className="space-y-1.5">
          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            PA (mmHg)
          </FormLabel>
          <div className="flex items-center gap-2">
            <FormField control={form.control} name="systolicBp" render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input type="number" min={0} inputMode="numeric" placeholder="Sistólica" className="text-center font-mono h-12 text-base" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <span className="text-muted-foreground text-lg font-light shrink-0">/</span>
            <FormField control={form.control} name="diastolicBp" render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input type="number" min={0} inputMode="numeric" placeholder="Diastólica" className="text-center font-mono h-12 text-base" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <span className="text-xs text-muted-foreground shrink-0 w-10">mmHg</span>
          </div>
        </div>

        {/* FC / FR row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="heartRate" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">FC <span className="text-muted-foreground font-normal">(bpm)</span></FormLabel>
              <FormControl>
                <Input type="number" min={0} inputMode="numeric" placeholder="—" className="font-mono h-12 text-base" {...field} />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="respiratoryRate" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">FR <span className="text-muted-foreground font-normal">(irpm)</span></FormLabel>
              <FormControl>
                <Input type="number" min={0} inputMode="numeric" placeholder="—" className="font-mono h-12 text-base" {...field} />
              </FormControl>
            </FormItem>
          )} />
        </div>

        {/* SpO2 / Temp row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="spO2" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">SpO₂ <span className="text-muted-foreground font-normal">(%)</span></FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} inputMode="numeric" placeholder="—" className="font-mono h-12 text-base" {...field} />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="temperature" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Temp <span className="text-muted-foreground font-normal">(°C)</span></FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.1" inputMode="decimal" placeholder="—" className="font-mono h-12 text-base" {...field} />
              </FormControl>
            </FormItem>
          )} />
        </div>

        {/* HGT row */}
        <FormField control={form.control} name="glucose" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">HGT <span className="text-muted-foreground font-normal">(mg/dL)</span></FormLabel>
            <FormControl>
              <Input type="number" min={0} inputMode="numeric" placeholder="—" className="font-mono h-12 text-base" {...field} />
            </FormControl>
          </FormItem>
        )} />

        <div className="border-t border-border/40 pt-3 space-y-3">
          {/* Observação */}
          <FormField control={form.control} name="note" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Observação</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Anotações clínicas adicionais..."
                  className="resize-none h-16 text-sm"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )} />

          {/* Profissional */}
          <FormField control={form.control} name="responsible" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Profissional <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Nome do profissional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-11">
            Cancelar
          </Button>
          <Button type="submit" className="flex-1 h-11 text-sm font-semibold" disabled={addVitals.isPending}>
            {addVitals.isPending ? "Registrando..." : "✓ Registrar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRecordPatientVitals,
  getGetPatientQueryKey,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
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
import { Activity, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  systolicBp:    z.coerce.number().min(0).default(0),
  diastolicBp:   z.coerce.number().min(0).default(0),
  heartRate:     z.coerce.number().min(0).default(0),
  respiratoryRate: z.coerce.number().min(0).default(0),
  spO2:          z.coerce.number().min(0).max(100).default(0),
  temperature:   z.coerce.number().min(0).default(0),
  glucose:       z.coerce.number().min(0).default(0),
  entradaMl:     z.coerce.number().min(0).default(0),
  saidaMl:       z.coerce.number().min(0).default(0),
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
  const addVitals = useRecordPatientVitals();
  const { nurseName, setNurseName } = useNurse();

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      systolicBp:     0,
      diastolicBp:    0,
      heartRate:      0,
      respiratoryRate: 0,
      spO2:           0,
      temperature:    0,
      glucose:        0,
      entradaMl:      0,
      saidaMl:        0,
      note:           "",
      responsible:    nurseName || (patient.responsibleProfessional ?? ""),
    },
  });

  const entradaMl = form.watch("entradaMl") || 0;
  const saidaMl   = form.watch("saidaMl")   || 0;
  const balanco   = entradaMl - saidaMl;

  function onSubmit(data: FormValues) {
    addVitals.mutate(
      {
        id: patient.id,
        data: {
          bp: (data.systolicBp && data.diastolicBp)
            ? `${data.systolicBp}/${data.diastolicBp}`
            : undefined,
          hr:        data.heartRate      || undefined,
          rr:        data.respiratoryRate || undefined,
          spo2:      data.spO2           || undefined,
          temp:      data.temperature    || undefined,
          glucose:   data.glucose        || undefined,
          entradaMl: data.entradaMl      || undefined,
          saidaMl:   data.saidaMl        || undefined,
          note:      data.note,
          responsible: data.responsible,
        } as Parameters<typeof addVitals.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          setNurseName(data.responsible);
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
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
            {patient.full_name} · {dateLabel}
          </p>
        </div>

        {/* PA row */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            PA (mmHg)
          </p>
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

        {/* Balanço Hídrico */}
        <div className="border border-sky-500/20 rounded-lg px-3 py-3 space-y-3 bg-sky-500/5">
          <div className="flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-sky-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Balanço Hídrico
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="entradaMl" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Entrada <span className="text-muted-foreground font-normal">(mL)</span></FormLabel>
                <FormControl>
                  <Input type="number" min={0} inputMode="numeric" placeholder="0" className="font-mono h-12 text-base" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="saidaMl" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Saída <span className="text-muted-foreground font-normal">(mL)</span></FormLabel>
                <FormControl>
                  <Input type="number" min={0} inputMode="numeric" placeholder="0" className="font-mono h-12 text-base" {...field} />
                </FormControl>
              </FormItem>
            )} />
          </div>
          {(entradaMl > 0 || saidaMl > 0) && (
            <div className="flex items-center justify-between rounded-md bg-background/60 border border-border/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Balanço calculado:</span>
              <span className={cn(
                "font-mono font-bold text-sm",
                balanco > 0 ? "text-sky-400" : balanco < 0 ? "text-red-400" : "text-muted-foreground"
              )}>
                {balanco > 0 ? "+" : ""}{balanco} mL
              </span>
            </div>
          )}
        </div>

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

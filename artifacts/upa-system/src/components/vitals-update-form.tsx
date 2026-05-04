import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientHistory,
  useListStaff,
  useGetPatientDevices,
  getGetPatientHistoryQueryKey,
} from "@workspace/api-client-react";
import type { Patient, PatientDevice } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ── device labels ─────────────────────────────────────────────────────────────

const DEVICE_LABELS: Record<string, string> = {
  acesso_venoso_periferico: "Acesso Venoso Periférico (AVP)",
  acesso_venoso_central:    "Acesso Venoso Central (AVC)",
  sonda_nasoenteral:        "Sonda Nasoenteral (SNE)",
  sonda_nasogastrica:       "Sonda Nasogástrica (SNG)",
  sonda_vesical_demora:     "Sonda Vesical de Demora (SVD)",
  cateter_arterial:         "Cateter Arterial",
  dreno_torax:              "Dreno de Tórax",
  traqueostomia:            "Traqueostomia",
  gastrostomia:             "Gastrostomia",
  cateter_duplo_lumen:      "Cateter de Duplo Lúmen",
  dissecao_vascular:        "Dissecção Vascular",
  outro:                    "Outro Dispositivo",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (y && m && d) return `${d}/${m}/${y}`;
  return iso;
}

function buildDeviceSection(devices: PatientDevice[]): string {
  if (!devices || devices.length === 0) return "";
  const lines = devices.map(dev => {
    const label = DEVICE_LABELS[dev.deviceType] ?? dev.deviceType;
    const site  = dev.insertionSite ? ` — ${dev.insertionSite}` : "";
    const date  = ` — Inserido em: ${fmtDate(dev.insertionDate)}`;
    return `• ${label}${site}${date}`;
  });
  return `\nDispositivos ativos:\n${lines.join("\n")}`;
}

// ── form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  userId:   z.coerce.number().min(1, "Selecione o profissional responsável"),
  soapText: z.string().min(1, "Preencha a evolução"),
});

type FormValues = z.infer<typeof schema>;

interface VitalsUpdateFormProps {
  patient: Patient;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VitalsUpdateForm({ patient, onSuccess, onCancel }: VitalsUpdateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: staffList } = useListStaff();
  const activeStaff = (staffList ?? []).filter(s => s.active);

  const { data: activeDevices } = useGetPatientDevices(patient.id, { active: true });

  const addHistory = useAddPatientHistory();

  const deviceSection = buildDeviceSection(activeDevices ?? []);

  const DEFAULT_SOAP = `S: (Subjetivo — queixa do paciente)

O: (Objetivo — sinais vitais, exame físico)${deviceSection}

A: (Avaliação — impressão clínica)

P: (Plano — condutas, medicações, reavaliação)`;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId:   0,
      soapText: DEFAULT_SOAP,
    },
  });

  function onSubmit(data: FormValues) {
    addHistory.mutate(
      { id: patient.id, data: { userId: data.userId, soapText: data.soapText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(patient.id) });
          toast({ title: "Evolução registrada com sucesso" });
          onSuccess();
        },
        onError: () => toast({ title: "Não foi possível registrar a evolução", variant: "destructive" }),
      }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mb-4 pb-3 border-b border-border/50">
          <p className="text-xs text-muted-foreground">
            Data/Hora:{" "}
            <span className="font-mono text-foreground">
              {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paciente: <strong className="text-foreground">{patient.full_name}</strong>
          </p>
        </div>

        {/* Active devices summary */}
        {activeDevices && activeDevices.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
              Dispositivos Ativos ({activeDevices.length})
            </p>
            <ul className="space-y-0.5">
              {activeDevices.map(dev => (
                <li key={dev.id} className="text-xs text-foreground/80 flex gap-1.5">
                  <span className="text-amber-400/70">•</span>
                  <span>
                    <span className="font-medium">{DEVICE_LABELS[dev.deviceType] ?? dev.deviceType}</span>
                    {dev.insertionSite && <span className="text-muted-foreground"> — {dev.insertionSite}</span>}
                    <span className="text-muted-foreground"> — inserido em {fmtDate(dev.insertionDate)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-1.5">Informações incluídas automaticamente na evolução.</p>
          </div>
        )}

        <div className="space-y-4">
          <FormField control={form.control} name="userId" render={({ field }) => (
            <FormItem>
              <FormLabel>Profissional <span className="text-destructive text-xs">*</span></FormLabel>
              <Select
                onValueChange={val => field.onChange(Number(val))}
                value={field.value ? String(field.value) : ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activeStaff.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.role.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="soapText" render={({ field }) => (
            <FormItem>
              <FormLabel>Evolução SOAP</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={12}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onCancel} disabled={addHistory.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={addHistory.isPending}>
            {addHistory.isPending ? "Registrando..." : "Registrar Evolução"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePatientNotification,
  useUpdatePatientNotification,
  getGetPatientNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Patient, PatientNotification } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── constants ──────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = [
  { value: "dengue",       label: "Dengue" },
  { value: "covid19",      label: "COVID-19" },
  { value: "tuberculose",  label: "Tuberculose" },
  { value: "violencia",    label: "Violência" },
  { value: "outros",       label: "Outros" },
] as const;

type NotifType = typeof NOTIFICATION_TYPES[number]["value"];

// ── schema ────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  types:            z.array(z.string()).min(1, "Selecione pelo menos um tipo de notificação"),
  otherType:        z.string().default(""),
  diagnosis:        z.string().default(""),
  symptomOnsetDate: z.string().default(""),
  situation:        z.enum(["notificado", "pendente"]),
  responsible:      z.string().min(1, "Informe o responsável pela notificação"),
  notifiedAt:       z.string().default(""),
});

type FormValues = z.infer<typeof formSchema>;

function toJsonStr(types: string[]): string {
  return JSON.stringify(types);
}
function fromJsonStr(s: string): string[] {
  try { return JSON.parse(s) as string[]; } catch { return []; }
}

// ── component ─────────────────────────────────────────────────────────────────

interface NotificationFormProps {
  patient:      Patient;
  notification?: PatientNotification;
  onSuccess:    () => void;
  onCancel:     () => void;
}

export function NotificationForm({ patient, notification, onSuccess, onCancel }: NotificationFormProps) {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const defaultNotifiedAt = `${now.toISOString().slice(0, 16)}`;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      types:            notification ? fromJsonStr(notification.types) : [],
      otherType:        notification?.otherType   ?? "",
      diagnosis:        notification?.diagnosis   ?? patient.diagnosis ?? "",
      symptomOnsetDate: notification?.symptomOnsetDate ?? "",
      situation:        (notification?.situation as FormValues["situation"]) ?? "pendente",
      responsible:      notification?.responsible ?? patient.nurse ?? "",
      notifiedAt:       notification?.notifiedAt  ?? defaultNotifiedAt,
    },
  });

  const selectedTypes = form.watch("types");
  const hasOutros     = selectedTypes.includes("outros");

  const createNotification = useCreatePatientNotification();
  const updateNotification = useUpdatePatientNotification();
  const isPending = createNotification.isPending || updateNotification.isPending;

  function toggleType(type: string) {
    const current = form.getValues("types");
    if (current.includes(type)) {
      form.setValue("types", current.filter(t => t !== type), { shouldValidate: true });
    } else {
      form.setValue("types", [...current, type], { shouldValidate: true });
    }
  }

  function onSubmit(data: FormValues) {
    const payload = {
      types:            toJsonStr(data.types),
      otherType:        data.otherType,
      diagnosis:        data.diagnosis,
      symptomOnsetDate: data.symptomOnsetDate,
      situation:        data.situation,
      responsible:      data.responsible,
      notifiedAt:       data.notifiedAt,
    };

    if (notification) {
      updateNotification.mutate(
        { id: patient.id, notificationId: notification.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(patient.id) });
            toast({ title: "Notificação atualizada" });
            onSuccess();
          },
          onError: () => toast({ title: "Erro ao atualizar notificação", variant: "destructive" }),
        }
      );
    } else {
      createNotification.mutate(
        { id: patient.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(patient.id) });
            toast({ title: "Notificação compulsória registrada" });
            onSuccess();
          },
          onError: () => toast({ title: "Erro ao registrar notificação", variant: "destructive" }),
        }
      );
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Dados do paciente (read-only summary) */}
        <div className="bg-muted/20 rounded-lg border border-border/40 p-3 space-y-1 text-sm">
          <div className="flex gap-4">
            <span className="text-muted-foreground w-32 shrink-0">Paciente</span>
            <span className="font-medium">{patient.name}</span>
          </div>
          {patient.birthDate && (
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32 shrink-0">Nascimento</span>
              <span>{patient.birthDate.split("-").reverse().join("/")} ({patient.age} anos)</span>
            </div>
          )}
          {patient.sex && patient.sex !== "O" && (
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32 shrink-0">Sexo</span>
              <span>{patient.sex === "M" ? "Masculino" : "Feminino"}</span>
            </div>
          )}
          {patient.cpf && (
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32 shrink-0">CPF</span>
              <span className="font-mono">{patient.cpf}</span>
            </div>
          )}
          {patient.cns && (
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32 shrink-0">CNS</span>
              <span className="font-mono">{patient.cns}</span>
            </div>
          )}
          {patient.street && (
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32 shrink-0">Endereço</span>
              <span>
                {[patient.street, patient.addressNumber].filter(Boolean).join(", ")}
                {patient.neighborhood ? `, ${patient.neighborhood}` : ""}
              </span>
            </div>
          )}
          {patient.city && (
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32 shrink-0">Município</span>
              <span>{patient.city}{patient.addressState ? ` — ${patient.addressState}` : ""}</span>
            </div>
          )}
        </div>

        {/* Tipo de notificação */}
        <FormField control={form.control} name="types" render={() => (
          <FormItem>
            <FormLabel>Tipo de Notificação</FormLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {NOTIFICATION_TYPES.map(opt => {
                const checked = selectedTypes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleType(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left",
                      checked
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-4 w-4 shrink-0 rounded border-2 items-center justify-center",
                      checked ? "border-amber-500 bg-amber-500/30" : "border-muted-foreground/40"
                    )}>
                      {checked && <span className="block h-2 w-2 rounded-[2px] bg-amber-400" />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {hasOutros && (
              <FormField control={form.control} name="otherType" render={({ field }) => (
                <FormItem className="mt-2">
                  <FormControl>
                    <Input placeholder="Especificar outro agravo..." {...field} />
                  </FormControl>
                </FormItem>
              )} />
            )}
            <FormMessage />
          </FormItem>
        )} />

        {/* Diagnóstico */}
        <FormField control={form.control} name="diagnosis" render={({ field }) => (
          <FormItem>
            <FormLabel>Diagnóstico Suspeito/Confirmado <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span></FormLabel>
            <FormControl>
              <Input placeholder="CID ou descrição do agravo" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Data início dos sintomas */}
        <FormField control={form.control} name="symptomOnsetDate" render={({ field }) => (
          <FormItem>
            <FormLabel>Data de Início dos Sintomas <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span></FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Situação */}
        <FormField control={form.control} name="situation" render={({ field }) => (
          <FormItem>
            <FormLabel>Situação</FormLabel>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "pendente",    label: "Pendente",    color: "yellow" },
                { value: "notificado",  label: "Notificado",  color: "green" },
              ] as const).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => field.onChange(opt.value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    field.value === opt.value
                      ? opt.value === "notificado"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                      : "bg-card/30 border-border/50 text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  <span className={cn(
                    "flex h-4 w-4 shrink-0 rounded-full border-2 items-center justify-center",
                    field.value === opt.value
                      ? opt.value === "notificado" ? "border-emerald-500" : "border-yellow-500"
                      : "border-muted-foreground/40"
                  )}>
                    {field.value === opt.value && (
                      <span className={cn("h-2 w-2 rounded-full",
                        opt.value === "notificado" ? "bg-emerald-500" : "bg-yellow-500"
                      )} />
                    )}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )} />

        {/* Responsável + Data/Hora */}
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="responsible" render={({ field }) => (
            <FormItem className="col-span-2 sm:col-span-1">
              <FormLabel>Responsável pela Notificação</FormLabel>
              <FormControl>
                <Input placeholder="Nome do profissional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="notifiedAt" render={({ field }) => (
            <FormItem className="col-span-2 sm:col-span-1">
              <FormLabel>Data/Hora <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span></FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : notification ? "Atualizar Notificação" : "Registrar Notificação"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

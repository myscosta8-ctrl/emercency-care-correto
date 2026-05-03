import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientNotification,
  useUpdatePatientNotification,
  getGetPatientNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Patient, PatientNotification } from "@workspace/api-client-react";
import { Bell } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  disease:        z.string().min(1, "Informe a doença/agravo"),
  classification: z.string().min(1, "Informe a classificação"),
});

type FormValues = z.infer<typeof formSchema>;

interface NotificationFormProps {
  patient:       Patient;
  notification?: PatientNotification;
  onSuccess:     () => void;
  onCancel:      () => void;
}

export function NotificationForm({ patient, notification, onSuccess, onCancel }: NotificationFormProps) {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      disease:        notification?.disease        ?? patient.diagnosis ?? "",
      classification: notification?.classification ?? "",
    },
  });

  const createNotification = useAddPatientNotification();
  const updateNotification = useUpdatePatientNotification();
  const isPending = createNotification.isPending || updateNotification.isPending;

  function onSubmit(data: FormValues) {
    if (notification) {
      updateNotification.mutate(
        { id: patient.id, notificationId: notification.id, data },
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
        { id: patient.id, data },
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

        {/* Header */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/50">
          <div className="flex items-center gap-2 mb-0.5">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              {notification ? "Editar Notificação" : "Nova Notificação Compulsória"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{patient.full_name} · {dateLabel}</p>
        </div>

        {/* Doença / Agravo */}
        <FormField control={form.control} name="disease" render={({ field }) => (
          <FormItem>
            <FormLabel>Doença / Agravo <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="Ex: Dengue, COVID-19, Tuberculose..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Classificação */}
        <FormField control={form.control} name="classification" render={({ field }) => (
          <FormItem>
            <FormLabel>Classificação <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="Ex: Suspeito, Confirmado, Descartado..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : notification ? "Atualizar" : "Registrar Notificação"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

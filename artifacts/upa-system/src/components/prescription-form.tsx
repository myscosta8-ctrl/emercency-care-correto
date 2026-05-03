import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientPrescription,
  useListStaff,
  getGetPatientPrescriptionsQueryKey,
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

const schema = z.object({
  userId:  z.coerce.number().min(1, "Selecione o profissional responsável"),
  type:    z.enum(["nursing", "medical"]),
  content: z.string().min(1, "Preencha o conteúdo da prescrição"),
});

type FormValues = z.infer<typeof schema>;

interface PrescriptionFormProps {
  patient: Patient;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PrescriptionForm({ patient, onSuccess, onCancel }: PrescriptionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPrescription = useAddPatientPrescription();

  const { data: staffList } = useListStaff();
  const activeStaff = (staffList ?? []).filter(s => s.active);

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId:  0,
      type:    "nursing",
      content: "",
    },
  });

  function onSubmit(data: FormValues) {
    createPrescription.mutate(
      {
        id: patient.id,
        data: {
          userId:  data.userId,
          type:    data.type,
          content: data.content,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(patient.id) });
          toast({ title: "Prescrição registrada com sucesso" });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Não foi possível registrar a prescrição", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/50">
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Nova Prescrição</span>
          </div>
          <p className="text-xs text-muted-foreground">{patient.full_name} · {dateLabel}</p>
        </div>

        {/* Type selector */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-md border text-sm font-medium transition-all",
                          field.value === opt.value
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Responsible staff */}
        <FormField
          control={form.control}
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Profissional <span className="text-destructive">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activeStaff.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Content */}
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conteúdo <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva as prescrições..."
                  className="min-h-[140px] font-mono text-sm resize-y"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={createPrescription.isPending}>
            {createPrescription.isPending ? "Registrando..." : "Registrar Prescrição"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

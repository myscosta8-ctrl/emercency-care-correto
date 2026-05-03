import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientHistory,
  useListStaff,
  getGetPatientHistoryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
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

const DEFAULT_SOAP = `S: (Subjetivo — queixa do paciente)

O: (Objetivo — sinais vitais, exame físico)

A: (Avaliação — impressão clínica)

P: (Plano — condutas, medicações, reavaliação)`;

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

  const addHistory = useAddPatientHistory();

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
                  rows={10}
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

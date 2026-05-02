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
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  heartRate: z.coerce.number().min(0).default(0),
  respiratoryRate: z.coerce.number().min(0).default(0),
  glucose: z.coerce.number().min(0).default(0),
  responsible: z.string().min(1, "Informe o responsável pela atualização"),
  note: z.string().default(""),
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      heartRate: patient.heartRate || 0,
      respiratoryRate: patient.respiratoryRate || 0,
      glucose: patient.glucose || 0,
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
        toast({ title: "Sinais vitais atualizados com sucesso" });
        onSuccess();
      },
      onError: () => toast({ title: "Não foi possível atualizar os sinais vitais", variant: "destructive" }),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="heartRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FC (bpm)</FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="respiratoryRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FR (irpm)</FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="glucose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gli. (mg/dL)</FormLabel>
                <FormControl><Input type="number" min={0} step="0.1" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="responsible"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Responsável <span className="text-destructive text-xs">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Técnico(a) ou Enfermeiro(a) responsável" {...field} />
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
                Observação
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Evolução clínica, procedimentos, intercorrências..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={addVitals.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={addVitals.isPending}>
            {addVitals.isPending ? "Salvando..." : "Confirmar Atualização"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

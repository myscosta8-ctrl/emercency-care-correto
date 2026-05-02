import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePatient,
  useUpdatePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
  getGetPatientQueryKey,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const TRIAGE_OPTIONS = [
  { value: "red",    label: "Vermelho — Emergência" },
  { value: "orange", label: "Laranja — Muito Urgente" },
  { value: "yellow", label: "Amarelo — Urgente" },
  { value: "green",  label: "Verde — Pouco Urgente" },
  { value: "blue",   label: "Azul — Não Urgente" },
] as const;

const SECTOR_OPTIONS = [
  "Sala Vermelha",
  "Sala Amarela Adulto",
  "Sala Amarela Pediátrica",
  "Observação Masculina",
  "Observação Feminina",
  "Medicação",
];

const formSchema = z.object({
  name: z.string().min(1, "Informe o nome completo do paciente"),
  age: z.coerce.number().min(0, "Informe uma idade válida"),
  bed: z.string().min(1, "Informe o número do leito"),
  diagnosis: z.string().min(1, "Informe a hipótese diagnóstica"),
  heartRate: z.coerce.number().min(0, "Informe a frequência cardíaca"),
  respiratoryRate: z.coerce.number().min(0, "Informe a frequência respiratória"),
  glucose: z.coerce.number().min(0, "Informe o valor da glicemia"),
  status: z.enum(["red", "orange", "yellow", "green", "blue"]),
  sector: z.string().min(1, "Selecione o setor de atendimento"),
  nurse: z.string().min(1, "Informe o enfermeiro(a) responsável"),
});

type FormValues = z.infer<typeof formSchema>;

interface PatientFormProps {
  patient?: Patient;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PatientForm({ patient, onSuccess, onCancel }: PatientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: patient?.name ?? "",
      age: patient?.age ?? 0,
      bed: patient?.bed ?? "",
      diagnosis: patient?.diagnosis ?? "",
      heartRate: patient?.heartRate ?? 0,
      respiratoryRate: patient?.respiratoryRate ?? 0,
      glucose: patient?.glucose ?? 0,
      status: (patient?.status as FormValues["status"]) ?? "yellow",
      sector: patient?.sector ?? "",
      nurse: patient?.nurse ?? "",
    },
  });

  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const isPending = createPatient.isPending || updatePatient.isPending;

  function onSubmit(data: FormValues) {
    if (patient) {
      updatePatient.mutate({ id: patient.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
          toast({ title: "Prontuário atualizado com sucesso" });
          onSuccess();
        },
        onError: () => toast({ title: "Não foi possível atualizar o prontuário", variant: "destructive" }),
      });
    } else {
      createPatient.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
          toast({ title: "Admissão registrada com sucesso" });
          onSuccess();
        },
        onError: () => toast({ title: "Não foi possível registrar a admissão", variant: "destructive" }),
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Nome do Paciente</FormLabel>
                <FormControl><Input placeholder="Nome completo" {...field} data-testid="input-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idade</FormLabel>
                <FormControl><Input type="number" data-testid="input-age" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Leito</FormLabel>
                <FormControl><Input placeholder="A1, B3..." data-testid="input-bed" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Setor</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-sector">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SECTOR_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Triagem Manchester</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Selecione a classificação" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TRIAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nurse"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Enfermeiro(a) Responsável</FormLabel>
                <FormControl><Input placeholder="Nome do enfermeiro(a)" data-testid="input-nurse" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="diagnosis"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Hipótese Diagnóstica</FormLabel>
                <FormControl><Input placeholder="Queixa principal ou hipótese diagnóstica..." data-testid="input-diagnosis" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="col-span-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sinais Vitais</p>
          </div>

          <FormField
            control={form.control}
            name="heartRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Freq. Cardíaca (bpm)</FormLabel>
                <FormControl><Input type="number" data-testid="input-heartRate" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="respiratoryRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Freq. Respiratória (irpm)</FormLabel>
                <FormControl><Input type="number" data-testid="input-respiratoryRate" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="glucose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Glicemia (mg/dL)</FormLabel>
                <FormControl><Input type="number" data-testid="input-glucose" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending ? "Salvando..." : patient ? "Salvar Alterações" : "Registrar Admissão"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

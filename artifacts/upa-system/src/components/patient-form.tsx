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
  status: z.enum(["red", "orange", "yellow", "green", "blue"], {
    errorMap: () => ({ message: "Selecione a classificação de triagem" }),
  }),
  sector: z.string().min(1, "Selecione o setor de atendimento"),
  nurse: z.string().default(""),
  bed: z.string().default(""),
  diagnosis: z.string().default(""),
  heartRate: z.coerce.number().min(0).default(0),
  respiratoryRate: z.coerce.number().min(0).default(0),
  glucose: z.coerce.number().min(0).default(0),
  spO2: z.coerce.number().min(0).max(100).default(0),
  temperature: z.coerce.number().min(0).default(0),
  systolicBp: z.coerce.number().min(0).default(0),
  diastolicBp: z.coerce.number().min(0).default(0),
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
      status: (patient?.status as FormValues["status"]) ?? "yellow",
      sector: patient?.sector ?? "",
      nurse: patient?.nurse ?? "",
      bed: patient?.bed ?? "",
      diagnosis: patient?.diagnosis ?? "",
      heartRate: patient?.heartRate ?? 0,
      respiratoryRate: patient?.respiratoryRate ?? 0,
      glucose: patient?.glucose ?? 0,
      spO2: patient?.spO2 ?? 0,
      temperature: patient?.temperature ?? 0,
      systolicBp: patient?.systolicBp ?? 0,
      diastolicBp: patient?.diastolicBp ?? 0,
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

  const OptLabel = () => (
    <span className="text-[11px] text-muted-foreground font-normal ml-1">(opcional)</span>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">

          {/* Nome — required, full width */}
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

          {/* Idade — required */}
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

          {/* Setor — required */}
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

          {/* Triagem Manchester — required, full width */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="col-span-2">
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

          {/* Separator */}
          <div className="col-span-2 pt-1 border-t border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
              Informações Adicionais <OptLabel />
            </p>
          </div>

          {/* Responsável — optional but prominent */}
          <FormField
            control={form.control}
            name="nurse"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Responsável <OptLabel /></FormLabel>
                <FormControl>
                  <Input placeholder="Técnico(a) ou Enfermeiro(a) responsável" data-testid="input-nurse" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Leito — optional */}
          <FormField
            control={form.control}
            name="bed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Leito <OptLabel /></FormLabel>
                <FormControl><Input placeholder="A1, B3..." data-testid="input-bed" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Hipótese Diagnóstica — optional */}
          <FormField
            control={form.control}
            name="diagnosis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hipótese Diagnóstica <OptLabel /></FormLabel>
                <FormControl>
                  <Input placeholder="Queixa principal ou hipótese..." data-testid="input-diagnosis" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Vitals separator */}
          <div className="col-span-2 pt-1 border-t border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
              Sinais Vitais Iniciais <OptLabel />
            </p>
          </div>

          <div className="col-span-2 space-y-1">
            <FormLabel className="text-xs text-muted-foreground">PA (mmHg)</FormLabel>
            <div className="flex items-center gap-2">
              <FormField control={form.control} name="systolicBp" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl><Input type="number" min={0} placeholder="Sistólica" data-testid="input-systolicBp" {...field} /></FormControl>
                </FormItem>
              )} />
              <span className="text-muted-foreground">/</span>
              <FormField control={form.control} name="diastolicBp" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl><Input type="number" min={0} placeholder="Diastólica" data-testid="input-diastolicBp" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
          </div>

          <FormField
            control={form.control}
            name="heartRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FC (bpm)</FormLabel>
                <FormControl><Input type="number" min={0} data-testid="input-heartRate" {...field} /></FormControl>
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
                <FormControl><Input type="number" min={0} data-testid="input-respiratoryRate" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="spO2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SpO₂ (%)</FormLabel>
                <FormControl><Input type="number" min={0} max={100} data-testid="input-spO2" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperatura (°C)</FormLabel>
                <FormControl><Input type="number" min={0} step="0.1" data-testid="input-temperature" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="glucose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HGT (mg/dL)</FormLabel>
                <FormControl><Input type="number" min={0} step="0.1" data-testid="input-glucose" {...field} /></FormControl>
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

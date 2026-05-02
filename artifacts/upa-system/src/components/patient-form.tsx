import { useEffect } from "react";
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
import type { Patient } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── constants ─────────────────────────────────────────────────────────────────

const TRIAGE_OPTIONS = [
  { value: "red",    label: "Vermelho — Emergência" },
  { value: "orange", label: "Laranja — Muito Urgente" },
  { value: "yellow", label: "Amarelo — Urgente" },
  { value: "green",  label: "Verde — Pouco Urgente" },
  { value: "blue",   label: "Azul — Não Urgente" },
] as const;

const SECTOR_OPTIONS = [
  "Sala Vermelha",
  "Observação Adulto",
  "Observação Pediátrica",
  "Observação Pré-Adulto",
];

const INTERNMENT_OPTIONS = [
  { value: "internado",    label: "Internado" },
  { value: "nao_internado", label: "Não internado" },
] as const;

const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "O", label: "Não inf." },
] as const;

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// ── age helper ────────────────────────────────────────────────────────────────

function computeAge(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

// ── form schema ───────────────────────────────────────────────────────────────

const formSchema = z.object({
  // identificação
  name:       z.string().min(1, "Informe o nome completo do paciente"),
  birthDate:  z.string().default(""),
  age:        z.coerce.number().min(0).default(0),
  sex:        z.enum(["M", "F", "O"]).default("O"),
  motherName: z.string().default(""),

  // documentos
  cns:    z.string().default(""),
  cpf:    z.string().default(""),
  rg:     z.string().default(""),
  weight: z.coerce.number().min(0).default(0),

  // contato
  phone:        z.string().default(""),
  email:        z.string().default(""),
  guardianName: z.string().default(""),

  // endereço
  street:       z.string().default(""),
  addressNumber:z.string().default(""),
  neighborhood: z.string().default(""),
  city:         z.string().default(""),
  addressState: z.string().default(""),
  zipCode:      z.string().default(""),

  // dados clínicos
  status:           z.enum(["red", "orange", "yellow", "green", "blue"], {
    errorMap: () => ({ message: "Selecione a classificação de triagem" }),
  }),
  sector:           z.string().min(1, "Selecione o setor de atendimento"),
  internmentStatus: z.enum(["internado", "nao_internado"], {
    errorMap: () => ({ message: "Selecione o status de internação" }),
  }),
  nurse:     z.string().default(""),
  bed:       z.string().default(""),
  diagnosis: z.string().default(""),

  // sinais vitais iniciais
  heartRate:        z.coerce.number().min(0).default(0),
  respiratoryRate:  z.coerce.number().min(0).default(0),
  glucose:          z.coerce.number().min(0).default(0),
  spO2:             z.coerce.number().min(0).max(100).default(0),
  temperature:      z.coerce.number().min(0).default(0),
  systolicBp:       z.coerce.number().min(0).default(0),
  diastolicBp:      z.coerce.number().min(0).default(0),
});

type FormValues = z.infer<typeof formSchema>;

// ── component ─────────────────────────────────────────────────────────────────

interface PatientFormProps {
  patient?: Patient;
  onSuccess: () => void;
  onCancel:  () => void;
}

export function PatientForm({ patient, onSuccess, onCancel }: PatientFormProps) {
  const { toast }     = useToast();
  const queryClient   = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name:       patient?.name ?? "",
      birthDate:  patient?.birthDate ?? "",
      age:        patient?.age ?? 0,
      sex:        (patient?.sex as FormValues["sex"]) ?? "O",
      motherName: patient?.motherName ?? "",

      cns:    patient?.cns    ?? "",
      cpf:    patient?.cpf    ?? "",
      rg:     patient?.rg     ?? "",
      weight: patient?.weight ?? 0,

      phone:        patient?.phone        ?? "",
      email:        patient?.email        ?? "",
      guardianName: patient?.guardianName ?? "",

      street:        patient?.street        ?? "",
      addressNumber: patient?.addressNumber ?? "",
      neighborhood:  patient?.neighborhood  ?? "",
      city:          patient?.city          ?? "",
      addressState:  patient?.addressState  ?? "",
      zipCode:       patient?.zipCode       ?? "",

      status:           (patient?.status as FormValues["status"]) ?? "yellow",
      sector:           patient?.sector ?? "",
      internmentStatus: (patient?.internmentStatus as FormValues["internmentStatus"]) ?? "nao_internado",
      nurse:     patient?.nurse     ?? "",
      bed:       patient?.bed       ?? "",
      diagnosis: patient?.diagnosis ?? "",

      heartRate:       patient?.heartRate       ?? 0,
      respiratoryRate: patient?.respiratoryRate ?? 0,
      glucose:         patient?.glucose         ?? 0,
      spO2:            patient?.spO2            ?? 0,
      temperature:     patient?.temperature     ?? 0,
      systolicBp:      patient?.systolicBp      ?? 0,
      diastolicBp:     patient?.diastolicBp     ?? 0,
    },
  });

  // Auto-compute age when birthDate changes
  const birthDateValue = form.watch("birthDate");
  useEffect(() => {
    if (birthDateValue) {
      const computed = computeAge(birthDateValue);
      if (computed > 0) form.setValue("age", computed, { shouldValidate: false });
    }
  }, [birthDateValue, form]);

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

  const Opt = () => <span className="text-[11px] text-muted-foreground font-normal ml-1">(opcional)</span>;
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="col-span-2 pt-2 border-t border-border/50">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1.5 mb-0.5">{children}</p>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">

          {/* ── DADOS DO PACIENTE ──────────────────────────────────────────── */}
          <SectionTitle>Dados do Paciente</SectionTitle>

          {/* Nome — full width, required */}
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Nome Completo</FormLabel>
              <FormControl><Input placeholder="Nome completo" data-testid="input-name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Data de nascimento */}
          <FormField control={form.control} name="birthDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Nascimento <Opt /></FormLabel>
              <FormControl>
                <Input type="date" data-testid="input-birthDate" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Idade — read-only when birthDate is set */}
          <FormField control={form.control} name="age" render={({ field }) => (
            <FormItem>
              <FormLabel>
                Idade
                {birthDateValue
                  ? <span className="text-[11px] text-primary font-normal ml-1">(automática)</span>
                  : <Opt />}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  data-testid="input-age"
                  readOnly={!!birthDateValue}
                  className={birthDateValue ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Sexo — button group, full width */}
          <FormField control={form.control} name="sex" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Sexo <Opt /></FormLabel>
              <div className="grid grid-cols-3 gap-2">
                {SEX_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors h-10",
                      field.value === opt.value
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    )}
                  >{opt.label}</button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />

          {/* Nome da mãe */}
          <FormField control={form.control} name="motherName" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Nome da Mãe <Opt /></FormLabel>
              <FormControl><Input placeholder="Nome completo da mãe" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── DOCUMENTOS ────────────────────────────────────────────────── */}
          <SectionTitle>Documentos</SectionTitle>

          <FormField control={form.control} name="cns" render={({ field }) => (
            <FormItem>
              <FormLabel>CNS (Cartão SUS) <Opt /></FormLabel>
              <FormControl><Input placeholder="000 0000 0000 0000" maxLength={18} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="cpf" render={({ field }) => (
            <FormItem>
              <FormLabel>CPF <Opt /></FormLabel>
              <FormControl><Input placeholder="000.000.000-00" maxLength={14} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="rg" render={({ field }) => (
            <FormItem>
              <FormLabel>RG <Opt /></FormLabel>
              <FormControl><Input placeholder="0.000.000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="weight" render={({ field }) => (
            <FormItem>
              <FormLabel>Peso (kg) <Opt /></FormLabel>
              <FormControl>
                <Input type="number" min={0} step={0.1} placeholder="Ex: 72.5" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── CONTATO ───────────────────────────────────────────────────── */}
          <SectionTitle>Contato</SectionTitle>

          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone <Opt /></FormLabel>
              <FormControl><Input placeholder="(00) 00000-0000" maxLength={15} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail <Opt /></FormLabel>
              <FormControl><Input placeholder="paciente@exemplo.com" type="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="guardianName" render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Responsável <Opt /></FormLabel>
              <FormControl><Input placeholder="Para menores ou incapazes" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── ENDEREÇO ──────────────────────────────────────────────────── */}
          <SectionTitle>Endereço</SectionTitle>

          <FormField control={form.control} name="street" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Rua <Opt /></FormLabel>
              <FormControl><Input placeholder="Nome da rua ou avenida" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Número <Opt /></FormLabel>
              <FormControl><Input placeholder="Nº / S/N" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="neighborhood" render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro <Opt /></FormLabel>
              <FormControl><Input placeholder="Bairro" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>Cidade <Opt /></FormLabel>
              <FormControl><Input placeholder="Município" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressState" render={({ field }) => (
            <FormItem>
              <FormLabel>Estado <Opt /></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-48">
                  {ESTADOS_BR.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="zipCode" render={({ field }) => (
            <FormItem>
              <FormLabel>CEP <Opt /></FormLabel>
              <FormControl><Input placeholder="00000-000" maxLength={9} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── DADOS CLÍNICOS ────────────────────────────────────────────── */}
          <SectionTitle>Dados Clínicos</SectionTitle>

          {/* Triagem — full width */}
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Classificação de Risco (Manchester)</FormLabel>
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
          )} />

          {/* Setor */}
          <FormField control={form.control} name="sector" render={({ field }) => (
            <FormItem>
              <FormLabel>Setor</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-sector">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SECTOR_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Leito */}
          <FormField control={form.control} name="bed" render={({ field }) => (
            <FormItem>
              <FormLabel>Leito <Opt /></FormLabel>
              <FormControl><Input placeholder="A1, B3..." data-testid="input-bed" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Diagnóstico — full width */}
          <FormField control={form.control} name="diagnosis" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Hipótese Diagnóstica <Opt /></FormLabel>
              <FormControl>
                <Input placeholder="Queixa principal ou hipótese diagnóstica" data-testid="input-diagnosis" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Internação — full width */}
          <FormField control={form.control} name="internmentStatus" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Status de Internação</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {INTERNMENT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                      field.value === opt.value
                        ? opt.value === "internado"
                          ? "bg-blue-500/20 border-blue-500 text-blue-400"
                          : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : "bg-card/30 border-border/50 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <span className={cn(
                      "flex h-4 w-4 shrink-0 rounded-full border-2 items-center justify-center",
                      field.value === opt.value
                        ? opt.value === "internado" ? "border-blue-500" : "border-emerald-500"
                        : "border-muted-foreground/40"
                    )}>
                      {field.value === opt.value && (
                        <span className={cn("h-2 w-2 rounded-full",
                          opt.value === "internado" ? "bg-blue-500" : "bg-emerald-500"
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

          {/* Responsável */}
          <FormField control={form.control} name="nurse" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Profissional Responsável <Opt /></FormLabel>
              <FormControl>
                <Input placeholder="Técnico(a) ou Enfermeiro(a) responsável" data-testid="input-nurse" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── SINAIS VITAIS INICIAIS ─────────────────────────────────── */}
          <SectionTitle>Sinais Vitais Iniciais <Opt /></SectionTitle>

          <div className="col-span-2 space-y-1">
            <p className="text-xs text-muted-foreground">PA (mmHg)</p>
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

          <FormField control={form.control} name="heartRate" render={({ field }) => (
            <FormItem>
              <FormLabel>FC (bpm)</FormLabel>
              <FormControl><Input type="number" min={0} data-testid="input-heartRate" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="respiratoryRate" render={({ field }) => (
            <FormItem>
              <FormLabel>FR (irpm)</FormLabel>
              <FormControl><Input type="number" min={0} data-testid="input-respiratoryRate" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="spO2" render={({ field }) => (
            <FormItem>
              <FormLabel>SpO₂ (%)</FormLabel>
              <FormControl><Input type="number" min={0} max={100} data-testid="input-spO2" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="temperature" render={({ field }) => (
            <FormItem>
              <FormLabel>Temperatura (°C)</FormLabel>
              <FormControl><Input type="number" min={0} step="0.1" data-testid="input-temperature" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="glucose" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>HGT (mg/dL)</FormLabel>
              <FormControl><Input type="number" min={0} step="0.1" data-testid="input-glucose" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

        </div>

        <div className="flex justify-end gap-2 pt-5 mt-4 border-t border-border/50">
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

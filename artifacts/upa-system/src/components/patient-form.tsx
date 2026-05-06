import { useEffect } from "react";
import { useFeatures } from "@/lib/features-context";
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
import type { Patient, CreatePatientBody } from "@workspace/api-client-react";
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
  { value: "triagem",               label: "Triagem"               },
  { value: "sala_vermelha",         label: "Sala Vermelha"         },
  { value: "observacao_adulto",     label: "Observação Adulto"     },
  { value: "observacao_pediatrica", label: "Observação Pediátrica" },
  { value: "observacao_pre_adulto", label: "Observação Pré-Adulto" },
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
  full_name:  z.string().min(1, "Informe o nome completo do paciente"),
  birthDate:  z.string().default(""),
  age:        z.coerce.number().min(0).default(0),
  sex:        z.enum(["M", "F", "O"]).default("O"),
  motherName: z.string().default(""),

  cns:    z.string().default(""),
  cpf:    z.string().default(""),
  rg:     z.string().default(""),

  addressStreet:       z.string().default(""),
  addressNumber:       z.string().default(""),
  addressNeighborhood: z.string().default(""),
  addressCity:         z.string().default(""),
  addressCep:          z.string().default(""),
  phone:   z.string().default(""),
  email:   z.string().default(""),

  triage_level:     z.enum(["red", "orange", "yellow", "green", "blue"], {
    errorMap: () => ({ message: "Selecione a classificação de triagem" }),
  }),
  sector:           z.string().min(1, "Selecione o setor de atendimento"),
  internmentStatus: z.enum(["internado", "nao_internado"], {
    errorMap: () => ({ message: "Selecione o status de internação" }),
  }),
  nurse:     z.string().default(""),
  bed:       z.string().default(""),
  diagnosis: z.string().default(""),
  symptoms:  z.string().default(""),
  symptomOnsetDate:        z.string().default(""),
  attendanceDate:          z.string().default(""),
  attendanceTime:          z.string().default(""),
  healthUnit:              z.string().default("UPA Breves - Breves/PA"),
  responsibleProfessional: z.string().default(""),

  agravo:               z.string().default(""),
  dataNotificacao:      z.string().default(""),
  municipioNotificacao: z.string().default(""),
  codigoIbge:           z.string().default(""),
  evolucaoCaso:         z.string().default(""),
  classificacaoFinal:   z.string().default(""),
  criterioConfirmacao:  z.string().default(""),
});

type FormValues = z.infer<typeof formSchema>;

// ── component ─────────────────────────────────────────────────────────────────

interface PatientFormProps {
  patient?: Patient;
  onSuccess: () => void;
  onCancel:  () => void;
}

export function PatientForm({ patient, onSuccess, onCancel }: PatientFormProps) {
  const { toast }        = useToast();
  const queryClient      = useQueryClient();
  const { featureAtiva } = useFeatures();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name:  patient?.full_name  ?? "",
      birthDate:  patient?.birthDate  ?? "",
      age:        patient?.age        ?? 0,
      sex:        (patient?.sex as FormValues["sex"]) ?? "O",
      motherName: patient?.motherName ?? "",

      cns: patient?.cns ?? "",
      cpf: patient?.cpf ?? "",
      rg:  patient?.rg  ?? "",

      addressStreet:       (patient as unknown as Record<string, string> | undefined)?.["addressStreet"] ?? "",
      addressNumber:       (patient as unknown as Record<string, string> | undefined)?.["addressNumber"] ?? "",
      addressNeighborhood: (patient as unknown as Record<string, string> | undefined)?.["addressNeighborhood"] ?? "",
      addressCity:         (patient as unknown as Record<string, string> | undefined)?.["addressCity"] ?? "",
      addressCep:          (patient as unknown as Record<string, string> | undefined)?.["addressCep"] ?? "",
      phone:   patient?.phone   ?? "",
      email:   patient?.email   ?? "",

      triage_level:     (patient?.triage_level as FormValues["triage_level"]) ?? "yellow",
      sector:            patient?.sector ?? "",
      internmentStatus: (patient?.internmentStatus as FormValues["internmentStatus"]) ?? "nao_internado",
      nurse:     patient?.nurse     ?? "",
      bed:       patient?.bed       ?? "",
      diagnosis: patient?.diagnosis ?? "",
      symptoms:  patient?.symptoms  ?? "",
      symptomOnsetDate:        patient?.symptomOnsetDate        ?? "",
      attendanceDate:          patient?.attendanceDate          ?? new Date().toISOString().slice(0, 10),
      attendanceTime:          patient?.attendanceTime          ?? "",
      healthUnit:              patient?.healthUnit              ?? "UPA Breves - Breves/PA",
      responsibleProfessional: patient?.responsibleProfessional ?? "",

      agravo:               patient?.agravo               ?? "",
      dataNotificacao:      patient?.dataNotificacao      ?? "",
      municipioNotificacao: patient?.municipioNotificacao ?? "",
      codigoIbge:           patient?.codigoIbge           ?? "",
      evolucaoCaso:         patient?.evolucaoCaso         ?? "",
      classificacaoFinal:   patient?.classificacaoFinal   ?? "",
      criterioConfirmacao:  patient?.criterioConfirmacao  ?? "",
    },
  });

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
    const { addressStreet, addressNumber, addressNeighborhood, addressCity, addressCep, ...rest } = data;
    const address = [addressStreet, addressNumber, addressNeighborhood, addressCity, addressCep]
      .filter(Boolean).join(", ");
    const payload = {
      ...rest,
      address,
      addressStreet,
      addressNumber,
      addressNeighborhood,
      addressCity,
      addressCep,
    } as unknown as CreatePatientBody;

    if (patient) {
      updatePatient.mutate({ id: patient.id, data: payload }, {
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
      createPatient.mutate({ data: payload }, {
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

          {/* ── DADOS DO PACIENTE ──────────────────────────────────────── */}
          <SectionTitle>Dados do Paciente</SectionTitle>

          <FormField control={form.control} name="full_name" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Nome Completo</FormLabel>
              <FormControl><Input placeholder="Nome completo" data-testid="input-name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="birthDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Nascimento <Opt /></FormLabel>
              <FormControl><Input type="date" data-testid="input-birthDate" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

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
                  type="number" min={0}
                  data-testid="input-age"
                  readOnly={!!birthDateValue}
                  className={birthDateValue ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

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

          <FormField control={form.control} name="motherName" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Nome da Mãe <Opt /></FormLabel>
              <FormControl><Input placeholder="Nome completo da mãe" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── DOCUMENTOS ────────────────────────────────────────────── */}
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

          {/* ── CONTATO / ENDEREÇO ────────────────────────────────────── */}
          <SectionTitle>Contato e Endereço</SectionTitle>

          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone <Opt /></FormLabel>
              <FormControl><Input placeholder="(91) 9xxxx-xxxx" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail <Opt /></FormLabel>
              <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressStreet" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Logradouro <Opt /></FormLabel>
              <FormControl><Input placeholder="Rua, Av., Travessa, Passagem..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Número <Opt /></FormLabel>
              <FormControl><Input placeholder="123 / S/N" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressNeighborhood" render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro <Opt /></FormLabel>
              <FormControl><Input placeholder="Bairro" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressCity" render={({ field }) => (
            <FormItem>
              <FormLabel>Cidade <Opt /></FormLabel>
              <FormControl><Input placeholder="Breves" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="addressCep" render={({ field }) => (
            <FormItem>
              <FormLabel>CEP <Opt /></FormLabel>
              <FormControl>
                <Input
                  placeholder="68800-000"
                  maxLength={9}
                  {...field}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "");
                    field.onChange(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5, 8)}` : v);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── DADOS CLÍNICOS ────────────────────────────────────────── */}
          <SectionTitle>Classificação e Setor</SectionTitle>

          {/* Triagem — button group */}
          <FormField control={form.control} name="triage_level" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Triagem Manchester</FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TRIAGE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors h-10 text-left",
                      field.value === opt.value
                        ? opt.value === "red"    ? "bg-red-500/20 border-red-500 text-red-400"
                        : opt.value === "orange" ? "bg-orange-500/20 border-orange-500 text-orange-400"
                        : opt.value === "yellow" ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                        : opt.value === "green"  ? "bg-green-500/20 border-green-500 text-green-400"
                        :                          "bg-blue-500/20 border-blue-500 text-blue-400"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    )}
                  >{opt.label}</button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />

          {/* Setor */}
          <FormField control={form.control} name="sector" render={({ field }) => (
            <FormItem>
              <FormLabel>Setor</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-sector"><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SECTOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Leito */}
          <FormField control={form.control} name="bed" render={({ field }) => (
            <FormItem>
              <FormLabel>Leito <Opt /></FormLabel>
              <FormControl><Input placeholder="Ex: 01, A3..." data-testid="input-bed" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Status de internação */}
          <FormField control={form.control} name="internmentStatus" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Status de Internação</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {INTERNMENT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
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

          {/* ── ATENDIMENTO ────────────────────────────────────────────── */}
          <SectionTitle>Atendimento</SectionTitle>

          <FormField control={form.control} name="diagnosis" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Diagnóstico / Queixa principal <Opt /></FormLabel>
              <FormControl><Input placeholder="Ex: Febre, dor abdominal..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="symptoms" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Sintomas <Opt /></FormLabel>
              <FormControl><Input placeholder="Descreva os sintomas" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="attendanceDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Atendimento <Opt /></FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="attendanceTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Hora de Atendimento <Opt /></FormLabel>
              <FormControl><Input type="time" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="responsibleProfessional" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Profissional Responsável <Opt /></FormLabel>
              <FormControl>
                <Input placeholder="Nome do profissional responsável" data-testid="input-nurse" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── NOTIFICAÇÃO SINAN ─────────────────────────────────────── */}
          {featureAtiva("sinan_pdf") && (<>
          <SectionTitle>Notificação SINAN</SectionTitle>

          <FormField control={form.control} name="agravo" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Agravo / Doença <Opt /></FormLabel>
              <FormControl><Input placeholder="Ex: Dengue, Tuberculose..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="dataNotificacao" render={({ field }) => (
            <FormItem>
              <FormLabel>Data da Notificação <Opt /></FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="municipioNotificacao" render={({ field }) => (
            <FormItem>
              <FormLabel>Município de Notificação <Opt /></FormLabel>
              <FormControl><Input placeholder="Ex: Breves" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="codigoIbge" render={({ field }) => (
            <FormItem>
              <FormLabel>Código IBGE <Opt /></FormLabel>
              <FormControl><Input placeholder="Ex: 1501501" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="evolucaoCaso" render={({ field }) => (
            <FormItem>
              <FormLabel>Evolução do Caso <Opt /></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Em investigação">Em investigação</SelectItem>
                  <SelectItem value="Cura">Cura</SelectItem>
                  <SelectItem value="Óbito pelo agravo notificado">Óbito pelo agravo notificado</SelectItem>
                  <SelectItem value="Óbito por outras causas">Óbito por outras causas</SelectItem>
                  <SelectItem value="Óbito em investigação">Óbito em investigação</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="classificacaoFinal" render={({ field }) => (
            <FormItem>
              <FormLabel>Classificação Final <Opt /></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Confirmado laboratorial">Confirmado laboratorial</SelectItem>
                  <SelectItem value="Confirmado clínico-epidemiológico">Confirmado clínico-epidemiológico</SelectItem>
                  <SelectItem value="Confirmado clínico">Confirmado clínico</SelectItem>
                  <SelectItem value="Descartado">Descartado</SelectItem>
                  <SelectItem value="Inconclusivo">Inconclusivo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="criterioConfirmacao" render={({ field }) => (
            <FormItem>
              <FormLabel>Critério de Confirmação <Opt /></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Laboratorial">Laboratorial</SelectItem>
                  <SelectItem value="Clínico-epidemiológico">Clínico-epidemiológico</SelectItem>
                  <SelectItem value="Clínico">Clínico</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          </>)}

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

import { useState, useEffect } from "react";
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
import { Bell, AlertTriangle, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { SINAN_AGRAVOS, findAgravo } from "@/lib/sinan-agravos";
import { generateSinanPdfBlob } from "@/lib/pdf-fill";
import type { PdfPatient } from "@/lib/pdf-fill";

// ── zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  agravoCode:          z.string().min(1, "Selecione o agravo"),
  dataNotificacao:     z.string().min(1, "Informe a data de notificação"),
  dataInicioSintomas:  z.string().default(""),
  logradouro:          z.string().default(""),
  numeroEndereco:      z.string().default(""),
  complemento:         z.string().default(""),
  bairro:              z.string().default(""),
  municipioResidencia: z.string().default(""),
  ufResidencia:        z.string().default(""),
  cep:                 z.string().default(""),
  classification:      z.string().default(""),
  formData:            z.string().default("{}"),
});

type FormValues = z.infer<typeof schema>;

// ── helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10);

function toPdfPatient(p: Patient): PdfPatient {
  return {
    full_name:               p.full_name,
    birthDate:               p.birthDate,
    age:                     p.age,
    sex:                     p.sex,
    motherName:              p.motherName,
    cns:                     p.cns,
    cpf:                     p.cpf,
    rg:                      p.rg,
    phone:                   p.phone,
    email:                   p.email,
    symptoms:                p.symptoms,
    symptomOnsetDate:        p.symptomOnsetDate,
    address:                 p.address,
    healthUnit:              p.healthUnit,
    responsibleProfessional: p.responsibleProfessional,
    attendanceDate:          p.attendanceDate,
    attendanceTime:          p.attendanceTime,
    agravo:                  p.agravo,
    dataNotificacao:         p.dataNotificacao,
    municipioNotificacao:    p.municipioNotificacao,
    codigoIbge:              p.codigoIbge,
    evolucaoCaso:            p.evolucaoCaso,
    classificacaoFinal:      p.classificacaoFinal,
    criterioConfirmacao:     p.criterioConfirmacao,
  };
}

// ── label constants ──────────────────────────────────────────────────────────

const CLASSIFICACAO_OPTS = [
  { value: "Suspeito",                   label: "Suspeito" },
  { value: "Confirmado Laboratorial",    label: "Confirmado — Critério Laboratorial" },
  { value: "Confirmado Clínico-Epidemiológico", label: "Confirmado — Critério Clínico-Epidemiológico" },
  { value: "Descartado",                 label: "Descartado" },
  { value: "Inconclusivo",              label: "Inconclusivo" },
];

// ── disease-specific field groups ────────────────────────────────────────────

type CheckField = { key: string; label: string };

const DENGUE_SINAIS: CheckField[] = [
  { key: "febre",        label: "Febre" },
  { key: "cefaleia",     label: "Cefaleia" },
  { key: "mialgia",      label: "Mialgia" },
  { key: "exantema",     label: "Exantema" },
  { key: "nauseas",      label: "Náuseas" },
  { key: "vomito",       label: "Vômito" },
  { key: "artralgia",    label: "Artralgia" },
  { key: "artrite",      label: "Artrite" },
  { key: "petequias",    label: "Petéquias" },
  { key: "prova_laco",   label: "Prova do Laço +" },
  { key: "leucopenia",   label: "Leucopenia" },
  { key: "dor_retro",    label: "Dor retroorbital" },
];

const COVID_SINTOMAS: CheckField[] = [
  { key: "febre",        label: "Febre" },
  { key: "tosse",        label: "Tosse" },
  { key: "coriza",       label: "Coriza" },
  { key: "dor_garganta", label: "Dor de garganta" },
  { key: "dispneia",     label: "Dispneia" },
  { key: "dist_olfato",  label: "Dist. olfativos" },
  { key: "dist_paladar", label: "Dist. gustativos" },
  { key: "diarreia",     label: "Diarreia" },
];

const SRAG_SINTOMAS: CheckField[] = [
  { key: "febre",            label: "Febre" },
  { key: "tosse",            label: "Tosse" },
  { key: "dor_garganta",     label: "Dor de garganta" },
  { key: "dispneia",         label: "Dispneia / desconforto resp." },
  { key: "sat_o2_menor_95",  label: "Saturação O₂ < 95%" },
  { key: "diarreia",         label: "Diarreia" },
  { key: "vomito",           label: "Vômito" },
];

const TB_FORMAS = [
  { value: "pulmonar",            label: "Pulmonar" },
  { value: "extrapulmonar",       label: "Extrapulmonar" },
  { value: "pulmonar_extrapulmonar", label: "Pulmonar + Extrapulmonar" },
];

const TB_ENTRADAS = [
  { value: "caso_novo",   label: "Caso Novo" },
  { value: "recidiva",    label: "Recidiva" },
  { value: "reingresso",  label: "Reingresso após Abandono" },
  { value: "transferencia", label: "Transferência" },
  { value: "pos_obito",   label: "Pós-óbito" },
  { value: "nao_sabe",    label: "Não Sabe" },
];

const SIM_NAO_IGN = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "ignorado", label: "Ignorado" },
];

const EVOLUCAO_OPTS = [
  { value: "cura",               label: "Cura" },
  { value: "obito",              label: "Óbito" },
  { value: "em_tratamento",      label: "Em Tratamento" },
  { value: "tratamento_domiciliar", label: "Tratamento Domiciliar" },
  { value: "transferencia",      label: "Transferência" },
  { value: "abandono",           label: "Abandono" },
  { value: "ignorado",           label: "Ignorado" },
];

// ── sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1 mb-3">
      {children}
    </p>
  );
}

function SelectField({ label, name, options, value, onChange }: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <select
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Selecione —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CheckGroup({ title, fields, checked, onToggle }: {
  title: string;
  fields: CheckField[];
  checked: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{title}</label>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {fields.map(f => (
          <label key={f.key} className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground">
            <input
              type="checkbox"
              checked={checked.has(f.key)}
              onChange={() => onToggle(f.key)}
              className="accent-primary"
            />
            {f.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── disease-specific fields per agravo group ─────────────────────────────────

function DengueFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const sinais = new Set((fd["sinais"] ?? "").split(",").filter(Boolean));
  const toggle = (k: string) => {
    const next = new Set(sinais);
    next.has(k) ? next.delete(k) : next.add(k);
    setFd({ ...fd, sinais: [...next].join(",") });
  };
  return (
    <div className="space-y-3">
      <CheckGroup title="Sinais e Sintomas" fields={DENGUE_SINAIS} checked={sinais} onToggle={toggle} />
      <SelectField label="Forma Clínica / Classificação" name="forma_clinica" options={[
        { value: "dengue",         label: "Dengue" },
        { value: "dengue_alarme",  label: "Dengue com Sinais de Alarme" },
        { value: "dengue_grave",   label: "Dengue Grave" },
        { value: "chikungunya",    label: "Chikungunya" },
      ]} value={fd["forma_clinica"] ?? ""} onChange={v => setFd({ ...fd, forma_clinica: v })} />
      <SelectField label="Internação" name="internacao" options={SIM_NAO_IGN} value={fd["internacao"] ?? ""} onChange={v => setFd({ ...fd, internacao: v })} />
    </div>
  );
}

function CovidFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const sinais = new Set((fd["sinais"] ?? "").split(",").filter(Boolean));
  const toggle = (k: string) => {
    const next = new Set(sinais);
    next.has(k) ? next.delete(k) : next.add(k);
    setFd({ ...fd, sinais: [...next].join(",") });
  };
  return (
    <div className="space-y-3">
      <CheckGroup title="Sintomas" fields={COVID_SINTOMAS} checked={sinais} onToggle={toggle} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <SelectField label="UTI" name="uti" options={SIM_NAO_IGN} value={fd["uti"] ?? ""} onChange={v => setFd({ ...fd, uti: v })} />
      </div>
    </div>
  );
}

function SragFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const sinais = new Set((fd["sinais"] ?? "").split(",").filter(Boolean));
  const toggle = (k: string) => {
    const next = new Set(sinais);
    next.has(k) ? next.delete(k) : next.add(k);
    setFd({ ...fd, sinais: [...next].join(",") });
  };
  return (
    <div className="space-y-3">
      <CheckGroup title="Sinais e Sintomas" fields={SRAG_SINTOMAS} checked={sinais} onToggle={toggle} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Internação" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <SelectField label="UTI" name="uti" options={SIM_NAO_IGN} value={fd["uti"] ?? ""} onChange={v => setFd({ ...fd, uti: v })} />
      </div>
      <SelectField label="Suporte Ventilatório" name="ventilacao" options={[
        { value: "invasivo",     label: "Sim — Invasivo" },
        { value: "nao_invasivo", label: "Sim — Não Invasivo" },
        { value: "nao",          label: "Não" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["ventilacao"] ?? ""} onChange={v => setFd({ ...fd, ventilacao: v })} />
    </div>
  );
}

function TuberculoseFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Tipo de Entrada" name="tipo_entrada" options={TB_ENTRADAS} value={fd["tipo_entrada"] ?? ""} onChange={v => setFd({ ...fd, tipo_entrada: v })} />
      <SelectField label="Forma Clínica" name="forma" options={TB_FORMAS} value={fd["forma"] ?? ""} onChange={v => setFd({ ...fd, forma: v })} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Baciloscopia de Escarro" name="baciloscopia" options={[
          { value: "positiva",      label: "Positiva" },
          { value: "negativa",      label: "Negativa" },
          { value: "nao_realizada", label: "Não Realizada" },
          { value: "nao_aplica",    label: "Não se Aplica" },
        ]} value={fd["baciloscopia"] ?? ""} onChange={v => setFd({ ...fd, baciloscopia: v })} />
        <SelectField label="Sorologia HIV" name="hiv" options={[
          { value: "positivo",    label: "Positivo" },
          { value: "negativo",    label: "Negativo" },
          { value: "andamento",   label: "Em Andamento" },
          { value: "nao_realizado", label: "Não Realizado" },
        ]} value={fd["hiv"] ?? ""} onChange={v => setFd({ ...fd, hiv: v })} />
      </div>
    </div>
  );
}

function FebreAmarelaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Vacinado contra Febre Amarela?" name="vacinado" options={SIM_NAO_IGN} value={fd["vacinado"] ?? ""} onChange={v => setFd({ ...fd, vacinado: v })} />
      <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
    </div>
  );
}

function FebreTifoideFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Tipo de Atendimento" name="tipo_atendimento" options={[
        { value: "hospitalar",   label: "Hospitalar" },
        { value: "ambulatorial", label: "Ambulatorial" },
        { value: "domiciliar",   label: "Domiciliar" },
        { value: "nenhum",       label: "Nenhum" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["tipo_atendimento"] ?? ""} onChange={v => setFd({ ...fd, tipo_atendimento: v })} />
      <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
    </div>
  );
}

function MeningiteFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Tipo de Meningite" name="tipo_meningite" options={[
        { value: "bacteriana", label: "Bacteriana" },
        { value: "viral",      label: "Viral" },
        { value: "fungica",    label: "Fúngica" },
        { value: "outra",      label: "Outra" },
        { value: "ignorado",   label: "Ignorado" },
      ]} value={fd["tipo_meningite"] ?? ""} onChange={v => setFd({ ...fd, tipo_meningite: v })} />
      <SelectField label="Agente Etiológico" name="agente" options={[
        { value: "meningococo",  label: "Meningococo (N. meningitidis)" },
        { value: "pneumococo",   label: "Pneumococo (S. pneumoniae)" },
        { value: "haemophilus",  label: "Haemophilus influenzae" },
        { value: "listeria",     label: "Listeria monocytogenes" },
        { value: "outros",       label: "Outros" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["agente"] ?? ""} onChange={v => setFd({ ...fd, agente: v })} />
      <SelectField label="Critério de Confirmação" name="criterio_mening" options={[
        { value: "cultura",          label: "Cultura" },
        { value: "cie",              label: "CIE" },
        { value: "ag_latex",         label: "Ag Látex" },
        { value: "bacterioscopia",   label: "Bacterioscopia" },
        { value: "clinico",          label: "Clínico" },
        { value: "quimiocitologico", label: "Quimiocitológico" },
        { value: "clinico_epid",     label: "Clínico-Epidemiológico" },
        { value: "pcr",              label: "PCR" },
        { value: "outros",           label: "Outros" },
      ]} value={fd["criterio_mening"] ?? ""} onChange={v => setFd({ ...fd, criterio_mening: v })} />
      <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
    </div>
  );
}

function ExantematicaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Classificação Final" name="classificacao_exant" options={[
        { value: "sarampo",    label: "Sarampo" },
        { value: "rubeola",    label: "Rubéola" },
        { value: "descartado", label: "Descartado" },
      ]} value={fd["classificacao_exant"] ?? ""} onChange={v => setFd({ ...fd, classificacao_exant: v })} />
      <SelectField label="Critério de Confirmação" name="criterio_exant" options={[
        { value: "laboratorial",  label: "Laboratorial" },
        { value: "clinico_epid",  label: "Clínico-Epidemiológico" },
        { value: "clinico",       label: "Clínico" },
      ]} value={fd["criterio_exant"] ?? ""} onChange={v => setFd({ ...fd, criterio_exant: v })} />
      <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
    </div>
  );
}

function AidsAdultoFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Evolução" name="evolucao" options={[
        { value: "vivo",         label: "Vivo" },
        { value: "obito_aids",   label: "Óbito por AIDS" },
        { value: "obito_outras", label: "Óbito por outras causas" },
      ]} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

function GenericFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      <SelectField label="Tipo de Atendimento" name="tipo_atendimento" options={[
        { value: "hospitalar",   label: "Hospitalar" },
        { value: "ambulatorial", label: "Ambulatorial" },
        { value: "domiciliar",   label: "Domiciliar" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["tipo_atendimento"] ?? ""} onChange={v => setFd({ ...fd, tipo_atendimento: v })} />
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Observações Complementares</label>
        <textarea
          value={fd["observacoes"] ?? ""}
          onChange={e => setFd({ ...fd, observacoes: e.target.value })}
          rows={3}
          placeholder="Informações adicionais específicas deste agravo..."
          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

function DiseaseSpecificFields({ agravoCode, fd, setFd }: {
  agravoCode: string;
  fd: Record<string, string>;
  setFd: (fd: Record<string, string>) => void;
}) {
  if (["dengue", "dengue_grave", "chikungunya"].includes(agravoCode)) return <DengueFields fd={fd} setFd={setFd} />;
  if (agravoCode === "covid19") return <CovidFields fd={fd} setFd={setFd} />;
  if (["srag", "influenza_pandemia"].includes(agravoCode)) return <SragFields fd={fd} setFd={setFd} />;
  if (agravoCode === "tuberculose") return <TuberculoseFields fd={fd} setFd={setFd} />;
  if (agravoCode === "febre_amarela") return <FebreAmarelaFields fd={fd} setFd={setFd} />;
  if (agravoCode === "febre_tifoide") return <FebreTifoideFields fd={fd} setFd={setFd} />;
  if (agravoCode === "meningite") return <MeningiteFields fd={fd} setFd={setFd} />;
  if (["sarampo", "rubeola"].includes(agravoCode)) return <ExantematicaFields fd={fd} setFd={setFd} />;
  if (agravoCode === "aids_adulto") return <AidsAdultoFields fd={fd} setFd={setFd} />;
  return <GenericFields fd={fd} setFd={setFd} />;
}

// ── main component ───────────────────────────────────────────────────────────

interface NotificationFormProps {
  patient:       Patient;
  notification?: PatientNotification;
  onSuccess:     () => void;
  onCancel:      () => void;
}

export function NotificationForm({ patient, notification, onSuccess, onCancel }: NotificationFormProps) {
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const [fd, setFd] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {
      unidade_saude:            patient.healthUnit              ?? "",
      municipio_notificacao:    patient.municipioNotificacao    ?? "",
      profissional_responsavel: patient.responsibleProfessional ?? "",
      codigo_ibge:              patient.codigoIbge              ?? "",
    };
    try {
      const saved = notification?.formData ? JSON.parse(notification.formData) : {};
      return { ...base, ...saved };
    } catch { return base; }
  });
  const [generating, setGenerating] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      agravoCode:          notification?.agravoCode          ?? "",
      dataNotificacao:     notification?.dataNotificacao      || todayISO(),
      dataInicioSintomas:  notification?.dataInicioSintomas   || patient.symptomOnsetDate || "",
      logradouro:          notification?.logradouro           ?? "",
      numeroEndereco:      notification?.numeroEndereco        ?? "",
      complemento:         notification?.complemento          ?? "",
      bairro:              notification?.bairro               ?? "",
      municipioResidencia: notification?.municipioResidencia  || patient.municipioNotificacao || "",
      ufResidencia:        notification?.ufResidencia         ?? "PA",
      cep:                 notification?.cep                  ?? "",
      classification:      notification?.classification       ?? "",
      formData:            notification?.formData             ?? "{}",
    },
  });

  const selectedCode = form.watch("agravoCode");
  const agravo       = findAgravo(selectedCode);

  // reset disease-specific fields when agravo changes, preserving base fields
  useEffect(() => {
    if (!notification) {
      setFd({
        unidade_saude:            patient.healthUnit              ?? "",
        municipio_notificacao:    patient.municipioNotificacao    ?? "",
        profissional_responsavel: patient.responsibleProfessional ?? "",
        codigo_ibge:              patient.codigoIbge              ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, notification]);

  const createNotif = useAddPatientNotification();
  const updateNotif = useUpdatePatientNotification();
  const isPending   = createNotif.isPending || updateNotif.isPending;

  async function onSubmit(data: FormValues) {
    const formDataStr = JSON.stringify(fd);
    const payload = {
      disease:             agravo?.label ?? data.agravoCode,
      classification:      data.classification,
      agravoCode:          data.agravoCode,
      cid10:               agravo?.cid10 ?? "",
      dataNotificacao:     data.dataNotificacao,
      dataInicioSintomas:  data.dataInicioSintomas,
      logradouro:          data.logradouro,
      numeroEndereco:      data.numeroEndereco,
      complemento:         data.complemento,
      bairro:              data.bairro,
      municipioResidencia: data.municipioResidencia,
      ufResidencia:        data.ufResidencia,
      cep:                 data.cep,
      formData:            formDataStr,
    };
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: getGetPatientNotificationsQueryKey(patient.id) });

    if (notification) {
      updateNotif.mutate({ id: patient.id, notificationId: notification.id, data: payload }, {
        onSuccess: () => { invalidate(); toast({ title: "Notificação atualizada" }); onSuccess(); },
        onError:   () => toast({ title: "Erro ao atualizar notificação", variant: "destructive" }),
      });
    } else {
      createNotif.mutate({ id: patient.id, data: payload }, {
        onSuccess: () => { invalidate(); toast({ title: "Notificação registrada" }); onSuccess(); },
        onError:   () => toast({ title: "Erro ao registrar notificação", variant: "destructive" }),
      });
    }
  }

  async function handleGeneratePdf() {
    const values = form.getValues();
    const formDataStr = JSON.stringify(fd);
    setGenerating(true);
    try {
      const notifForPdf = {
        disease:             agravo?.label ?? values.agravoCode,
        classification:      values.classification,
        agravoCode:          values.agravoCode,
        dataNotificacao:     values.dataNotificacao,
        dataInicioSintomas:  values.dataInicioSintomas,
        logradouro:          values.logradouro,
        numeroEndereco:      values.numeroEndereco,
        complemento:         values.complemento,
        bairro:              values.bairro,
        municipioResidencia: values.municipioResidencia,
        ufResidencia:        values.ufResidencia,
        cep:                 values.cep,
        formData:            formDataStr,
      };
      const blob = await generateSinanPdfBlob(toPdfPatient(patient), notifForPdf, import.meta.env.BASE_URL);
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement("a"), {
        href: url,
        download: `SINAN_${agravo?.code ?? "notificacao"}_${patient.full_name.replace(/\s+/g, "_")}_${values.dataNotificacao}.pdf`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF gerado — verifique os downloads" });
    } catch (e) {
      toast({ title: "Erro ao gerar PDF", description: String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-0.5">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              {notification ? "Editar Notificação SINAN" : "Nova Notificação Compulsória — SINAN"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{patient.full_name}</p>
        </div>

        {/* ── 1. Agravo + Data notificação ───────────────────────────────── */}
        <div className="space-y-3">
          <SectionTitle>Identificação do Agravo</SectionTitle>

          <FormField control={form.control} name="agravoCode" render={({ field }) => (
            <FormItem>
              <FormLabel>Agravo / Doença <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Selecione o agravo —</option>
                  <optgroup label="⚠ Notificação Imediata (≤ 24h)">
                    {SINAN_AGRAVOS.filter(a => a.urgente).map(a => (
                      <option key={a.code} value={a.code}>{a.label} ({a.cid10})</option>
                    ))}
                  </optgroup>
                  <optgroup label="📋 Notificação Semanal">
                    {SINAN_AGRAVOS.filter(a => !a.urgente).map(a => (
                      <option key={a.code} value={a.code}>{a.label} ({a.cid10})</option>
                    ))}
                  </optgroup>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {agravo?.urgente && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Notificação imediata — deve ser registrada em até 24 horas.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="dataNotificacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Data da Notificação <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dataInicioSintomas" render={({ field }) => (
              <FormItem>
                <FormLabel>Data dos Primeiros Sintomas</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* ── 2. Dados auto-preenchidos ──────────────────────────────────── */}
        <div className="space-y-2">
          <SectionTitle>Dados do Paciente (auto-preenchidos)</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[
              ["Nome",           patient.full_name],
              ["Data Nascimento", patient.birthDate || "—"],
              ["Nome da Mãe",    patient.motherName || "—"],
              ["CNS",            patient.cns || "—"],
              ["CPF",            patient.cpf || "—"],
              ["Telefone",       patient.phone || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="text-muted-foreground shrink-0">{k}:</span>
                <span className="text-foreground font-medium truncate">{v}</span>
              </div>
            ))}
          </div>
          {patient.address && (
            <p className="text-[11px] text-muted-foreground">
              Endereço cadastrado: <span className="text-foreground">{patient.address}</span>
            </p>
          )}
        </div>

        {/* ── 3. Dados da Unidade Notificante ────────────────────────────── */}
        <div className="space-y-3">
          <SectionTitle>Dados da Unidade Notificante</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-foreground block mb-1">Unidade de Saúde</label>
              <input
                type="text"
                value={fd["unidade_saude"] ?? ""}
                onChange={e => setFd({ ...fd, unidade_saude: e.target.value })}
                placeholder="Nome da unidade"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Código IBGE</label>
              <input
                type="text"
                value={fd["codigo_ibge"] ?? ""}
                onChange={e => setFd({ ...fd, codigo_ibge: e.target.value })}
                placeholder="Ex: 1501501"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Município de Notificação</label>
              <input
                type="text"
                value={fd["municipio_notificacao"] ?? ""}
                onChange={e => setFd({ ...fd, municipio_notificacao: e.target.value })}
                placeholder="Ex: Breves"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Profissional Responsável</label>
              <input
                type="text"
                value={fd["profissional_responsavel"] ?? ""}
                onChange={e => setFd({ ...fd, profissional_responsavel: e.target.value })}
                placeholder="Nome do profissional"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* ── 4. Endereço de residência (editável para SINAN) ────────────── */}
        <div className="space-y-3">
          <SectionTitle>Endereço de Residência (para a ficha SINAN)</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <FormField control={form.control} name="logradouro" render={({ field }) => (
                <FormItem>
                  <FormLabel>Logradouro (Rua, Av.)</FormLabel>
                  <FormControl><Input placeholder="Ex: Rua das Flores" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="numeroEndereco" render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl><Input placeholder="123" {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="complemento" render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl><Input placeholder="Apto, Casa..." {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="bairro" render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl><Input placeholder="Bairro" {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <FormField control={form.control} name="municipioResidencia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Município de Residência</FormLabel>
                  <FormControl><Input placeholder="Ex: Breves" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="ufResidencia" render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— UF —</option>
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </FormControl>
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="cep" render={({ field }) => (
            <FormItem>
              <FormLabel>CEP</FormLabel>
              <FormControl><Input placeholder="00000-000" maxLength={9} {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        {/* ── 5. Dados específicos do agravo ─────────────────────────────── */}
        {selectedCode && (
          <div className="space-y-3">
            <SectionTitle>Dados Clínicos / Epidemiológicos</SectionTitle>
            <DiseaseSpecificFields agravoCode={selectedCode} fd={fd} setFd={setFd} />
          </div>
        )}

        {/* ── 6. Encerramento do Caso ─────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionTitle>Encerramento do Caso</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Evolução do Caso</label>
              <select
                value={fd["evolucao"] ?? ""}
                onChange={e => setFd({ ...fd, evolucao: e.target.value })}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Selecione —</option>
                <option value="cura">Cura</option>
                <option value="obito">Óbito pela doença</option>
                <option value="obito_outras">Óbito por outras causas</option>
                <option value="transferencia">Transferência</option>
                <option value="alta">Alta / Em acompanhamento</option>
                <option value="ignorado">Ignorado</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Critério de Confirmação</label>
              <select
                value={fd["criterio_confirmacao"] ?? ""}
                onChange={e => setFd({ ...fd, criterio_confirmacao: e.target.value })}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Selecione —</option>
                <option value="laboratorial">Laboratorial</option>
                <option value="clinico_epidemiologico">Clínico-Epidemiológico</option>
                <option value="clinico">Clínico</option>
                <option value="em_investigacao">Em Investigação</option>
                <option value="descartado">Descartado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Data de Encerramento</label>
            <input
              type="date"
              value={fd["data_encerramento"] ?? ""}
              onChange={e => setFd({ ...fd, data_encerramento: e.target.value })}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* ── 7. Classificação final ─────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionTitle>Classificação Final</SectionTitle>
          <FormField control={form.control} name="classification" render={({ field }) => (
            <FormItem>
              <FormLabel>Classificação</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Selecione —</option>
                  {CLASSIFICACAO_OPTS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── 8. Nota sobre assinaturas ──────────────────────────────────── */}
        <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border/50 text-xs text-muted-foreground">
          <span className="shrink-0 mt-0.5">✍️</span>
          <span>
            <strong className="text-foreground">Campo de assinatura:</strong> O espaço para assinatura do profissional notificador e do responsável pela unidade deve ser preenchido e assinado manualmente após a impressão do PDF.
          </span>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending || generating} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedCode || generating}
            onClick={handleGeneratePdf}
            className="flex-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            {generating
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Gerando PDF...</>
              : <><Download className="h-3.5 w-3.5 mr-1.5" />Gerar PDF / Imprimir</>
            }
          </Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? "Salvando..." : notification ? "Salvar Alterações" : "Registrar Notificação"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

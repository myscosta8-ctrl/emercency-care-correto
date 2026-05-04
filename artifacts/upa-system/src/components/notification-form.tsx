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
    phone:                   p.phone,
    healthUnit:              p.healthUnit,
    responsibleProfessional: p.responsibleProfessional,
    symptomOnsetDate:        p.symptomOnsetDate,
    attendanceDate:          p.attendanceDate,
    attendanceTime:          p.attendanceTime,
    agravo:                  p.agravo,
    dataNotificacao:         p.dataNotificacao,
    municipioNotificacao:    p.municipioNotificacao,
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
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
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
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
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
      <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
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
    try { return notification?.formData ? JSON.parse(notification.formData) : {}; }
    catch { return {}; }
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

  // reset disease-specific fields when agravo changes
  useEffect(() => {
    if (!notification) setFd({});
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

        {/* ── 3. Endereço de residência (editável para SINAN) ────────────── */}
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

        {/* ── 4. Dados específicos do agravo ─────────────────────────────── */}
        {selectedCode && (
          <div className="space-y-3">
            <SectionTitle>Dados Clínicos / Epidemiológicos</SectionTitle>
            <DiseaseSpecificFields agravoCode={selectedCode} fd={fd} setFd={setFd} />
          </div>
        )}

        {/* ── 5. Classificação final ─────────────────────────────────────── */}
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

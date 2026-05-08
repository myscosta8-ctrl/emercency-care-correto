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
  { value: "obito",              label: "Óbito pela doença" },
  { value: "obito_outras",       label: "Óbito por outras causas" },
  { value: "em_tratamento",      label: "Em Tratamento" },
  { value: "tratamento_domiciliar", label: "Tratamento Domiciliar" },
  { value: "transferencia",      label: "Transferência" },
  { value: "abandono",           label: "Abandono" },
  { value: "ignorado",           label: "Ignorado" },
];

const LAB_RESULTADO = [
  { value: "positivo",      label: "Positivo" },
  { value: "negativo",      label: "Negativo" },
  { value: "inconclusivo",  label: "Inconclusivo" },
  { value: "nao_realizado", label: "Não Realizado" },
];

const MENING_SINTOMAS: CheckField[] = [
  { key: "febre",            label: "Febre" },
  { key: "cefaleia",         label: "Cefaleia" },
  { key: "rigidez_nuca",     label: "Rigidez de Nuca" },
  { key: "petequias",        label: "Petéquias / Equimoses" },
  { key: "coma",             label: "Coma" },
  { key: "convulsao",        label: "Convulsão" },
  { key: "sinais_meningeos", label: "Sinais de Kernig / Brudzinski" },
  { key: "vomito",           label: "Vômito em Jato" },
  { key: "fotofobia",        label: "Fotofobia" },
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
    <div className="space-y-4">
      <SectionTitle>Sinais e Sintomas</SectionTitle>
      <CheckGroup title="" fields={DENGUE_SINAIS} checked={sinais} onToggle={toggle} />

      <SectionTitle>Dados Epidemiológicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN} value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
        <SelectField label="Caso Autóctone do Município" name="autoctone" options={SIM_NAO_IGN} value={fd["autoctone"] ?? ""} onChange={v => setFd({ ...fd, autoctone: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="internacao" options={SIM_NAO_IGN} value={fd["internacao"] ?? ""} onChange={v => setFd({ ...fd, internacao: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Investigação</label>
          <input type="date" value={fd["data_investigacao"] ?? ""} onChange={e => setFd({ ...fd, data_investigacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      {fd["internacao"] === "sim" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data da Hospitalização</label>
            <input type="date" value={fd["data_internacao"] ?? ""} onChange={e => setFd({ ...fd, data_internacao: e.target.value })}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Nome do Hospital</label>
            <input type="text" value={fd["nome_hospital"] ?? ""} onChange={e => setFd({ ...fd, nome_hospital: e.target.value })}
              placeholder="Ex: UPA 24h Breves"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <SelectField label="Sorologia IgM Dengue" name="igm_dengue" options={LAB_RESULTADO} value={fd["igm_dengue"] ?? ""} onChange={v => setFd({ ...fd, igm_dengue: v })} />
        <SelectField label="NS1 Antígeno" name="ns1" options={LAB_RESULTADO} value={fd["ns1"] ?? ""} onChange={v => setFd({ ...fd, ns1: v })} />
        <SelectField label="PCR Dengue" name="pcr_dengue" options={LAB_RESULTADO} value={fd["pcr_dengue"] ?? ""} onChange={v => setFd({ ...fd, pcr_dengue: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Coleta</label>
          <input type="date" value={fd["data_coleta"] ?? ""} onChange={e => setFd({ ...fd, data_coleta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Número da Amostra</label>
          <input type="text" value={fd["num_amostra"] ?? ""} onChange={e => setFd({ ...fd, num_amostra: e.target.value })}
            placeholder="N.º da amostra laboratorial"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Classificação Final</SectionTitle>
      <SelectField label="Forma Clínica / Classificação" name="forma_clinica" options={[
        { value: "dengue",         label: "10 — Dengue" },
        { value: "dengue_alarme",  label: "11 — Dengue com Sinais de Alarme" },
        { value: "dengue_grave",   label: "12 — Dengue Grave" },
        { value: "chikungunya",    label: "13 — Chikungunya" },
        { value: "descartado",     label: "5 — Descartado" },
      ]} value={fd["forma_clinica"] ?? ""} onChange={v => setFd({ ...fd, forma_clinica: v })} />
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
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
    <div className="space-y-4">
      <SectionTitle>Sinais e Sintomas</SectionTitle>
      <CheckGroup title="" fields={COVID_SINTOMAS} checked={sinais} onToggle={toggle} />

      <SectionTitle>Dados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <SelectField label="UTI" name="uti" options={SIM_NAO_IGN} value={fd["uti"] ?? ""} onChange={v => setFd({ ...fd, uti: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN} value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
        <SelectField label="Vacinado contra COVID-19?" name="vacinado_covid" options={SIM_NAO_IGN} value={fd["vacinado_covid"] ?? ""} onChange={v => setFd({ ...fd, vacinado_covid: v })} />
      </div>
      {fd["vacinado_covid"] === "sim" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Nº de Doses</label>
            <select value={fd["doses_covid"] ?? ""} onChange={e => setFd({ ...fd, doses_covid: e.target.value })}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">— Selecione —</option>
              <option value="1">1 dose</option>
              <option value="2">2 doses</option>
              <option value="3">3 doses (reforço)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data da Última Dose</label>
            <input type="date" value={fd["data_ultima_dose"] ?? ""} onChange={e => setFd({ ...fd, data_ultima_dose: e.target.value })}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="RT-PCR SARS-CoV-2" name="pcr_covid" options={LAB_RESULTADO} value={fd["pcr_covid"] ?? ""} onChange={v => setFd({ ...fd, pcr_covid: v })} />
        <SelectField label="Teste Rápido Antígeno" name="tr_antigeno" options={LAB_RESULTADO} value={fd["tr_antigeno"] ?? ""} onChange={v => setFd({ ...fd, tr_antigeno: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Coleta</label>
          <input type="date" value={fd["data_coleta"] ?? ""} onChange={e => setFd({ ...fd, data_coleta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Internação (se houve)</label>
          <input type="date" value={fd["data_internacao"] ?? ""} onChange={e => setFd({ ...fd, data_internacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Desfecho</SectionTitle>
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
    <div className="space-y-4">
      <SectionTitle>Sinais e Sintomas</SectionTitle>
      <CheckGroup title="" fields={SRAG_SINTOMAS} checked={sinais} onToggle={toggle} />

      <SectionTitle>Dados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Internação em Hospital" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <SelectField label="UTI" name="uti" options={SIM_NAO_IGN} value={fd["uti"] ?? ""} onChange={v => setFd({ ...fd, uti: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Suporte Ventilatório" name="ventilacao" options={[
          { value: "invasivo",     label: "Sim — Invasivo" },
          { value: "nao_invasivo", label: "Sim — Não Invasivo" },
          { value: "nao",          label: "Não" },
          { value: "ignorado",     label: "Ignorado" },
        ]} value={fd["ventilacao"] ?? ""} onChange={v => setFd({ ...fd, ventilacao: v })} />
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN} value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
      </div>
      {fd["hospitalizacao"] === "sim" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data da Internação</label>
            <input type="date" value={fd["data_internacao"] ?? ""} onChange={e => setFd({ ...fd, data_internacao: e.target.value })}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Nome do Hospital</label>
            <input type="text" value={fd["nome_hospital"] ?? ""} onChange={e => setFd({ ...fd, nome_hospital: e.target.value })}
              placeholder="Hospital de internação"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="PCR Influenza A" name="pcr_influenza_a" options={LAB_RESULTADO} value={fd["pcr_influenza_a"] ?? ""} onChange={v => setFd({ ...fd, pcr_influenza_a: v })} />
        <SelectField label="PCR Influenza B" name="pcr_influenza_b" options={LAB_RESULTADO} value={fd["pcr_influenza_b"] ?? ""} onChange={v => setFd({ ...fd, pcr_influenza_b: v })} />
        <SelectField label="RT-PCR SARS-CoV-2" name="pcr_covid" options={LAB_RESULTADO} value={fd["pcr_covid"] ?? ""} onChange={v => setFd({ ...fd, pcr_covid: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Coleta</label>
          <input type="date" value={fd["data_coleta"] ?? ""} onChange={e => setFd({ ...fd, data_coleta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

function TuberculoseFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const forma = fd["forma"] ?? "";
  return (
    <div className="space-y-4">
      <SectionTitle>Dados da Investigação</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo de Entrada" name="tipo_entrada" options={TB_ENTRADAS} value={fd["tipo_entrada"] ?? ""} onChange={v => setFd({ ...fd, tipo_entrada: v })} />
        <SelectField label="Populações Especiais" name="populacao_especial" options={[
          { value: "nenhuma",           label: "Nenhuma" },
          { value: "privado_liberdade", label: "Privado de Liberdade" },
          { value: "pop_rua",           label: "Pop. em Situação de Rua" },
          { value: "imigrante",         label: "Imigrante" },
          { value: "indigena",          label: "Indígena" },
        ]} value={fd["populacao_especial"] ?? ""} onChange={v => setFd({ ...fd, populacao_especial: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Investigação</label>
          <input type="date" value={fd["data_investigacao"] ?? ""} onChange={e => setFd({ ...fd, data_investigacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="TDO — Trat. Diretamente Observado" name="tdo" options={SIM_NAO_IGN} value={fd["tdo"] ?? ""} onChange={v => setFd({ ...fd, tdo: v })} />
      </div>

      <SectionTitle>Dados Clínicos</SectionTitle>
      <SelectField label="Forma Clínica" name="forma" options={TB_FORMAS} value={forma} onChange={v => setFd({ ...fd, forma: v })} />
      {(forma === "extrapulmonar" || forma === "pulmonar_extrapulmonar") && (
        <SelectField label="Localização Extrapulmonar" name="localizacao_extra" options={[
          { value: "pleural",         label: "Pleural" },
          { value: "ganglionar",      label: "Ganglionar" },
          { value: "ossea",           label: "Óssea" },
          { value: "genitourinaria",  label: "Geniturinária" },
          { value: "meningea",        label: "Meníngea" },
          { value: "ocular",          label: "Ocular" },
          { value: "miliar",          label: "Miliar" },
          { value: "outra",           label: "Outra" },
        ]} value={fd["localizacao_extra"] ?? ""} onChange={v => setFd({ ...fd, localizacao_extra: v })} />
      )}

      <SectionTitle>Doenças Associadas</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="AIDS / HIV" name="aids" options={SIM_NAO_IGN} value={fd["aids"] ?? ""} onChange={v => setFd({ ...fd, aids: v })} />
        <SelectField label="Alcoolismo" name="alcoolismo" options={SIM_NAO_IGN} value={fd["alcoolismo"] ?? ""} onChange={v => setFd({ ...fd, alcoolismo: v })} />
        <SelectField label="Diabetes" name="diabetes" options={SIM_NAO_IGN} value={fd["diabetes"] ?? ""} onChange={v => setFd({ ...fd, diabetes: v })} />
        <SelectField label="Doença Mental" name="doenca_mental" options={SIM_NAO_IGN} value={fd["doenca_mental"] ?? ""} onChange={v => setFd({ ...fd, doenca_mental: v })} />
        <SelectField label="Uso de Drogas" name="drogas" options={SIM_NAO_IGN} value={fd["drogas"] ?? ""} onChange={v => setFd({ ...fd, drogas: v })} />
        <SelectField label="Tabagismo" name="tabagismo" options={SIM_NAO_IGN} value={fd["tabagismo"] ?? ""} onChange={v => setFd({ ...fd, tabagismo: v })} />
      </div>

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Baciloscopia de Escarro" name="baciloscopia" options={[
          { value: "positiva",      label: "Positiva" },
          { value: "negativa",      label: "Negativa" },
          { value: "nao_realizada", label: "Não Realizada" },
          { value: "nao_aplica",    label: "Não se Aplica" },
        ]} value={fd["baciloscopia"] ?? ""} onChange={v => setFd({ ...fd, baciloscopia: v })} />
        <SelectField label="Cultura de Escarro" name="cultura_escarro" options={[
          { value: "positiva",      label: "Positiva" },
          { value: "negativa",      label: "Negativa" },
          { value: "em_andamento",  label: "Em Andamento" },
          { value: "nao_realizada", label: "Não Realizada" },
        ]} value={fd["cultura_escarro"] ?? ""} onChange={v => setFd({ ...fd, cultura_escarro: v })} />
        <SelectField label="Teste Rápido Molecular (TRM-TB)" name="teste_rapido" options={[
          { value: "detectado",     label: "M. tuberculosis Detectado" },
          { value: "nao_detectado", label: "Não Detectado" },
          { value: "inconclusivo",  label: "Inconclusivo" },
          { value: "nao_realizado", label: "Não Realizado" },
        ]} value={fd["teste_rapido"] ?? ""} onChange={v => setFd({ ...fd, teste_rapido: v })} />
        <SelectField label="Sorologia HIV" name="hiv" options={[
          { value: "positivo",      label: "Positivo" },
          { value: "negativo",      label: "Negativo" },
          { value: "andamento",     label: "Em Andamento" },
          { value: "nao_realizado", label: "Não Realizado" },
        ]} value={fd["hiv"] ?? ""} onChange={v => setFd({ ...fd, hiv: v })} />
      </div>

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={[
        { value: "cura",         label: "Cura" },
        { value: "abandono",     label: "Abandono" },
        { value: "obito_tb",     label: "Óbito por TB" },
        { value: "obito_outras", label: "Óbito por outras causas" },
        { value: "transferencia",label: "Transferência" },
        { value: "em_tratamento",label: "Em Tratamento" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

function FebreAmarelaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Epidemiológicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Vacinado contra Febre Amarela?" name="vacinado" options={SIM_NAO_IGN} value={fd["vacinado"] ?? ""} onChange={v => setFd({ ...fd, vacinado: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Vacinação</label>
          <input type="date" value={fd["data_vacinacao"] ?? ""} onChange={e => setFd({ ...fd, data_vacinacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Epizootia em Primatas / Aves" name="epizootia" options={SIM_NAO_IGN} value={fd["epizootia"] ?? ""} onChange={v => setFd({ ...fd, epizootia: v })} />
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Investigação</label>
          <input type="date" value={fd["data_investigacao"] ?? ""} onChange={e => setFd({ ...fd, data_investigacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Coleta</label>
          <input type="date" value={fd["data_coleta"] ?? ""} onChange={e => setFd({ ...fd, data_coleta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Sorologia para Febre Amarela (IgM)" name="sorologia_fa" options={LAB_RESULTADO} value={fd["sorologia_fa"] ?? ""} onChange={v => setFd({ ...fd, sorologia_fa: v })} />
        <SelectField label="Isolamento Viral" name="isolamento_viral" options={LAB_RESULTADO} value={fd["isolamento_viral"] ?? ""} onChange={v => setFd({ ...fd, isolamento_viral: v })} />
      </div>

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

function FebreTifoideFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo de Atendimento" name="tipo_atendimento" options={[
          { value: "hospitalar",   label: "Hospitalar" },
          { value: "ambulatorial", label: "Ambulatorial" },
          { value: "domiciliar",   label: "Domiciliar" },
          { value: "nenhum",       label: "Nenhum" },
          { value: "ignorado",     label: "Ignorado" },
        ]} value={fd["tipo_atendimento"] ?? ""} onChange={v => setFd({ ...fd, tipo_atendimento: v })} />
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Investigação</label>
          <input type="date" value={fd["data_investigacao"] ?? ""} onChange={e => setFd({ ...fd, data_investigacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data de Início dos Sintomas (conf.)</label>
          <input type="date" value={fd["data_sintomas_conf"] ?? ""} onChange={e => setFd({ ...fd, data_sintomas_conf: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hemocultura" name="hemocultura" options={LAB_RESULTADO} value={fd["hemocultura"] ?? ""} onChange={v => setFd({ ...fd, hemocultura: v })} />
        <SelectField label="Coprocultura" name="coprocultura" options={LAB_RESULTADO} value={fd["coprocultura"] ?? ""} onChange={v => setFd({ ...fd, coprocultura: v })} />
        <SelectField label="Widal / Soroaglutinação" name="widal" options={LAB_RESULTADO} value={fd["widal"] ?? ""} onChange={v => setFd({ ...fd, widal: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Coleta</label>
          <input type="date" value={fd["data_coleta"] ?? ""} onChange={e => setFd({ ...fd, data_coleta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

function MeningiteFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const sinais = new Set((fd["sinais"] ?? "").split(",").filter(Boolean));
  const toggle = (k: string) => {
    const next = new Set(sinais);
    next.has(k) ? next.delete(k) : next.add(k);
    setFd({ ...fd, sinais: [...next].join(",") });
  };
  return (
    <div className="space-y-4">
      <SectionTitle>Sinais e Sintomas</SectionTitle>
      <CheckGroup title="" fields={MENING_SINTOMAS} checked={sinais} onToggle={toggle} />

      <SectionTitle>Dados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Investigação</label>
          <input type="date" value={fd["data_investigacao"] ?? ""} onChange={e => setFd({ ...fd, data_investigacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Resultado do Líquor (LCR)</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Aspecto do Líquor" name="aspecto_liquor" options={[
          { value: "turvo",          label: "Turvo" },
          { value: "limpido",        label: "Límpido" },
          { value: "xantocromico",   label: "Xantocrômico" },
          { value: "hemorragico",    label: "Hemorrágico" },
          { value: "nao_realizado",  label: "Não Realizado" },
        ]} value={fd["aspecto_liquor"] ?? ""} onChange={v => setFd({ ...fd, aspecto_liquor: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da Punção Lombar</label>
          <input type="date" value={fd["data_puncao"] ?? ""} onChange={e => setFd({ ...fd, data_puncao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Células (mm³)</label>
          <input type="text" value={fd["liquor_celulas"] ?? ""} onChange={e => setFd({ ...fd, liquor_celulas: e.target.value })}
            placeholder="Ex: 1200"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Glicose (mg/dL)</label>
          <input type="text" value={fd["liquor_glicose"] ?? ""} onChange={e => setFd({ ...fd, liquor_glicose: e.target.value })}
            placeholder="Ex: 30"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Proteína (mg/dL)</label>
          <input type="text" value={fd["liquor_proteina"] ?? ""} onChange={e => setFd({ ...fd, liquor_proteina: e.target.value })}
            placeholder="Ex: 200"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Classificação e Critério</SectionTitle>
      <SelectField label="Tipo de Meningite" name="tipo_meningite" options={[
        { value: "bacteriana", label: "Bacteriana" },
        { value: "viral",      label: "Viral (Asséptica)" },
        { value: "fungica",    label: "Fúngica" },
        { value: "tuberculosa",label: "Tuberculosa" },
        { value: "outra",      label: "Outra Etiologia" },
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

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={[
        { value: "cura",            label: "Alta / Cura" },
        { value: "obito_meningite", label: "Óbito por Meningite" },
        { value: "obito_outras",    label: "Óbito por outras causas" },
        { value: "ignorado",        label: "Ignorado" },
      ]} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

const EXANT_SINTOMAS: CheckField[] = [
  { key: "febre",     label: "Febre" },
  { key: "exantema",  label: "Exantema Maculo-Papular" },
  { key: "coriza",    label: "Coriza" },
  { key: "conjuntivite", label: "Conjuntivite" },
  { key: "tosse",     label: "Tosse" },
  { key: "linfadenopatia", label: "Linfadenopatia" },
  { key: "artralgia", label: "Artralgia / Artrite" },
];

function ExantematicaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const sinais = new Set((fd["sinais"] ?? "").split(",").filter(Boolean));
  const toggle = (k: string) => {
    const next = new Set(sinais);
    next.has(k) ? next.delete(k) : next.add(k);
    setFd({ ...fd, sinais: [...next].join(",") });
  };
  return (
    <div className="space-y-4">
      <SectionTitle>Sinais e Sintomas</SectionTitle>
      <CheckGroup title="" fields={EXANT_SINTOMAS} checked={sinais} onToggle={toggle} />

      <SectionTitle>Dados Epidemiológicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Vacinado (Sarampo / Tríplice Viral)?" name="vacinado" options={SIM_NAO_IGN} value={fd["vacinado"] ?? ""} onChange={v => setFd({ ...fd, vacinado: v })} />
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN} value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN} value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data do Exantema</label>
          <input type="date" value={fd["data_exantema"] ?? ""} onChange={e => setFd({ ...fd, data_exantema: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Sorologia IgM Sarampo" name="igm_sarampo" options={LAB_RESULTADO} value={fd["igm_sarampo"] ?? ""} onChange={v => setFd({ ...fd, igm_sarampo: v })} />
        <SelectField label="Sorologia IgM Rubéola" name="igm_rubeola" options={LAB_RESULTADO} value={fd["igm_rubeola"] ?? ""} onChange={v => setFd({ ...fd, igm_rubeola: v })} />
      </div>

      <SectionTitle>Classificação Final</SectionTitle>
      <SelectField label="Classificação Final" name="classificacao_exant" options={[
        { value: "sarampo",    label: "1 — Sarampo" },
        { value: "rubeola",    label: "2 — Rubéola" },
        { value: "descartado", label: "3 — Descartado" },
      ]} value={fd["classificacao_exant"] ?? ""} onChange={v => setFd({ ...fd, classificacao_exant: v })} />
      <SelectField label="Critério de Confirmação" name="criterio_exant" options={[
        { value: "laboratorial",  label: "Laboratorial" },
        { value: "clinico_epid",  label: "Clínico-Epidemiológico" },
        { value: "clinico",       label: "Clínico" },
      ]} value={fd["criterio_exant"] ?? ""} onChange={v => setFd({ ...fd, criterio_exant: v })} />
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS} value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

function AidsAdultoFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Clínicos e Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="CD4 < 200 (confirmação AIDS)" name="cd4_menor_200" options={SIM_NAO_IGN} value={fd["cd4_menor_200"] ?? ""} onChange={v => setFd({ ...fd, cd4_menor_200: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Contagem CD4 (cél/mm³)</label>
          <input type="text" value={fd["cd4_valor"] ?? ""} onChange={e => setFd({ ...fd, cd4_valor: e.target.value })}
            placeholder="Ex: 150"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Critério Diagnóstico" name="criterio_aids" options={[
          { value: "laboratorial",   label: "Laboratorial (CD4/Carga Viral)" },
          { value: "clinico_imuno",  label: "Clínico + Imunológico" },
          { value: "rio_aceite",     label: "Critério Rio de Janeiro/Caracas" },
          { value: "cdc_adaptado",   label: "CDC Adaptado" },
          { value: "obito",          label: "Óbito (declaração)" },
        ]} value={fd["criterio_aids"] ?? ""} onChange={v => setFd({ ...fd, criterio_aids: v })} />
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN} value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Carga Viral (cópias/mL)</label>
          <input type="text" value={fd["carga_viral"] ?? ""} onChange={e => setFd({ ...fd, carga_viral: e.target.value })}
            placeholder="Ex: 5000"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data do Diagnóstico</label>
          <input type="date" value={fd["data_diagnostico"] ?? ""} onChange={e => setFd({ ...fd, data_diagnostico: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <SelectField label="Em uso de TARV (antirretrovirais)?" name="tarv" options={SIM_NAO_IGN} value={fd["tarv"] ?? ""} onChange={v => setFd({ ...fd, tarv: v })} />

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={[
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

// ── Violência Interpessoal / Autoprovocada ───────────────────────────────────

const VIOLENCIA_TIPOS: CheckField[] = [
  { key: "fisica",            label: "Física" },
  { key: "psicologica",       label: "Psicológica / Moral" },
  { key: "tortura",           label: "Tortura" },
  { key: "sexual",            label: "Sexual" },
  { key: "trafico",           label: "Tráfico de Pessoas" },
  { key: "financeira",        label: "Financeira / Econômica" },
  { key: "negligencia",       label: "Negligência / Abandono" },
  { key: "trabalho_infantil", label: "Trabalho Infantil" },
  { key: "autoprovocada",     label: "Autoprovocada / Autoinfligida" },
  { key: "intervencao_legal", label: "Intervenção Legal" },
  { key: "outros_tipos",      label: "Outros" },
];

const VIOLENCIA_MEIOS: CheckField[] = [
  { key: "forca_corporal",    label: "Força corporal / espancamento" },
  { key: "enforcamento",      label: "Enforcamento" },
  { key: "obj_contundente",   label: "Objeto contundente" },
  { key: "obj_perfurocort",   label: "Objeto perfurocortante" },
  { key: "arma_fogo",         label: "Arma de fogo" },
  { key: "queimadura",        label: "Queimadura" },
  { key: "substancia_droga",  label: "Substância / droga" },
  { key: "envenenamento",     label: "Envenenamento / intoxicação" },
  { key: "outros_meios",      label: "Outros" },
];

const VIOLENCIA_ENCAMINHAMENTOS: CheckField[] = [
  { key: "enc_delegacia_mulher",  label: "Delegacia de proteção da mulher / criança / idoso" },
  { key: "enc_delegacia_racial",  label: "Delegacia de crimes raciais" },
  { key: "enc_iml",               label: "Instituto Médico Legal / IML" },
  { key: "enc_servico_saude",     label: "Serviço de saúde" },
  { key: "enc_vara_crianca",      label: "Vara da criança e adolescente" },
  { key: "enc_conselho_tutelar",  label: "Conselho Tutelar" },
  { key: "enc_creas",             label: "CREAS / CRAS" },
  { key: "enc_mp",                label: "Ministério Público" },
  { key: "enc_albergue",          label: "Albergue / Abrigo" },
];

function ViolenciaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const makeToggle = (key: string) => {
    const cur = new Set((fd[key] ?? "").split(",").filter(Boolean));
    return (k: string) => {
      const next = new Set(cur);
      next.has(k) ? next.delete(k) : next.add(k);
      setFd({ ...fd, [key]: [...next].join(",") });
    };
  };
  const tipos    = new Set((fd["tipos_violencia"]    ?? "").split(",").filter(Boolean));
  const meios    = new Set((fd["meios_violencia"]    ?? "").split(",").filter(Boolean));
  const encs     = new Set((fd["encaminhamentos"]    ?? "").split(",").filter(Boolean));
  const sexTipos = new Set((fd["tipos_viol_sexual"]  ?? "").split(",").filter(Boolean));

  const hasSexual = tipos.has("sexual");

  return (
    <div className="space-y-4">

      <SectionTitle>Tipo de Violência (marque todas que se aplicam)</SectionTitle>
      <CheckGroup title="" fields={VIOLENCIA_TIPOS} checked={tipos}
        onToggle={k => { const n = new Set(tipos); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, tipos_violencia: [...n].join(",") }); }} />

      {hasSexual && (
        <div className="space-y-2 pl-3 border-l-2 border-rose-500/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Especificação — Violência Sexual</p>
          <CheckGroup title="" fields={[
            { key: "assedio",          label: "Assédio Sexual" },
            { key: "estupro",          label: "Estupro" },
            { key: "atentado_pudor",   label: "Atentado ao pudor" },
            { key: "exploracao_sex",   label: "Exploração sexual" },
            { key: "pornografia_inf",  label: "Pornografia infantil" },
            { key: "outras_sexual",    label: "Outras" },
          ]} checked={sexTipos}
            onToggle={k => { const n = new Set(sexTipos); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, tipos_viol_sexual: [...n].join(",") }); }} />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <SelectField label="Relação sexual consentida?" name="relacao_consentida" options={[
              { value: "nao",      label: "Não (violência)" },
              { value: "sim",      label: "Sim (consentida)" },
              { value: "ignorado", label: "Ignorado" },
            ]} value={fd["relacao_consentida"] ?? ""} onChange={v => setFd({ ...fd, relacao_consentida: v })} />
            <SelectField label="Profilaxia DST/HIV oferecida?" name="profilaxia_dst" options={SIM_NAO_IGN}
              value={fd["profilaxia_dst"] ?? ""} onChange={v => setFd({ ...fd, profilaxia_dst: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Anticoncepção de emergência?" name="anticoncepcao_emerg" options={SIM_NAO_IGN}
              value={fd["anticoncepcao_emerg"] ?? ""} onChange={v => setFd({ ...fd, anticoncepcao_emerg: v })} />
            <SelectField label="Coleta de material para exame?" name="coleta_material" options={SIM_NAO_IGN}
              value={fd["coleta_material"] ?? ""} onChange={v => setFd({ ...fd, coleta_material: v })} />
          </div>
        </div>
      )}

      <SectionTitle>Meio / Forma de Agressão</SectionTitle>
      <CheckGroup title="" fields={VIOLENCIA_MEIOS} checked={meios}
        onToggle={makeToggle("meios_violencia")} />

      <SectionTitle>Dados do Agressor</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Vínculo / relação com a vítima" name="vinculo_agressor" options={[
          { value: "conjuge",          label: "Cônjuge / companheiro(a)" },
          { value: "ex_conjuge",       label: "Ex-cônjuge / ex-companheiro(a)" },
          { value: "namorado",         label: "Namorado(a)" },
          { value: "ex_namorado",      label: "Ex-namorado(a)" },
          { value: "pai",              label: "Pai" },
          { value: "mae",              label: "Mãe" },
          { value: "padrasto",         label: "Padrasto" },
          { value: "madrasta",         label: "Madrasta" },
          { value: "filho",            label: "Filho(a)" },
          { value: "irmao",            label: "Irmão / Irmã" },
          { value: "amigo_conhecido",  label: "Amigo / Conhecido" },
          { value: "desconhecido",     label: "Desconhecido" },
          { value: "cuidador",         label: "Cuidador(a)" },
          { value: "patrao",           label: "Patrão / Chefe" },
          { value: "institucional",    label: "Policial / Agente institucional" },
          { value: "propria_pessoa",   label: "Própria pessoa (autoprovocada)" },
          { value: "outros",           label: "Outros" },
        ]} value={fd["vinculo_agressor"] ?? ""} onChange={v => setFd({ ...fd, vinculo_agressor: v })} />
        <SelectField label="Nº de agressores" name="num_agressores" options={[
          { value: "1",        label: "1 agressor" },
          { value: "2",        label: "2 agressores" },
          { value: "3_mais",   label: "3 ou mais" },
          { value: "ignorado", label: "Ignorado" },
        ]} value={fd["num_agressores"] ?? ""} onChange={v => setFd({ ...fd, num_agressores: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Agressor estava sob efeito de álcool?" name="agressor_alcool" options={SIM_NAO_IGN}
          value={fd["agressor_alcool"] ?? ""} onChange={v => setFd({ ...fd, agressor_alcool: v })} />
        <SelectField label="Agressor era do sexo" name="sexo_agressor" options={[
          { value: "masculino",  label: "Masculino" },
          { value: "feminino",   label: "Feminino" },
          { value: "ambos",      label: "Ambos (vários agressores)" },
          { value: "ignorado",   label: "Ignorado" },
        ]} value={fd["sexo_agressor"] ?? ""} onChange={v => setFd({ ...fd, sexo_agressor: v })} />
      </div>

      <SectionTitle>Local e Recorrência</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Local de ocorrência" name="local_ocorrencia" options={[
          { value: "residencia",          label: "Residência" },
          { value: "habitacao_coletiva",  label: "Habitação coletiva" },
          { value: "escola",              label: "Escola" },
          { value: "local_esportivo",     label: "Local de prática esportiva" },
          { value: "bar",                 label: "Bar ou similar" },
          { value: "via_publica",         label: "Via pública" },
          { value: "comercio_servicos",   label: "Comércio / Serviços" },
          { value: "industria",           label: "Indústria / Construção" },
          { value: "outro_local",         label: "Outro" },
          { value: "ignorado",            label: "Ignorado" },
        ]} value={fd["local_ocorrencia"] ?? ""} onChange={v => setFd({ ...fd, local_ocorrencia: v })} />
        <SelectField label="Ocorrências anteriores similares?" name="ocorrencias_anteriores" options={[
          { value: "1a_vez",   label: "1ª vez" },
          { value: "repetida", label: "Repetição" },
          { value: "ignorado", label: "Ignorado" },
        ]} value={fd["ocorrencias_anteriores"] ?? ""} onChange={v => setFd({ ...fd, ocorrencias_anteriores: v })} />
      </div>

      <SectionTitle>Encaminhamentos após Atendimento</SectionTitle>
      <CheckGroup title="" fields={VIOLENCIA_ENCAMINHAMENTOS} checked={encs}
        onToggle={makeToggle("encaminhamentos")} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Notificado ao Conselho Tutelar?" name="notif_conselho_tutelar" options={SIM_NAO_IGN}
          value={fd["notif_conselho_tutelar"] ?? ""} onChange={v => setFd({ ...fd, notif_conselho_tutelar: v })} />
        <SelectField label="Notificado à Delegacia / Autoridade Policial?" name="notif_policia" options={SIM_NAO_IGN}
          value={fd["notif_policia"] ?? ""} onChange={v => setFd({ ...fd, notif_policia: v })} />
      </div>

      <SectionTitle>Dados do Atendimento</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo de Atendimento" name="tipo_atendimento" options={[
          { value: "hospitalar",   label: "Hospitalar" },
          { value: "ambulatorial", label: "Ambulatorial" },
          { value: "domiciliar",   label: "Domiciliar" },
          { value: "ignorado",     label: "Ignorado" },
        ]} value={fd["tipo_atendimento"] ?? ""} onChange={v => setFd({ ...fd, tipo_atendimento: v })} />
        <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
          value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Observações / Narrativa (opcional)</label>
        <textarea
          value={fd["observacoes"] ?? ""}
          onChange={e => setFd({ ...fd, observacoes: e.target.value })}
          rows={3}
          placeholder="Informações adicionais relevantes para o registro..."
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
  if (agravoCode === "violencia") return <ViolenciaFields fd={fd} setFd={setFd} />;
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

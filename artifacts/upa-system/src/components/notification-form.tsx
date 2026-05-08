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

// ── Malária ──────────────────────────────────────────────────────────────────

function MalariaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const autoctone = fd["autoctone"] ?? "";
  return (
    <div className="space-y-4">
      <SectionTitle>Dados da Investigação</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Espécie de Plasmodium" name="plasmodium" options={[
          { value: "falciparum",  label: "P. falciparum" },
          { value: "vivax",       label: "P. vivax" },
          { value: "malariae",    label: "P. malariae" },
          { value: "ovale",       label: "P. ovale" },
          { value: "mista",       label: "Infecção Mista" },
          { value: "nao_id",      label: "Não Identificada" },
        ]} value={fd["plasmodium"] ?? ""} onChange={v => setFd({ ...fd, plasmodium: v })} />
        <SelectField label="Caso Autóctone?" name="autoctone" options={SIM_NAO_IGN}
          value={autoctone} onChange={v => setFd({ ...fd, autoctone: v })} />
      </div>
      {autoctone === "nao" && (
        <div className="grid grid-cols-3 gap-3 pl-3 border-l-2 border-amber-500/40">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">País de infecção</label>
            <input type="text" value={fd["pais_infeccao"] ?? ""} onChange={e => setFd({ ...fd, pais_infeccao: e.target.value })}
              placeholder="Ex: Venezuela"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Estado (UF)</label>
            <input type="text" value={fd["uf_infeccao"] ?? ""} onChange={e => setFd({ ...fd, uf_infeccao: e.target.value })}
              placeholder="Ex: AM"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Município de infecção</label>
            <input type="text" value={fd["municipio_infeccao"] ?? ""} onChange={e => setFd({ ...fd, municipio_infeccao: e.target.value })}
              placeholder="Município"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN}
          value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN}
          value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da investigação</label>
          <input type="date" value={fd["data_investigacao"] ?? ""} onChange={e => setFd({ ...fd, data_investigacao: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da coleta (exame)</label>
          <input type="date" value={fd["data_coleta"] ?? ""} onChange={e => setFd({ ...fd, data_coleta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Resultados Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Gota Espessa / Lâmina" name="gota_espessa" options={[
          { value: "positiva",      label: "Positiva" },
          { value: "negativa",      label: "Negativa" },
          { value: "nao_realizada", label: "Não Realizada" },
        ]} value={fd["gota_espessa"] ?? ""} onChange={v => setFd({ ...fd, gota_espessa: v })} />
        <SelectField label="Teste Rápido (TDR)" name="tdr_malaria" options={LAB_RESULTADO}
          value={fd["tdr_malaria"] ?? ""} onChange={v => setFd({ ...fd, tdr_malaria: v })} />
        <SelectField label="PCR / Biologia Molecular" name="pcr_malaria" options={LAB_RESULTADO}
          value={fd["pcr_malaria"] ?? ""} onChange={v => setFd({ ...fd, pcr_malaria: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Parasitemia (cruzes / parasitos/μL)</label>
          <input type="text" value={fd["parasitemia"] ?? ""} onChange={e => setFd({ ...fd, parasitemia: e.target.value })}
            placeholder="Ex: 2+ ou 5000/μL"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <SectionTitle>Tratamento</SectionTitle>
      <SelectField label="Esquema terapêutico utilizado" name="esquema_tratamento" options={[
        { value: "cloroquina_primaquina",    label: "Cloroquina + Primaquina (P. vivax/ovale)" },
        { value: "artesunato_mefloquina",    label: "Artesunato + Mefloquina (P. falciparum)" },
        { value: "artemeter_lumefantrina",   label: "Artemeter + Lumefantrina" },
        { value: "quinino_doxiciclina",      label: "Quinino + Doxiciclina" },
        { value: "outro",                    label: "Outro esquema" },
        { value: "nao_realizado",            label: "Não realizado" },
      ]} value={fd["esquema_tratamento"] ?? ""} onChange={v => setFd({ ...fd, esquema_tratamento: v })} />

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Acidente por Animais Peçonhentos ─────────────────────────────────────────

const ACIDENTE_SINAIS_LOCAIS: CheckField[] = [
  { key: "dor",       label: "Dor local" },
  { key: "edema",     label: "Edema / Inchaço" },
  { key: "equimose",  label: "Equimose / Hematoma" },
  { key: "necrose",   label: "Necrose" },
  { key: "eritema",   label: "Eritema / Vermelhidão" },
  { key: "parestesia",label: "Parestesia / Dormência" },
];

const ACIDENTE_SINAIS_SISTEMICOS: CheckField[] = [
  { key: "coagulopatia",      label: "Coagulopatia / Distúrbio de coagulação" },
  { key: "insuf_renal",       label: "Insuficiência Renal" },
  { key: "choque",            label: "Choque / Hipotensão" },
  { key: "neurotoxicidade",   label: "Neurotoxicidade (ptose, diplopia, disfagia)" },
  { key: "rabdomiólise",      label: "Rabdomiólise / Mialgia intensa" },
  { key: "hemólise",          label: "Hemólise" },
  { key: "vomito_nausea",     label: "Vômito / Náusea" },
  { key: "sangramento",       label: "Sangramento (gengivorragia, hematúria…)" },
];

function AcidentePeconhentoFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const animal = fd["tipo_animal"] ?? "";
  const sinaisLocais    = new Set((fd["sinais_locais"]    ?? "").split(",").filter(Boolean));
  const sinaisSistemicos= new Set((fd["sinais_sistemicos"] ?? "").split(",").filter(Boolean));

  return (
    <div className="space-y-4">
      <SectionTitle>Tipo de Animal</SectionTitle>
      <SelectField label="Animal causador do acidente" name="tipo_animal" options={[
        { value: "serpente",    label: "Serpente (cobra)" },
        { value: "aranha",      label: "Aranha" },
        { value: "escorpiao",   label: "Escorpião" },
        { value: "abelha",      label: "Abelha / Marimbondo / Vespa" },
        { value: "lagarta",     label: "Lagarta / Taturana" },
        { value: "lagartixa",   label: "Lagartixa / Iguana" },
        { value: "outros",      label: "Outros / Não identificado" },
      ]} value={animal} onChange={v => setFd({ ...fd, tipo_animal: v })} />

      {animal === "serpente" && (
        <div className="pl-3 border-l-2 border-yellow-500/40 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Especificação — Serpente</p>
          <SelectField label="Gênero / Tipo de serpente" name="tipo_serpente" options={[
            { value: "bothrops",    label: "Bothrops (jararaca, jararacuçu…)" },
            { value: "crotalus",    label: "Crotalus (cascavel)" },
            { value: "lachesis",    label: "Lachesis (surucucu / pico de jaca)" },
            { value: "micrurus",    label: "Micrurus (coral verdadeira)" },
            { value: "nao_veneno",  label: "Serpente não venenosa" },
            { value: "nao_id",      label: "Não identificada" },
          ]} value={fd["tipo_serpente"] ?? ""} onChange={v => setFd({ ...fd, tipo_serpente: v })} />
        </div>
      )}

      {animal === "aranha" && (
        <div className="pl-3 border-l-2 border-yellow-500/40 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Especificação — Aranha</p>
          <SelectField label="Gênero de aranha" name="tipo_aranha" options={[
            { value: "loxosceles",  label: "Loxosceles (aranha-marrom)" },
            { value: "phoneutria",  label: "Phoneutria (armadeira)" },
            { value: "latrodectus", label: "Latrodectus (viúva-negra)" },
            { value: "nao_id",      label: "Não identificada" },
          ]} value={fd["tipo_aranha"] ?? ""} onChange={v => setFd({ ...fd, tipo_aranha: v })} />
        </div>
      )}

      <SectionTitle>Dados do Acidente</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Zona de ocorrência" name="zona_ocorrencia" options={[
          { value: "urbana",  label: "Urbana" },
          { value: "rural",   label: "Rural" },
          { value: "periurbana", label: "Periurbana" },
          { value: "ignorado", label: "Ignorado" },
        ]} value={fd["zona_ocorrencia"] ?? ""} onChange={v => setFd({ ...fd, zona_ocorrencia: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Tempo até atendimento (horas)</label>
          <input type="text" value={fd["tempo_atendimento_h"] ?? ""} onChange={e => setFd({ ...fd, tempo_atendimento_h: e.target.value })}
            placeholder="Ex: 2"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Local da picada / mordida" name="local_picada" options={[
          { value: "pe_tornozelo",  label: "Pé / Tornozelo" },
          { value: "perna",         label: "Perna" },
          { value: "mao_punho",     label: "Mão / Punho" },
          { value: "braco",         label: "Braço / Antebraço" },
          { value: "tronco",        label: "Tronco" },
          { value: "cabeca_pescoco",label: "Cabeça / Pescoço" },
          { value: "outro",         label: "Outro" },
        ]} value={fd["local_picada"] ?? ""} onChange={v => setFd({ ...fd, local_picada: v })} />
        <SelectField label="Classificação clínica" name="classificacao_clinica" options={[
          { value: "leve",     label: "Leve" },
          { value: "moderado", label: "Moderado" },
          { value: "grave",    label: "Grave" },
        ]} value={fd["classificacao_clinica"] ?? ""} onChange={v => setFd({ ...fd, classificacao_clinica: v })} />
      </div>

      <SectionTitle>Manifestações Clínicas</SectionTitle>
      <CheckGroup title="Sinais Locais" fields={ACIDENTE_SINAIS_LOCAIS} checked={sinaisLocais}
        onToggle={k => { const n = new Set(sinaisLocais); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, sinais_locais: [...n].join(",") }); }} />
      <CheckGroup title="Sinais Sistêmicos" fields={ACIDENTE_SINAIS_SISTEMICOS} checked={sinaisSistemicos}
        onToggle={k => { const n = new Set(sinaisSistemicos); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, sinais_sistemicos: [...n].join(",") }); }} />

      <SectionTitle>Soroterapia</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Soroterapia realizada?" name="soroterapia" options={SIM_NAO_IGN}
          value={fd["soroterapia"] ?? ""} onChange={v => setFd({ ...fd, soroterapia: v })} />
        {fd["soroterapia"] === "sim" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Nº de ampolas administradas</label>
            <input type="text" value={fd["num_ampolas"] ?? ""} onChange={e => setFd({ ...fd, num_ampolas: e.target.value })}
              placeholder="Ex: 4"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
      </div>
      {fd["soroterapia"] === "sim" && (
        <SelectField label="Tipo de soro administrado" name="tipo_soro" options={[
          { value: "sab",    label: "SAB — Soro Antibotrópico" },
          { value: "sacr",   label: "SACR — Soro Anticrotalico" },
          { value: "sabl",   label: "SABL — Soro Antibotrópico-Laquético" },
          { value: "salaaf", label: "SALAF — Soro Antilaquético" },
          { value: "samiaf", label: "SAMi — Soro Antimicrúrico" },
          { value: "saara",  label: "SAA — Soro Antiaracnídico" },
          { value: "saesc",  label: "SAEsc — Soro Antiescorpiônico" },
          { value: "saarap", label: "SAARA — Soro Anti-Apis (abelha)" },
          { value: "outro",  label: "Outro" },
        ]} value={fd["tipo_soro"] ?? ""} onChange={v => setFd({ ...fd, tipo_soro: v })} />
      )}

      <SectionTitle>Desfecho</SectionTitle>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Raiva ────────────────────────────────────────────────────────────────────

function RaivaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Animal Agressor</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Espécie do animal" name="animal_especie" options={[
          { value: "cao",      label: "Cão" },
          { value: "gato",     label: "Gato" },
          { value: "morcego",  label: "Morcego" },
          { value: "raposa",   label: "Raposa / Cachorro-do-mato" },
          { value: "macaco",   label: "Macaco / Primata" },
          { value: "bovino",   label: "Bovino / Equino" },
          { value: "outro",    label: "Outro" },
        ]} value={fd["animal_especie"] ?? ""} onChange={v => setFd({ ...fd, animal_especie: v })} />
        <SelectField label="Animal observável por 10 dias?" name="animal_observavel" options={SIM_NAO_IGN}
          value={fd["animal_observavel"] ?? ""} onChange={v => setFd({ ...fd, animal_observavel: v })} />
      </div>
      <SectionTitle>Tipo de Exposição / Lesão</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo de exposição" name="tipo_exposicao" options={[
          { value: "lambedura_mucosa",      label: "Lambedura em mucosa íntegra" },
          { value: "lambedura_pele",         label: "Lambedura em pele arranhada/ferida" },
          { value: "arranhadura",            label: "Arranhadura" },
          { value: "mordedura_superficial",  label: "Mordedura — ferimento superficial" },
          { value: "mordedura_profundo",     label: "Mordedura — ferimento profundo/único" },
          { value: "mordedura_multiplo",     label: "Mordedura — ferimentos múltiplos" },
          { value: "contato_mucosa",         label: "Contato de saliva com mucosa" },
        ]} value={fd["tipo_exposicao"] ?? ""} onChange={v => setFd({ ...fd, tipo_exposicao: v })} />
        <SelectField label="Localização da lesão" name="local_lesao" options={[
          { value: "cabeca_pescoco", label: "Cabeça / Pescoço" },
          { value: "mao_dedo",       label: "Mão / Dedo" },
          { value: "braco",          label: "Braço / Antebraço" },
          { value: "perna_pe",       label: "Perna / Pé" },
          { value: "tronco",         label: "Tronco" },
          { value: "outro",          label: "Outro" },
        ]} value={fd["local_lesao"] ?? ""} onChange={v => setFd({ ...fd, local_lesao: v })} />
      </div>
      <SectionTitle>Profilaxia Anti-Rábica</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Vacinação anti-rábica anterior" name="vacina_previa" options={SIM_NAO_IGN}
          value={fd["vacina_previa"] ?? ""} onChange={v => setFd({ ...fd, vacina_previa: v })} />
        <SelectField label="Soro anti-rábico (SAR) aplicado" name="sar_aplicado" options={SIM_NAO_IGN}
          value={fd["sar_aplicado"] ?? ""} onChange={v => setFd({ ...fd, sar_aplicado: v })} />
        <SelectField label="Nº de doses de vacina aplicadas" name="doses_vacina" options={[
          { value: "0", label: "Nenhuma" }, { value: "1", label: "1 dose" },
          { value: "2", label: "2 doses" }, { value: "3", label: "3 doses" },
          { value: "4", label: "4 doses" }, { value: "5", label: "5 doses" },
        ]} value={fd["doses_vacina"] ?? ""} onChange={v => setFd({ ...fd, doses_vacina: v })} />
        <SelectField label="Esquema" name="esquema_profilaxia" options={[
          { value: "pep_completa",      label: "Pós-exposição completo (PEP)" },
          { value: "pep_incompleta",    label: "Pós-exposição incompleto" },
          { value: "pre_exposicao",     label: "Pré-exposição" },
          { value: "reforco",           label: "Reforço" },
          { value: "nao_indicado",      label: "Não indicado" },
        ]} value={fd["esquema_profilaxia"] ?? ""} onChange={v => setFd({ ...fd, esquema_profilaxia: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Tétano ───────────────────────────────────────────────────────────────────

function TetanoFields({ agravoCode, fd, setFd }: { agravoCode: string; fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const neonatal = agravoCode === "tetano_neonatal";
  return (
    <div className="space-y-4">
      {neonatal ? (
        <>
          <SectionTitle>Dados do Recém-Nascido / Parto</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Local do parto" name="local_parto" options={[
              { value: "hospital",       label: "Hospital / Maternidade" },
              { value: "domiciliar",     label: "Domiciliar" },
              { value: "outros",         label: "Outros" },
              { value: "ignorado",       label: "Ignorado" },
            ]} value={fd["local_parto"] ?? ""} onChange={v => setFd({ ...fd, local_parto: v })} />
            <SelectField label="Assistência ao parto" name="assist_parto" options={[
              { value: "medico",         label: "Médico" },
              { value: "enfermeiro",     label: "Enfermeiro" },
              { value: "parteira",       label: "Parteira" },
              { value: "leigo",          label: "Leigo" },
              { value: "sem_assistencia",label: "Sem assistência" },
              { value: "ignorado",       label: "Ignorado" },
            ]} value={fd["assist_parto"] ?? ""} onChange={v => setFd({ ...fd, assist_parto: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Cuidado com coto umbilical" name="coto_umbilical" options={[
              { value: "antisseptico",   label: "Produto antisséptico" },
              { value: "nao_antisseptico",label: "Produto não antisséptico" },
              { value: "nenhum",         label: "Nenhum produto" },
              { value: "ignorado",       label: "Ignorado" },
            ]} value={fd["coto_umbilical"] ?? ""} onChange={v => setFd({ ...fd, coto_umbilical: v })} />
            <SelectField label="VTA da mãe (doses)" name="vta_mae_doses" options={[
              { value: "nenhuma", label: "Nenhuma" }, { value: "1", label: "1 dose" },
              { value: "2", label: "2 doses" },       { value: "3+", label: "3 ou mais doses" },
              { value: "ignorado", label: "Ignorado" },
            ]} value={fd["vta_mae_doses"] ?? ""} onChange={v => setFd({ ...fd, vta_mae_doses: v })} />
          </div>
        </>
      ) : (
        <>
          <SectionTitle>Dados da Ferida</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Tipo de ferimento" name="tipo_ferimento" options={[
              { value: "puntiforme",       label: "Puntiforme / Perfurante" },
              { value: "cortocontuso",     label: "Cortocontuso" },
              { value: "lacerado",         label: "Lacerado" },
              { value: "amputacao",        label: "Amputação" },
              { value: "fratura_exposta",  label: "Fratura exposta" },
              { value: "queimadura",       label: "Queimadura" },
              { value: "cirurgico",        label: "Cirúrgico" },
              { value: "ulcera",           label: "Úlcera / Escara" },
              { value: "outro",            label: "Outro" },
            ]} value={fd["tipo_ferimento"] ?? ""} onChange={v => setFd({ ...fd, tipo_ferimento: v })} />
            <SelectField label="Localização do ferimento" name="local_ferimento" options={[
              { value: "cabeca_pescoco", label: "Cabeça / Pescoço" },
              { value: "tronco",         label: "Tronco" },
              { value: "membro_superior",label: "Membro superior" },
              { value: "membro_inferior",label: "Membro inferior" },
              { value: "multiplo",       label: "Múltiplos" },
            ]} value={fd["local_ferimento"] ?? ""} onChange={v => setFd({ ...fd, local_ferimento: v })} />
          </div>
        </>
      )}
      <SectionTitle>Vacinação Antitetânica (VTA)</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Doses de VTA recebidas" name="vta_doses" options={[
          { value: "nenhuma", label: "Nenhuma" }, { value: "1", label: "1 dose" },
          { value: "2", label: "2 doses" },       { value: "3+", label: "3 ou mais doses" },
          { value: "ignorado", label: "Ignorado" },
        ]} value={fd["vta_doses"] ?? ""} onChange={v => setFd({ ...fd, vta_doses: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da última dose VTA</label>
          <input type="date" value={fd["data_ultima_vta"] ?? ""} onChange={e => setFd({ ...fd, data_ultima_vta: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="SAT (Soro Antitetânico) aplicado" name="sat_aplicado" options={SIM_NAO_IGN}
          value={fd["sat_aplicado"] ?? ""} onChange={v => setFd({ ...fd, sat_aplicado: v })} />
        <SelectField label="IGH-T (Imunoglobulina Humana) aplicada" name="igh_t_aplicado" options={SIM_NAO_IGN}
          value={fd["igh_t_aplicado"] ?? ""} onChange={v => setFd({ ...fd, igh_t_aplicado: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Leptospirose ─────────────────────────────────────────────────────────────

const LEPTO_EXPOSICAO: CheckField[] = [
  { key: "enchente",    label: "Enchente / Alagamento" },
  { key: "esgoto",      label: "Contato com esgoto / água suja" },
  { key: "solo_lamac",  label: "Solo lamacento" },
  { key: "rato",        label: "Contato com rato / urina de roedor" },
  { key: "bovino_cao",  label: "Contato com bovinos / cão" },
  { key: "abatedouro",  label: "Trabalho em abatedouro / frigorífico" },
  { key: "agua_lazer",  label: "Lazer em rios / lagoas" },
];
const LEPTO_SINTOMAS: CheckField[] = [
  { key: "febre",        label: "Febre" },
  { key: "cefaleia",     label: "Cefaleia intensa" },
  { key: "mialgia",      label: "Mialgia (dor muscular)" },
  { key: "ictericia",    label: "Icterícia" },
  { key: "conjuntivite", label: "Conjuntivite hemorrágica" },
  { key: "insuf_renal",  label: "Insuficiência renal / oligúria" },
  { key: "hemorragia",   label: "Hemorragia / petéquias" },
  { key: "choque",       label: "Choque / hipotensão" },
];

function LeptospiroseFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const expo = new Set((fd["exposicao"] ?? "").split(",").filter(Boolean));
  const sint = new Set((fd["sintomas"]  ?? "").split(",").filter(Boolean));
  return (
    <div className="space-y-4">
      <SectionTitle>Exposição / Fonte de Infecção</SectionTitle>
      <CheckGroup title="Exposições identificadas" fields={LEPTO_EXPOSICAO} checked={expo}
        onToggle={k => { const n = new Set(expo); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, exposicao: [...n].join(",") }); }} />
      <SectionTitle>Manifestações Clínicas</SectionTitle>
      <CheckGroup title="Sintomas presentes" fields={LEPTO_SINTOMAS} checked={sint}
        onToggle={k => { const n = new Set(sint); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, sintomas: [...n].join(",") }); }} />
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="MAT (Microaglutinação)" name="mat_resultado" options={LAB_RESULTADO}
          value={fd["mat_resultado"] ?? ""} onChange={v => setFd({ ...fd, mat_resultado: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Título MAT</label>
          <input type="text" value={fd["mat_titulo"] ?? ""} onChange={e => setFd({ ...fd, mat_titulo: e.target.value })}
            placeholder="Ex: 1:800"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="ELISA IgM" name="elisa_igm" options={LAB_RESULTADO}
          value={fd["elisa_igm"] ?? ""} onChange={v => setFd({ ...fd, elisa_igm: v })} />
        <SelectField label="PCR Leptospira" name="pcr_lepto" options={LAB_RESULTADO}
          value={fd["pcr_lepto"] ?? ""} onChange={v => setFd({ ...fd, pcr_lepto: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN}
          value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <SelectField label="Tratamento" name="tratamento" options={[
          { value: "penicilina",     label: "Penicilina / Ampicilina" },
          { value: "doxiciclina",    label: "Doxiciclina" },
          { value: "ceftriaxona",    label: "Ceftriaxona" },
          { value: "outro",          label: "Outro" },
          { value: "nao_realizado",  label: "Não realizado" },
        ]} value={fd["tratamento"] ?? ""} onChange={v => setFd({ ...fd, tratamento: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Hantavirose ──────────────────────────────────────────────────────────────

const HANTA_SINTOMAS: CheckField[] = [
  { key: "febre",        label: "Febre" },
  { key: "mialgia",      label: "Mialgia intensa" },
  { key: "cefaleia",     label: "Cefaleia" },
  { key: "dispneia",     label: "Dispneia / Insuficiência respiratória" },
  { key: "hipotensao",   label: "Hipotensão / Choque" },
  { key: "oliguria",     label: "Oligúria / Insuficiência renal" },
  { key: "plaquetopenia",label: "Plaquetopenia (<150.000)" },
];

function HantaviroseFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const sint = new Set((fd["sintomas"] ?? "").split(",").filter(Boolean));
  return (
    <div className="space-y-4">
      <SectionTitle>Exposição a Roedores</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Contato com roedores ou fezes" name="contato_roedor" options={SIM_NAO_IGN}
          value={fd["contato_roedor"] ?? ""} onChange={v => setFd({ ...fd, contato_roedor: v })} />
        <SelectField label="Local de exposição" name="local_exposicao" options={[
          { value: "rural",       label: "Zona rural / lavoura" },
          { value: "domiciliar",  label: "Domiciliar / peridomicílio" },
          { value: "trabalho",    label: "Trabalho (armazém, silo, mata)" },
          { value: "outro",       label: "Outro" },
          { value: "ignorado",    label: "Ignorado" },
        ]} value={fd["local_exposicao"] ?? ""} onChange={v => setFd({ ...fd, local_exposicao: v })} />
      </div>
      <SectionTitle>Manifestações Clínicas</SectionTitle>
      <CheckGroup title="Sintomas presentes" fields={HANTA_SINTOMAS} checked={sint}
        onToggle={k => { const n = new Set(sint); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, sintomas: [...n].join(",") }); }} />
      <SelectField label="Raio-X / TC de tórax" name="rx_torax" options={[
        { value: "normal",           label: "Normal" },
        { value: "infiltrado_bil",   label: "Infiltrado bilateral" },
        { value: "derrame",          label: "Derrame pleural" },
        { value: "nao_realizado",    label: "Não realizado" },
      ]} value={fd["rx_torax"] ?? ""} onChange={v => setFd({ ...fd, rx_torax: v })} />
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="PCR Hantavírus" name="pcr_hanta" options={LAB_RESULTADO}
          value={fd["pcr_hanta"] ?? ""} onChange={v => setFd({ ...fd, pcr_hanta: v })} />
        <SelectField label="ELISA IgM Hantavírus" name="elisa_igm" options={LAB_RESULTADO}
          value={fd["elisa_igm"] ?? ""} onChange={v => setFd({ ...fd, elisa_igm: v })} />
        <SelectField label="Hospitalização / UTI" name="hospitalizacao_uti" options={[
          { value: "nao",          label: "Não hospitalizado" },
          { value: "enfermaria",   label: "Hospitalizado — enfermaria" },
          { value: "uti",          label: "Hospitalizado — UTI" },
          { value: "ignorado",     label: "Ignorado" },
        ]} value={fd["hospitalizacao_uti"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao_uti: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Hepatites (A, B, C) ───────────────────────────────────────────────────────

function HepatiteFields({ agravoCode, fd, setFd }: { agravoCode: string; fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const isB = agravoCode === "hepatite_b";
  const isC = agravoCode === "hepatite_c";
  return (
    <div className="space-y-4">
      <SectionTitle>Epidemiologia</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {(isB || isC) && (
          <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN}
            value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
        )}
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN}
          value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
      </div>
      <SelectField label="Modo de transmissão provável" name="modo_transmissao" options={[
        ...(agravoCode === "hepatite_a" ? [{ value: "agua_alimento", label: "Água / Alimento contaminado" }] : []),
        { value: "sexual",       label: "Sexual" },
        { value: "vertical",     label: "Vertical / Perinatal (mãe→filho)" },
        { value: "transfusao",   label: "Transfusão de sangue / hemoderivados" },
        { value: "parenteral",   label: "Parenteral (agulha, seringas compartilhadas)" },
        { value: "transplante",  label: "Transplante de órgão" },
        { value: "outro",        label: "Outro" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["modo_transmissao"] ?? ""} onChange={v => setFd({ ...fd, modo_transmissao: v })} />
      <SectionTitle>Resultados Sorológicos / Laboratoriais</SectionTitle>
      {agravoCode === "hepatite_a" && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Anti-HAV IgM" name="anti_hav_igm" options={LAB_RESULTADO}
            value={fd["anti_hav_igm"] ?? ""} onChange={v => setFd({ ...fd, anti_hav_igm: v })} />
          <SelectField label="Anti-HAV Total" name="anti_hav_total" options={LAB_RESULTADO}
            value={fd["anti_hav_total"] ?? ""} onChange={v => setFd({ ...fd, anti_hav_total: v })} />
        </div>
      )}
      {isB && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="HBsAg" name="hbsag" options={LAB_RESULTADO}
            value={fd["hbsag"] ?? ""} onChange={v => setFd({ ...fd, hbsag: v })} />
          <SelectField label="Anti-HBs" name="anti_hbs" options={LAB_RESULTADO}
            value={fd["anti_hbs"] ?? ""} onChange={v => setFd({ ...fd, anti_hbs: v })} />
          <SelectField label="Anti-HBc IgM" name="anti_hbc_igm" options={LAB_RESULTADO}
            value={fd["anti_hbc_igm"] ?? ""} onChange={v => setFd({ ...fd, anti_hbc_igm: v })} />
          <SelectField label="Anti-HBc Total" name="anti_hbc_total" options={LAB_RESULTADO}
            value={fd["anti_hbc_total"] ?? ""} onChange={v => setFd({ ...fd, anti_hbc_total: v })} />
          <SelectField label="HBeAg" name="hbeag" options={LAB_RESULTADO}
            value={fd["hbeag"] ?? ""} onChange={v => setFd({ ...fd, hbeag: v })} />
          <SelectField label="Anti-HBe" name="anti_hbe" options={LAB_RESULTADO}
            value={fd["anti_hbe"] ?? ""} onChange={v => setFd({ ...fd, anti_hbe: v })} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Carga viral HBV (UI/mL)</label>
            <input type="text" value={fd["carga_viral_hbv"] ?? ""} onChange={e => setFd({ ...fd, carga_viral_hbv: e.target.value })}
              placeholder="Ex: indetectável ou 15000 UI/mL"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}
      {isC && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Anti-HCV" name="anti_hcv" options={LAB_RESULTADO}
            value={fd["anti_hcv"] ?? ""} onChange={v => setFd({ ...fd, anti_hcv: v })} />
          <SelectField label="RNA VHC (PCR qualitativo)" name="rna_vhc" options={LAB_RESULTADO}
            value={fd["rna_vhc"] ?? ""} onChange={v => setFd({ ...fd, rna_vhc: v })} />
          <SelectField label="Genotipagem VHC" name="genotipo_hcv" options={[
            { value: "1a", label: "Genótipo 1a" }, { value: "1b", label: "Genótipo 1b" },
            { value: "2",  label: "Genótipo 2" },  { value: "3",  label: "Genótipo 3" },
            { value: "4",  label: "Genótipo 4" },  { value: "nao_realizado", label: "Não realizado" },
          ]} value={fd["genotipo_hcv"] ?? ""} onChange={v => setFd({ ...fd, genotipo_hcv: v })} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Carga viral HCV (UI/mL)</label>
            <input type="text" value={fd["carga_viral_hcv"] ?? ""} onChange={e => setFd({ ...fd, carga_viral_hcv: e.target.value })}
              placeholder="Ex: 850000 UI/mL"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tratamento iniciado" name="tratamento_iniciado" options={SIM_NAO_IGN}
          value={fd["tratamento_iniciado"] ?? ""} onChange={v => setFd({ ...fd, tratamento_iniciado: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Sífilis (Adquirida / Congênita) ──────────────────────────────────────────

function SifilisFields({ agravoCode, fd, setFd }: { agravoCode: string; fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const congenita = agravoCode === "sifilis_congenita";
  return (
    <div className="space-y-4">
      {!congenita && (
        <>
          <SectionTitle>Classificação Clínica</SectionTitle>
          <SelectField label="Classificação da sífilis" name="classificacao_sifilis" options={[
            { value: "primaria",       label: "Primária (cancro duro)" },
            { value: "secundaria",     label: "Secundária (roséola, condiloma)" },
            { value: "latente_recente",label: "Latente Recente (< 1 ano)" },
            { value: "latente_tardia", label: "Latente Tardia (> 1 ano ou duração ignorada)" },
            { value: "terciaria",      label: "Terciária (cardiovascular, neurológica, gomosa)" },
          ]} value={fd["classificacao_sifilis"] ?? ""} onChange={v => setFd({ ...fd, classificacao_sifilis: v })} />
        </>
      )}
      {congenita && (
        <>
          <SectionTitle>Dados da Mãe</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="VDRL materno (resultado)" name="vdrl_mae" options={[
              { value: "nao_reativo",  label: "Não Reativo" },
              { value: "reativo",      label: "Reativo" },
              { value: "nao_realizado",label: "Não Realizado" },
            ]} value={fd["vdrl_mae"] ?? ""} onChange={v => setFd({ ...fd, vdrl_mae: v })} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Título VDRL materno</label>
              <input type="text" value={fd["vdrl_mae_titulo"] ?? ""} onChange={e => setFd({ ...fd, vdrl_mae_titulo: e.target.value })}
                placeholder="Ex: 1:16"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <SelectField label="Tratamento da mãe (penicilina)" name="tratamento_mae" options={SIM_NAO_IGN}
              value={fd["tratamento_mae"] ?? ""} onChange={v => setFd({ ...fd, tratamento_mae: v })} />
            <SelectField label="Tratamento do parceiro" name="tratamento_parceiro" options={SIM_NAO_IGN}
              value={fd["tratamento_parceiro"] ?? ""} onChange={v => setFd({ ...fd, tratamento_parceiro: v })} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">IG ao diagnóstico (semanas)</label>
              <input type="text" value={fd["ig_diagnostico"] ?? ""} onChange={e => setFd({ ...fd, ig_diagnostico: e.target.value })}
                placeholder="Ex: 28"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
        </>
      )}
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="VDRL" name="vdrl_resultado" options={[
          { value: "nao_reativo",  label: "Não Reativo" },
          { value: "reativo",      label: "Reativo" },
          { value: "nao_realizado",label: "Não Realizado" },
        ]} value={fd["vdrl_resultado"] ?? ""} onChange={v => setFd({ ...fd, vdrl_resultado: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Título VDRL</label>
          <input type="text" value={fd["vdrl_titulo"] ?? ""} onChange={e => setFd({ ...fd, vdrl_titulo: e.target.value })}
            placeholder="Ex: 1:32"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="FTA-Abs (treponêmico)" name="fta_abs" options={LAB_RESULTADO}
          value={fd["fta_abs"] ?? ""} onChange={v => setFd({ ...fd, fta_abs: v })} />
        <SelectField label="TPHA / ELISA Treponêmico" name="tpha" options={LAB_RESULTADO}
          value={fd["tpha"] ?? ""} onChange={v => setFd({ ...fd, tpha: v })} />
      </div>
      <SectionTitle>Tratamento</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tratamento com penicilina" name="tratamento_penicilina" options={SIM_NAO_IGN}
          value={fd["tratamento_penicilina"] ?? ""} onChange={v => setFd({ ...fd, tratamento_penicilina: v })} />
        {!congenita && (
          <SelectField label="Parceiro(a) tratado(a)" name="tratamento_parceiro" options={SIM_NAO_IGN}
            value={fd["tratamento_parceiro"] ?? ""} onChange={v => setFd({ ...fd, tratamento_parceiro: v })} />
        )}
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── HIV / HIV em Gestante ─────────────────────────────────────────────────────

function HivFields({ agravoCode, fd, setFd }: { agravoCode: string; fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const gestante = agravoCode === "hiv_gestante";
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Clínicos e Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Contagem de CD4 (células/mm³)</label>
          <input type="text" value={fd["cd4"] ?? ""} onChange={e => setFd({ ...fd, cd4: e.target.value })}
            placeholder="Ex: 350"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Carga viral HIV (cópias/mL)</label>
          <input type="text" value={fd["carga_viral"] ?? ""} onChange={e => setFd({ ...fd, carga_viral: e.target.value })}
            placeholder="Ex: indetectável ou 5000"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="Em uso de TARV?" name="tarv" options={SIM_NAO_IGN}
          value={fd["tarv"] ?? ""} onChange={v => setFd({ ...fd, tarv: v })} />
        <SelectField label="Critério diagnóstico" name="criterio_diagnostico" options={[
          { value: "laboratorial",  label: "Laboratorial (Western Blot / PCR)" },
          { value: "clinico",       label: "Clínico-epidemiológico" },
          { value: "ignorado",      label: "Ignorado" },
        ]} value={fd["criterio_diagnostico"] ?? ""} onChange={v => setFd({ ...fd, criterio_diagnostico: v })} />
      </div>
      {fd["tarv"] === "sim" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Esquema TARV em uso</label>
          <input type="text" value={fd["esquema_tarv"] ?? ""} onChange={e => setFd({ ...fd, esquema_tarv: e.target.value })}
            placeholder="Ex: TDF + 3TC + DTG"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      )}
      {gestante && (
        <>
          <SectionTitle>Dados da Gestação</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">IG ao diagnóstico (semanas)</label>
              <input type="text" value={fd["ig_diagnostico"] ?? ""} onChange={e => setFd({ ...fd, ig_diagnostico: e.target.value })}
                placeholder="Ex: 20"
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <SelectField label="Via de parto" name="via_parto" options={[
              { value: "vaginal",    label: "Vaginal" },
              { value: "cesariana",  label: "Cesárea" },
              { value: "ignorado",   label: "Ignorado" },
            ]} value={fd["via_parto"] ?? ""} onChange={v => setFd({ ...fd, via_parto: v })} />
            <SelectField label="AZT intraparto administrado?" name="azt_intraparto" options={SIM_NAO_IGN}
              value={fd["azt_intraparto"] ?? ""} onChange={v => setFd({ ...fd, azt_intraparto: v })} />
            <SelectField label="Fórmula infantil oferecida?" name="formula_infantil" options={SIM_NAO_IGN}
              value={fd["formula_infantil"] ?? ""} onChange={v => setFd({ ...fd, formula_infantil: v })} />
          </div>
        </>
      )}
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── AIDS – Criança / Adolescente ─────────────────────────────────────────────

function AidsCriancaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Clínicos e Laboratoriais</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Contagem de CD4 (células/mm³)</label>
          <input type="text" value={fd["cd4"] ?? ""} onChange={e => setFd({ ...fd, cd4: e.target.value })}
            placeholder="Ex: 200"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Carga viral HIV (cópias/mL)</label>
          <input type="text" value={fd["carga_viral"] ?? ""} onChange={e => setFd({ ...fd, carga_viral: e.target.value })}
            placeholder="Ex: indetectável ou 10000"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="Em uso de TARV?" name="tarv" options={SIM_NAO_IGN}
          value={fd["tarv"] ?? ""} onChange={v => setFd({ ...fd, tarv: v })} />
        <SelectField label="Modo de transmissão" name="modo_transmissao" options={[
          { value: "vertical",    label: "Vertical (mãe→filho)" },
          { value: "transfusao",  label: "Transfusão / hemoderivados" },
          { value: "sexual",      label: "Sexual" },
          { value: "drogas",      label: "Uso de drogas injetáveis" },
          { value: "ignorado",    label: "Ignorado" },
        ]} value={fd["modo_transmissao"] ?? ""} onChange={v => setFd({ ...fd, modo_transmissao: v })} />
        <SelectField label="Critério diagnóstico" name="criterio_diagnostico" options={[
          { value: "laboratorial", label: "Laboratorial" },
          { value: "clinico",      label: "Clínico-epidemiológico" },
          { value: "ignorado",     label: "Ignorado" },
        ]} value={fd["criterio_diagnostico"] ?? ""} onChange={v => setFd({ ...fd, criterio_diagnostico: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Doença de Chagas (Aguda / Crônica) ───────────────────────────────────────

function ChagasFields({ agravoCode, fd, setFd }: { agravoCode: string; fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const aguda = agravoCode === "chagas_aguda";
  return (
    <div className="space-y-4">
      <SectionTitle>Modo de Transmissão</SectionTitle>
      <SelectField label="Provável modo de transmissão" name="modo_transmissao" options={[
        { value: "vetorial",     label: "Vetorial (triatomíneo / barbeiro)" },
        { value: "oral",         label: "Oral (alimento contaminado, ex: açaí)" },
        { value: "transfusao",   label: "Transfusão de sangue / transplante" },
        { value: "vertical",     label: "Vertical (congênita)" },
        { value: "acidente",     label: "Acidente de laboratório" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["modo_transmissao"] ?? ""} onChange={v => setFd({ ...fd, modo_transmissao: v })} />
      {aguda && (
        <>
          <SectionTitle>Exames Parasitológicos Diretos</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Exame a Fresco" name="exame_fresco" options={LAB_RESULTADO}
              value={fd["exame_fresco"] ?? ""} onChange={v => setFd({ ...fd, exame_fresco: v })} />
            <SelectField label="Strout / Microhematócrito" name="strout" options={LAB_RESULTADO}
              value={fd["strout"] ?? ""} onChange={v => setFd({ ...fd, strout: v })} />
          </div>
        </>
      )}
      <SectionTitle>Sorologia</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="ELISA Chagas" name="elisa_chagas" options={LAB_RESULTADO}
          value={fd["elisa_chagas"] ?? ""} onChange={v => setFd({ ...fd, elisa_chagas: v })} />
        <SelectField label="IFI (Imunofluorescência Indireta)" name="ifi_chagas" options={LAB_RESULTADO}
          value={fd["ifi_chagas"] ?? ""} onChange={v => setFd({ ...fd, ifi_chagas: v })} />
      </div>
      {!aguda && (
        <>
          <SectionTitle>Forma Clínica (Chagas Crônica)</SectionTitle>
          <SelectField label="Forma clínica" name="forma_clinica_chagas" options={[
            { value: "cardiaca",        label: "Cardíaca" },
            { value: "digestiva",       label: "Digestiva" },
            { value: "cardiodigestiva", label: "Cardiodigestiva" },
            { value: "indeterminada",   label: "Indeterminada" },
          ]} value={fd["forma_clinica_chagas"] ?? ""} onChange={v => setFd({ ...fd, forma_clinica_chagas: v })} />
          <SelectField label="ECG" name="ecg_chagas" options={[
            { value: "normal",         label: "Normal" },
            { value: "arritmia",       label: "Arritmia" },
            { value: "bloqueio_ramo",  label: "Bloqueio de ramo" },
            { value: "nao_realizado",  label: "Não realizado" },
          ]} value={fd["ecg_chagas"] ?? ""} onChange={v => setFd({ ...fd, ecg_chagas: v })} />
        </>
      )}
      <SectionTitle>Tratamento</SectionTitle>
      <SelectField label="Tratamento etiológico" name="tratamento_etiologico" options={[
        { value: "benznidazol",   label: "Benznidazol" },
        { value: "nifurtimox",    label: "Nifurtimox" },
        { value: "nao_realizado", label: "Não realizado" },
        { value: "ignorado",      label: "Ignorado" },
      ]} value={fd["tratamento_etiologico"] ?? ""} onChange={v => setFd({ ...fd, tratamento_etiologico: v })} />
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Leishmaniose (Visceral / Tegumentar) ──────────────────────────────────────

function LeishmaniaFields({ agravoCode, fd, setFd }: { agravoCode: string; fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const visceral = agravoCode === "leishmaniose_visceral";
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Clínicos</SectionTitle>
      {visceral ? (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Febre prolongada (> 2 semanas)" name="febre_prolongada" options={SIM_NAO_IGN}
            value={fd["febre_prolongada"] ?? ""} onChange={v => setFd({ ...fd, febre_prolongada: v })} />
          <SelectField label="Esplenomegalia" name="esplenomegalia" options={SIM_NAO_IGN}
            value={fd["esplenomegalia"] ?? ""} onChange={v => setFd({ ...fd, esplenomegalia: v })} />
          <SelectField label="Hepatomegalia" name="hepatomegalia" options={SIM_NAO_IGN}
            value={fd["hepatomegalia"] ?? ""} onChange={v => setFd({ ...fd, hepatomegalia: v })} />
          <SelectField label="Anemia" name="anemia" options={SIM_NAO_IGN}
            value={fd["anemia"] ?? ""} onChange={v => setFd({ ...fd, anemia: v })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Tipo de leishmaniose tegumentar" name="tipo_leishmania_teg" options={[
            { value: "cutanea",        label: "Cutânea (ulcerada)" },
            { value: "mucosa",         label: "Mucosa (nasofaríngea)" },
            { value: "mucocutanea",    label: "Mucocutânea" },
            { value: "disseminada",    label: "Disseminada" },
          ]} value={fd["tipo_leishmania_teg"] ?? ""} onChange={v => setFd({ ...fd, tipo_leishmania_teg: v })} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Localização das lesões</label>
            <input type="text" value={fd["local_lesao"] ?? ""} onChange={e => setFd({ ...fd, local_lesao: e.target.value })}
              placeholder="Ex: membro inferior direito, nariz"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      )}
      <SelectField label="Exposição / Área de risco" name="area_risco" options={[
        { value: "floresta",       label: "Floresta / Mata" },
        { value: "garimpo",        label: "Área de garimpo / extrativismo" },
        { value: "assentamento",   label: "Assentamento / área rural" },
        { value: "periurbana",     label: "Área periurbana" },
        { value: "ignorado",       label: "Ignorado" },
      ]} value={fd["area_risco"] ?? ""} onChange={v => setFd({ ...fd, area_risco: v })} />
      <SectionTitle>Diagnóstico Laboratorial / Imunológico</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="RIFI" name="rifi" options={LAB_RESULTADO}
          value={fd["rifi"] ?? ""} onChange={v => setFd({ ...fd, rifi: v })} />
        <SelectField label="ELISA Leishmania" name="elisa_leish" options={LAB_RESULTADO}
          value={fd["elisa_leish"] ?? ""} onChange={v => setFd({ ...fd, elisa_leish: v })} />
        <SelectField label="Teste Rápido (rK39)" name="rk39" options={LAB_RESULTADO}
          value={fd["rk39"] ?? ""} onChange={v => setFd({ ...fd, rk39: v })} />
        <SelectField label="Intradermorreação de Montenegro" name="montenegro" options={LAB_RESULTADO}
          value={fd["montenegro"] ?? ""} onChange={v => setFd({ ...fd, montenegro: v })} />
        {visceral && (
          <SelectField label="Mielograma / Biópsia de baço" name="mielograma" options={LAB_RESULTADO}
            value={fd["mielograma"] ?? ""} onChange={v => setFd({ ...fd, mielograma: v })} />
        )}
        <SelectField label="Exame parasitológico (biópsia)" name="parasitologico" options={LAB_RESULTADO}
          value={fd["parasitologico"] ?? ""} onChange={v => setFd({ ...fd, parasitologico: v })} />
      </div>
      <SectionTitle>Tratamento</SectionTitle>
      <SelectField label="Droga utilizada" name="droga_tratamento" options={[
        { value: "glucantime",    label: "Glucantime (antimoniato de meglumina)" },
        { value: "anfotericina_b",label: "Anfotericina B convencional" },
        { value: "anfot_lipossoma",label: "Anfotericina B lipossomal" },
        { value: "miltefosina",   label: "Miltefosina" },
        { value: "pentamidina",   label: "Pentamidina" },
        { value: "nao_realizado", label: "Não realizado" },
      ]} value={fd["droga_tratamento"] ?? ""} onChange={v => setFd({ ...fd, droga_tratamento: v })} />
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Intoxicação Exógena ───────────────────────────────────────────────────────

function IntoxicacaoFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Agente Causador</SectionTitle>
      <SelectField label="Tipo de agente" name="agente_intox" options={[
        { value: "medicamento",    label: "Medicamento" },
        { value: "agrotoxico",     label: "Agrotóxico / Pesticida" },
        { value: "raticida",       label: "Raticida" },
        { value: "domissanitario", label: "Domissanitário / Produto de limpeza" },
        { value: "cosmetico",      label: "Cosmético / Higiene pessoal" },
        { value: "veterinario",    label: "Produto veterinário" },
        { value: "planta_fungo",   label: "Planta / Fungo" },
        { value: "droga_abuso",    label: "Droga de abuso / Álcool" },
        { value: "alimento",       label: "Alimento (intoxicação alimentar)" },
        { value: "gas_vapor",      label: "Gás / Vapor / Fumaça" },
        { value: "metal_pesado",   label: "Metal pesado / Produto industrial" },
        { value: "outro",          label: "Outro" },
      ]} value={fd["agente_intox"] ?? ""} onChange={v => setFd({ ...fd, agente_intox: v })} />
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Nome/Descrição do agente</label>
        <input type="text" value={fd["nome_agente"] ?? ""} onChange={e => setFd({ ...fd, nome_agente: e.target.value })}
          placeholder="Ex: Paracetamol 500mg, Roundup, Óleo de soja..."
          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <SectionTitle>Circunstância e Via de Exposição</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Circunstância" name="circunstancia_intox" options={[
          { value: "acidental",         label: "Acidental / Ambiental" },
          { value: "ocupacional",       label: "Ocupacional" },
          { value: "uso_habitual",      label: "Uso habitual (drogas/álcool)" },
          { value: "prescricao_medica", label: "Uso terapêutico (prescrito)" },
          { value: "automedicacao",     label: "Automedicação" },
          { value: "tentativa_suicidio",label: "Tentativa de Suicídio (TAS)" },
          { value: "violencia",         label: "Violência / Homicídio" },
          { value: "ignorado",          label: "Ignorado" },
        ]} value={fd["circunstancia_intox"] ?? ""} onChange={v => setFd({ ...fd, circunstancia_intox: v })} />
        <SelectField label="Via de exposição" name="via_exposicao" options={[
          { value: "oral",        label: "Oral / Digestiva" },
          { value: "cutanea",     label: "Cutânea" },
          { value: "respiratoria",label: "Respiratória / Inalatória" },
          { value: "parenteral",  label: "Parenteral (injeção)" },
          { value: "ocular",      label: "Ocular" },
          { value: "mucosa",      label: "Mucosa (nasal, vaginal)" },
          { value: "multiplas",   label: "Múltiplas vias" },
          { value: "ignorado",    label: "Ignorado" },
        ]} value={fd["via_exposicao"] ?? ""} onChange={v => setFd({ ...fd, via_exposicao: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Antídoto / tratamento específico" name="antidoto" options={[
          { value: "sim",           label: "Sim (administrado)" },
          { value: "nao_indicado",  label: "Não indicado" },
          { value: "nao_disponivel",label: "Não disponível" },
        ]} value={fd["antidoto"] ?? ""} onChange={v => setFd({ ...fd, antidoto: v })} />
        {fd["antidoto"] === "sim" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Antídoto utilizado</label>
            <input type="text" value={fd["nome_antidoto"] ?? ""} onChange={e => setFd({ ...fd, nome_antidoto: e.target.value })}
              placeholder="Ex: N-acetilcisteína, atropina..."
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Acidente de Trabalho ──────────────────────────────────────────────────────

function AcidenteTrabalhoFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Dados do Trabalho</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">CBO — Ocupação do trabalhador</label>
          <input type="text" value={fd["cbo"] ?? ""} onChange={e => setFd({ ...fd, cbo: e.target.value })}
            placeholder="Ex: Pedreiro, Operador de máquina..."
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="CAT (Comunicação de Acidente) emitida?" name="cat_emitida" options={SIM_NAO_IGN}
          value={fd["cat_emitida"] ?? ""} onChange={v => setFd({ ...fd, cat_emitida: v })} />
      </div>
      <SectionTitle>Tipo e Causa do Acidente</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo de acidente" name="tipo_acidente_trab" options={[
          { value: "tipico",     label: "Típico (durante a atividade laboral)" },
          { value: "percurso",   label: "De percurso (trajeto casa→trabalho)" },
          { value: "doenca",     label: "Doença relacionada ao trabalho" },
          { value: "ignorado",   label: "Ignorado" },
        ]} value={fd["tipo_acidente_trab"] ?? ""} onChange={v => setFd({ ...fd, tipo_acidente_trab: v })} />
        <SelectField label="Agente causador" name="agente_causador" options={[
          { value: "biologico",   label: "Agente biológico (material biológico, agulha)" },
          { value: "quimico",     label: "Agente químico / tóxico" },
          { value: "fisico",      label: "Agente físico (ruído, calor, vibração)" },
          { value: "mecanico",    label: "Acidente mecânico (queda, esmagamento, corte)" },
          { value: "ergonomico",  label: "Ergonômico / esforço repetitivo" },
          { value: "outro",       label: "Outro" },
          { value: "ignorado",    label: "Ignorado" },
        ]} value={fd["agente_causador"] ?? ""} onChange={v => setFd({ ...fd, agente_causador: v })} />
        <SelectField label="Parte do corpo afetada" name="parte_corpo" options={[
          { value: "cabeca",          label: "Cabeça / Pescoço" },
          { value: "torax",           label: "Tórax / Abdome" },
          { value: "coluna",          label: "Coluna vertebral" },
          { value: "membro_superior", label: "Membro(s) superior(es)" },
          { value: "membro_inferior", label: "Membro(s) inferior(es)" },
          { value: "multiplas",       label: "Múltiplas regiões" },
          { value: "outro",           label: "Outro" },
        ]} value={fd["parte_corpo"] ?? ""} onChange={v => setFd({ ...fd, parte_corpo: v })} />
        <SelectField label="Afastamento do trabalho" name="afastamento" options={[
          { value: "sem",            label: "Sem afastamento" },
          { value: "ate_15",         label: "Até 15 dias" },
          { value: "16_a_6m",        label: "16 dias a 6 meses" },
          { value: "mais_6m",        label: "Mais de 6 meses" },
          { value: "ignorado",       label: "Ignorado" },
        ]} value={fd["afastamento"] ?? ""} onChange={v => setFd({ ...fd, afastamento: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Hanseníase ────────────────────────────────────────────────────────────────

function HanseniaseFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Classificação Clínica</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Forma clínica (Madri)" name="forma_clinica_hans" options={[
          { value: "indeterminada",  label: "Indeterminada (I)" },
          { value: "tuberculoide",   label: "Tuberculóide (T)" },
          { value: "dimorfa",        label: "Dimorfa / Borderline (D)" },
          { value: "virchowiana",    label: "Virchowiana / Lepromatosa (V)" },
        ]} value={fd["forma_clinica_hans"] ?? ""} onChange={v => setFd({ ...fd, forma_clinica_hans: v })} />
        <SelectField label="Classificação OMS" name="class_oms_hans" options={[
          { value: "pb", label: "Paucibacilar (PB) — até 5 lesões" },
          { value: "mb", label: "Multibacilar (MB) — mais de 5 lesões" },
        ]} value={fd["class_oms_hans"] ?? ""} onChange={v => setFd({ ...fd, class_oms_hans: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Nº de lesões cutâneas</label>
          <input type="number" min={0} value={fd["num_lesoes"] ?? ""} onChange={e => setFd({ ...fd, num_lesoes: e.target.value })}
            placeholder="Ex: 3"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Nº de nervos afetados</label>
          <input type="number" min={0} value={fd["num_nervos"] ?? ""} onChange={e => setFd({ ...fd, num_nervos: e.target.value })}
            placeholder="Ex: 1"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Baciloscopia" name="baciloscopia_hans" options={LAB_RESULTADO}
          value={fd["baciloscopia_hans"] ?? ""} onChange={v => setFd({ ...fd, baciloscopia_hans: v })} />
        <SelectField label="Reação de Mitsuda (Lepromin)" name="mitsuda" options={LAB_RESULTADO}
          value={fd["mitsuda"] ?? ""} onChange={v => setFd({ ...fd, mitsuda: v })} />
      </div>
      <SectionTitle>Tratamento (PQT)</SectionTitle>
      <SelectField label="Esquema de tratamento" name="esquema_pqt" options={[
        { value: "pb_6",        label: "PQT-PB — 6 doses (paucibacilar)" },
        { value: "mb_12",       label: "PQT-MB — 12 doses (multibacilar)" },
        { value: "outro",       label: "Outro esquema" },
        { value: "nao_iniciado",label: "Não iniciado" },
      ]} value={fd["esquema_pqt"] ?? ""} onChange={v => setFd({ ...fd, esquema_pqt: v })} />
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Coqueluche ────────────────────────────────────────────────────────────────

function CoquelucheFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Vacinação (DTP / dTpa)</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Doses de DTP recebidas" name="dtp_doses" options={[
          { value: "nenhuma", label: "Nenhuma" }, { value: "1", label: "1 dose" },
          { value: "2", label: "2 doses" },       { value: "3", label: "3 doses" },
          { value: "3_reforco", label: "3 doses + reforço(s)" },
          { value: "ignorado", label: "Ignorado" },
        ]} value={fd["dtp_doses"] ?? ""} onChange={v => setFd({ ...fd, dtp_doses: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data da última dose DTP</label>
          <input type="date" value={fd["data_ultima_dtp"] ?? ""} onChange={e => setFd({ ...fd, data_ultima_dtp: e.target.value })}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <SectionTitle>Fase Clínica e Diagnóstico</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Fase clínica atual" name="fase_clinica_coq" options={[
          { value: "catarral",      label: "Catarral (1ª–2ª semana, tosse leve)" },
          { value: "paroxistica",   label: "Paroxística (guinchos, vômito, cianose)" },
          { value: "convalescenca", label: "Convalescença (tosse residual)" },
        ]} value={fd["fase_clinica_coq"] ?? ""} onChange={v => setFd({ ...fd, fase_clinica_coq: v })} />
        <SelectField label="Casos em familiares / escola" name="casos_contato" options={SIM_NAO_IGN}
          value={fd["casos_contato"] ?? ""} onChange={v => setFd({ ...fd, casos_contato: v })} />
        <SelectField label="Cultura para Bordetella pertussis" name="cultura_bordetella" options={LAB_RESULTADO}
          value={fd["cultura_bordetella"] ?? ""} onChange={v => setFd({ ...fd, cultura_bordetella: v })} />
        <SelectField label="PCR Bordetella pertussis" name="pcr_bordetella" options={LAB_RESULTADO}
          value={fd["pcr_bordetella"] ?? ""} onChange={v => setFd({ ...fd, pcr_bordetella: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Difteria ──────────────────────────────────────────────────────────────────

function DifteriaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Vacinação (DTP)</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Doses de DTP recebidas" name="dtp_doses" options={[
          { value: "nenhuma", label: "Nenhuma" }, { value: "1", label: "1 dose" },
          { value: "2", label: "2 doses" },       { value: "3+", label: "3 ou mais doses" },
          { value: "ignorado", label: "Ignorado" },
        ]} value={fd["dtp_doses"] ?? ""} onChange={v => setFd({ ...fd, dtp_doses: v })} />
      </div>
      <SectionTitle>Dados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Localização da membrana" name="local_difteria" options={[
          { value: "faringea",   label: "Faríngea" },
          { value: "amigdaliana",label: "Amigdaliana" },
          { value: "laringea",   label: "Laríngea" },
          { value: "nasal",      label: "Nasal" },
          { value: "cutanea",    label: "Cutânea" },
          { value: "outra",      label: "Outra" },
        ]} value={fd["local_difteria"] ?? ""} onChange={v => setFd({ ...fd, local_difteria: v })} />
        <SelectField label="Complicações (miocardite/neuropatia)" name="complicacoes_dift" options={SIM_NAO_IGN}
          value={fd["complicacoes_dift"] ?? ""} onChange={v => setFd({ ...fd, complicacoes_dift: v })} />
      </div>
      <SectionTitle>Diagnóstico e Tratamento</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Cultura (C. diphtheriae)" name="cultura_difteria" options={LAB_RESULTADO}
          value={fd["cultura_difteria"] ?? ""} onChange={v => setFd({ ...fd, cultura_difteria: v })} />
        <SelectField label="Antitoxina diftérica aplicada" name="antitoxina" options={SIM_NAO_IGN}
          value={fd["antitoxina"] ?? ""} onChange={v => setFd({ ...fd, antitoxina: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Zika Vírus ────────────────────────────────────────────────────────────────

function ZikaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const gestante = fd["gestante"] === "sim";
  return (
    <div className="space-y-4">
      <SectionTitle>Dados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Exantema (manchas/erupção cutânea)" name="exantema_zika" options={SIM_NAO_IGN}
          value={fd["exantema_zika"] ?? ""} onChange={v => setFd({ ...fd, exantema_zika: v })} />
        <SelectField label="Artralgia / Artrite" name="artralgia" options={SIM_NAO_IGN}
          value={fd["artralgia"] ?? ""} onChange={v => setFd({ ...fd, artralgia: v })} />
        <SelectField label="Conjuntivite não purulenta" name="conjuntivite" options={SIM_NAO_IGN}
          value={fd["conjuntivite"] ?? ""} onChange={v => setFd({ ...fd, conjuntivite: v })} />
        <SelectField label="Febre (≤38,5°C)" name="febre_zika" options={SIM_NAO_IGN}
          value={fd["febre_zika"] ?? ""} onChange={v => setFd({ ...fd, febre_zika: v })} />
        <SelectField label="Gestante" name="gestante" options={SIM_NAO_IGN}
          value={fd["gestante"] ?? ""} onChange={v => setFd({ ...fd, gestante: v })} />
        {gestante && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">IG ao diagnóstico (semanas)</label>
            <input type="text" value={fd["ig_diagnostico"] ?? ""} onChange={e => setFd({ ...fd, ig_diagnostico: e.target.value })}
              placeholder="Ex: 12"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
        {gestante && (
          <SelectField label="Microcefalia fetal identificada?" name="microcefalia" options={[
            { value: "suspeita",    label: "Suspeita (aguardando confirmação)" },
            { value: "confirmada",  label: "Confirmada" },
            { value: "nao",         label: "Não" },
            { value: "ignorado",    label: "Ignorado" },
          ]} value={fd["microcefalia"] ?? ""} onChange={v => setFd({ ...fd, microcefalia: v })} />
        )}
      </div>
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="PCR / RT-PCR Zika" name="pcr_zika" options={LAB_RESULTADO}
          value={fd["pcr_zika"] ?? ""} onChange={v => setFd({ ...fd, pcr_zika: v })} />
        <SelectField label="IgM Zika (ELISA)" name="igm_zika" options={LAB_RESULTADO}
          value={fd["igm_zika"] ?? ""} onChange={v => setFd({ ...fd, igm_zika: v })} />
        <SelectField label="IgG Zika" name="igg_zika" options={LAB_RESULTADO}
          value={fd["igg_zika"] ?? ""} onChange={v => setFd({ ...fd, igg_zika: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── MPOX ─────────────────────────────────────────────────────────────────────

const MPOX_LESOES_LOCAL: CheckField[] = [
  { key: "face",      label: "Face" },
  { key: "tronco",    label: "Tronco" },
  { key: "bracos",    label: "Braços / Antebraços" },
  { key: "pernas",    label: "Pernas" },
  { key: "genitais",  label: "Genitais / Perianal" },
  { key: "mucosa",    label: "Mucosa oral" },
  { key: "palmas",    label: "Palmas / Plantas" },
];

function MpoxFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const lesoes = new Set((fd["lesoes_local"] ?? "").split(",").filter(Boolean));
  return (
    <div className="space-y-4">
      <SectionTitle>Exposição / Histórico Epidemiológico</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Contato com caso confirmado de Mpox" name="contato_mpox" options={SIM_NAO_IGN}
          value={fd["contato_mpox"] ?? ""} onChange={v => setFd({ ...fd, contato_mpox: v })} />
        <SelectField label="Contato com animal (roedor/primata)" name="contato_animal_mpox" options={SIM_NAO_IGN}
          value={fd["contato_animal_mpox"] ?? ""} onChange={v => setFd({ ...fd, contato_animal_mpox: v })} />
        <SelectField label="Viagem recente (< 21 dias)" name="viagem_mpox" options={SIM_NAO_IGN}
          value={fd["viagem_mpox"] ?? ""} onChange={v => setFd({ ...fd, viagem_mpox: v })} />
        <SelectField label="Vacinação prévia contra varíola" name="vacina_variola_mpox" options={SIM_NAO_IGN}
          value={fd["vacina_variola_mpox"] ?? ""} onChange={v => setFd({ ...fd, vacina_variola_mpox: v })} />
      </div>
      <SectionTitle>Lesões Cutâneas</SectionTitle>
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Número estimado de lesões</label>
        <input type="text" value={fd["num_lesoes_mpox"] ?? ""} onChange={e => setFd({ ...fd, num_lesoes_mpox: e.target.value })}
          placeholder="Ex: 10, >50, poucas"
          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <CheckGroup title="Localização das lesões" fields={MPOX_LESOES_LOCAL} checked={lesoes}
        onToggle={k => { const n = new Set(lesoes); n.has(k) ? n.delete(k) : n.add(k); setFd({ ...fd, lesoes_local: [...n].join(",") }); }} />
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="PCR Orthopoxvírus / Mpox" name="pcr_mpox" options={LAB_RESULTADO}
          value={fd["pcr_mpox"] ?? ""} onChange={v => setFd({ ...fd, pcr_mpox: v })} />
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN}
          value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Varicela Grave ────────────────────────────────────────────────────────────

function VaricelaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Vacinação Varicela</SectionTitle>
      <SelectField label="Doses de vacina varicela" name="vacina_varicela_doses" options={[
        { value: "nenhuma",  label: "Nenhuma" },
        { value: "1",        label: "1 dose" },
        { value: "2",        label: "2 doses" },
        { value: "ignorado", label: "Ignorado" },
      ]} value={fd["vacina_varicela_doses"] ?? ""} onChange={v => setFd({ ...fd, vacina_varicela_doses: v })} />
      <SectionTitle>Complicações</SectionTitle>
      <SelectField label="Principal complicação" name="complicacao_varicela" options={[
        { value: "pneumonia",        label: "Pneumonia (viral ou bacteriana)" },
        { value: "encefalite",       label: "Encefalite / Meningite" },
        { value: "superinfeccao",    label: "Superinfecção bacteriana (celulite, fasciíte)" },
        { value: "sindrome_reye",    label: "Síndrome de Reye" },
        { value: "hepatite",         label: "Hepatite" },
        { value: "trombocitopenia",  label: "Trombocitopenia" },
        { value: "sem_complicacao",  label: "Sem complicação identificada" },
        { value: "outro",            label: "Outra" },
      ]} value={fd["complicacao_varicela"] ?? ""} onChange={v => setFd({ ...fd, complicacao_varicela: v })} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN}
          value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
        <SelectField label="Imunodeficiência de base" name="imunodeficiencia" options={SIM_NAO_IGN}
          value={fd["imunodeficiencia"] ?? ""} onChange={v => setFd({ ...fd, imunodeficiencia: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Esquistossomose ───────────────────────────────────────────────────────────

function EsquistossomoseFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Exposição à Água</SectionTitle>
      <SelectField label="Tipo de exposição hídrica" name="exposicao_agua" options={[
        { value: "rio_lago",     label: "Rio / Lago / Açude" },
        { value: "canal",        label: "Canal de irrigação" },
        { value: "pesca",        label: "Pesca / piscicultura" },
        { value: "lazer",        label: "Lazer (banho em rio/lagoa)" },
        { value: "enchente",     label: "Enchente / alagamento" },
        { value: "outro",        label: "Outro" },
        { value: "ignorado",     label: "Ignorado" },
      ]} value={fd["exposicao_agua"] ?? ""} onChange={v => setFd({ ...fd, exposicao_agua: v })} />
      <SectionTitle>Achados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Hepatomegalia" name="hepatomegalia" options={SIM_NAO_IGN}
          value={fd["hepatomegalia"] ?? ""} onChange={v => setFd({ ...fd, hepatomegalia: v })} />
        <SelectField label="Esplenomegalia" name="esplenomegalia" options={SIM_NAO_IGN}
          value={fd["esplenomegalia"] ?? ""} onChange={v => setFd({ ...fd, esplenomegalia: v })} />
        <SelectField label="Hipertensão portal" name="hpertensao_portal" options={SIM_NAO_IGN}
          value={fd["hpertensao_portal"] ?? ""} onChange={v => setFd({ ...fd, hpertensao_portal: v })} />
        <SelectField label="Forma clínica" name="forma_clinica_esq" options={[
          { value: "aguda",       label: "Aguda (febre de Katayama)" },
          { value: "intestinal",  label: "Intestinal" },
          { value: "hepatointestinal", label: "Hepatointestinal" },
          { value: "hepatoesplenica",  label: "Hepatoesplênica" },
        ]} value={fd["forma_clinica_esq"] ?? ""} onChange={v => setFd({ ...fd, forma_clinica_esq: v })} />
      </div>
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Exame parasitológico (Kato-Katz)" name="kato_katz" options={LAB_RESULTADO}
          value={fd["kato_katz"] ?? ""} onChange={v => setFd({ ...fd, kato_katz: v })} />
        <SelectField label="Sorologia esquistossomose" name="sorologia_esq" options={LAB_RESULTADO}
          value={fd["sorologia_esq"] ?? ""} onChange={v => setFd({ ...fd, sorologia_esq: v })} />
      </div>
      <SelectField label="Tratamento com praziquantel" name="praziquantel" options={SIM_NAO_IGN}
        value={fd["praziquantel"] ?? ""} onChange={v => setFd({ ...fd, praziquantel: v })} />
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Febre Maculosa ────────────────────────────────────────────────────────────

function FebreMaculosaFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  const carrapato = fd["contato_carrapato"] === "sim";
  return (
    <div className="space-y-4">
      <SectionTitle>Exposição / Epidemiologia</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Contato com carrapato" name="contato_carrapato" options={SIM_NAO_IGN}
          value={fd["contato_carrapato"] ?? ""} onChange={v => setFd({ ...fd, contato_carrapato: v })} />
        {carrapato && (
          <SelectField label="Espécie do carrapato" name="especie_carrapato" options={[
            { value: "amblyomma",    label: "Amblyomma cajennense (carrapato-estrela)" },
            { value: "rhipicephalus",label: "Rhipicephalus (carrapato-marrom-do-cão)" },
            { value: "nao_id",       label: "Não identificado" },
          ]} value={fd["especie_carrapato"] ?? ""} onChange={v => setFd({ ...fd, especie_carrapato: v })} />
        )}
        <SelectField label="Exposição a mata / floresta" name="exposicao_mata" options={SIM_NAO_IGN}
          value={fd["exposicao_mata"] ?? ""} onChange={v => setFd({ ...fd, exposicao_mata: v })} />
        <SelectField label="Contato com animal (equino, bovino, cão)" name="contato_animal_fm" options={SIM_NAO_IGN}
          value={fd["contato_animal_fm"] ?? ""} onChange={v => setFd({ ...fd, contato_animal_fm: v })} />
      </div>
      <SectionTitle>Achados Clínicos</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Exantema presente" name="exantema_fm" options={SIM_NAO_IGN}
          value={fd["exantema_fm"] ?? ""} onChange={v => setFd({ ...fd, exantema_fm: v })} />
        {fd["exantema_fm"] === "sim" && (
          <SelectField label="Tipo de exantema" name="tipo_exantema_fm" options={[
            { value: "petequial",      label: "Petequial / hemorrágico" },
            { value: "eritematoso",    label: "Eritematoso / maculoso" },
            { value: "maculopapular",  label: "Maculopapular" },
          ]} value={fd["tipo_exantema_fm"] ?? ""} onChange={v => setFd({ ...fd, tipo_exantema_fm: v })} />
        )}
        <SelectField label="Acometimento palmoplantar" name="acometimento_palmoplantar" options={SIM_NAO_IGN}
          value={fd["acometimento_palmoplantar"] ?? ""} onChange={v => setFd({ ...fd, acometimento_palmoplantar: v })} />
      </div>
      <SectionTitle>Diagnóstico e Tratamento</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="RIFI para Rickettsia" name="rifi_rickettsia" options={LAB_RESULTADO}
          value={fd["rifi_rickettsia"] ?? ""} onChange={v => setFd({ ...fd, rifi_rickettsia: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Título RIFI</label>
          <input type="text" value={fd["titulo_rifi"] ?? ""} onChange={e => setFd({ ...fd, titulo_rifi: e.target.value })}
            placeholder="Ex: 1:64"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="PCR Rickettsia" name="pcr_rickettsia" options={LAB_RESULTADO}
          value={fd["pcr_rickettsia"] ?? ""} onChange={v => setFd({ ...fd, pcr_rickettsia: v })} />
        <SelectField label="Tratamento com doxiciclina" name="doxiciclina_fm" options={SIM_NAO_IGN}
          value={fd["doxiciclina_fm"] ?? ""} onChange={v => setFd({ ...fd, doxiciclina_fm: v })} />
        {fd["doxiciclina_fm"] === "sim" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data de início da doxiciclina</label>
            <input type="date" value={fd["data_inicio_doxiciclina"] ?? ""} onChange={e => setFd({ ...fd, data_inicio_doxiciclina: e.target.value })}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
    </div>
  );
}

// ── Epidemiológico Básico (agravos raros: antraz, botulismo, cólera, varíola, febre do Nilo, poliomielite, síndrome hemolítica) ──

function EpidemiologicoBasicoFields({ fd, setFd }: { fd: Record<string, string>; setFd: (fd: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Investigação Epidemiológica</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Outros casos no mesmo ambiente" name="outros_casos_ambiente" options={SIM_NAO_IGN}
          value={fd["outros_casos_ambiente"] ?? ""} onChange={v => setFd({ ...fd, outros_casos_ambiente: v })} />
        <SelectField label="Viagem recente (< 30 dias)" name="viagem_recente" options={SIM_NAO_IGN}
          value={fd["viagem_recente"] ?? ""} onChange={v => setFd({ ...fd, viagem_recente: v })} />
        {fd["viagem_recente"] === "sim" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Destino da viagem</label>
            <input type="text" value={fd["destino_viagem"] ?? ""} onChange={e => setFd({ ...fd, destino_viagem: e.target.value })}
              placeholder="País / Município"
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Provável fonte / via de infecção</label>
        <input type="text" value={fd["fonte_infeccao"] ?? ""} onChange={e => setFd({ ...fd, fonte_infeccao: e.target.value })}
          placeholder="Descreva a exposição suspeita..."
          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <SectionTitle>Diagnóstico Laboratorial</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Exame realizado</label>
          <input type="text" value={fd["exame_realizado"] ?? ""} onChange={e => setFd({ ...fd, exame_realizado: e.target.value })}
            placeholder="Ex: PCR, Cultura, ELISA..."
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <SelectField label="Resultado do exame" name="resultado_exame" options={LAB_RESULTADO}
          value={fd["resultado_exame"] ?? ""} onChange={v => setFd({ ...fd, resultado_exame: v })} />
        <SelectField label="Hospitalização" name="hospitalizacao" options={SIM_NAO_IGN}
          value={fd["hospitalizacao"] ?? ""} onChange={v => setFd({ ...fd, hospitalizacao: v })} />
      </div>
      <SelectField label="Evolução do Caso" name="evolucao" options={EVOLUCAO_OPTS}
        value={fd["evolucao"] ?? ""} onChange={v => setFd({ ...fd, evolucao: v })} />
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
  if (["malaria", "malaria_nao_endemica"].includes(agravoCode)) return <MalariaFields fd={fd} setFd={setFd} />;
  if (agravoCode === "acidente_pecanhento") return <AcidentePeconhentoFields fd={fd} setFd={setFd} />;
  if (agravoCode === "raiva") return <RaivaFields fd={fd} setFd={setFd} />;
  if (["tetano_neonatal", "tetano_acidental"].includes(agravoCode)) return <TetanoFields agravoCode={agravoCode} fd={fd} setFd={setFd} />;
  if (agravoCode === "leptospirose") return <LeptospiroseFields fd={fd} setFd={setFd} />;
  if (agravoCode === "hantavirose") return <HantaviroseFields fd={fd} setFd={setFd} />;
  if (["hepatite_a", "hepatite_b", "hepatite_c"].includes(agravoCode)) return <HepatiteFields agravoCode={agravoCode} fd={fd} setFd={setFd} />;
  if (["sifilis_adquirida", "sifilis_congenita"].includes(agravoCode)) return <SifilisFields agravoCode={agravoCode} fd={fd} setFd={setFd} />;
  if (["hiv", "hiv_gestante"].includes(agravoCode)) return <HivFields agravoCode={agravoCode} fd={fd} setFd={setFd} />;
  if (agravoCode === "aids_crianca") return <AidsCriancaFields fd={fd} setFd={setFd} />;
  if (["chagas_aguda", "chagas_cronica"].includes(agravoCode)) return <ChagasFields agravoCode={agravoCode} fd={fd} setFd={setFd} />;
  if (["leishmaniose_visceral", "leishmaniose_tegumentar"].includes(agravoCode)) return <LeishmaniaFields agravoCode={agravoCode} fd={fd} setFd={setFd} />;
  if (agravoCode === "intoxicacao") return <IntoxicacaoFields fd={fd} setFd={setFd} />;
  if (agravoCode === "acidente_trabalho") return <AcidenteTrabalhoFields fd={fd} setFd={setFd} />;
  if (agravoCode === "hanseniase") return <HanseniaseFields fd={fd} setFd={setFd} />;
  if (agravoCode === "coqueluche") return <CoquelucheFields fd={fd} setFd={setFd} />;
  if (agravoCode === "difteria") return <DifteriaFields fd={fd} setFd={setFd} />;
  if (agravoCode === "zika") return <ZikaFields fd={fd} setFd={setFd} />;
  if (agravoCode === "mpox") return <MpoxFields fd={fd} setFd={setFd} />;
  if (agravoCode === "varicela_grave") return <VaricelaFields fd={fd} setFd={setFd} />;
  if (agravoCode === "esquistossomose") return <EsquistossomoseFields fd={fd} setFd={setFd} />;
  if (agravoCode === "febre_maculosa") return <FebreMaculosaFields fd={fd} setFd={setFd} />;
  if (["antraz", "botulismo", "cholera", "febre_nilo", "poliomielite", "sindrome_hemolitica", "variola"].includes(agravoCode))
    return <EpidemiologicoBasicoFields fd={fd} setFd={setFd} />;
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

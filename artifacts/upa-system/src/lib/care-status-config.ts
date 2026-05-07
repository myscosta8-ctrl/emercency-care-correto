export const CARE_STATUS_CONFIG = {
  "Aguardando Triagem":        { label: "Ag. Triagem",        color: "text-slate-700",   bg: "bg-slate-100",   border: "border-slate-300",   dot: "bg-slate-400"   },
  "Em Triagem":                { label: "Em Triagem",          color: "text-blue-700",    bg: "bg-blue-100",    border: "border-blue-300",    dot: "bg-blue-500"    },
  "Aguardando Atendimento":    { label: "Aguardando",          color: "text-amber-700",   bg: "bg-amber-100",   border: "border-amber-300",   dot: "bg-amber-500"   },
  "Em Atendimento (Cons. 1)":  { label: "Cons. 1",             color: "text-sky-700",     bg: "bg-sky-100",     border: "border-sky-300",     dot: "bg-sky-500"     },
  "Em Atendimento (Cons. 2)":  { label: "Cons. 2",             color: "text-violet-700",  bg: "bg-violet-100",  border: "border-violet-300",  dot: "bg-violet-500"  },
  "Em Medicação":              { label: "Em Medicação",        color: "text-pink-700",    bg: "bg-pink-100",    border: "border-pink-300",    dot: "bg-pink-500"    },
  "Aguardando Exames":         { label: "Ag. Exames",          color: "text-cyan-700",    bg: "bg-cyan-100",    border: "border-cyan-300",    dot: "bg-cyan-500"    },
  "Aguardando Reavaliação":    { label: "Ag. Reavaliação",     color: "text-orange-700",  bg: "bg-orange-100",  border: "border-orange-300",  dot: "bg-orange-500"  },
  "Em Observação":             { label: "Em Observação",       color: "text-teal-700",    bg: "bg-teal-100",    border: "border-teal-300",    dot: "bg-teal-500"    },
  "Internado":                 { label: "Internado",           color: "text-red-700",     bg: "bg-red-100",     border: "border-red-300",     dot: "bg-red-500"     },
  "Em Transferência":          { label: "Em Transferência",    color: "text-purple-700",  bg: "bg-purple-100",  border: "border-purple-300",  dot: "bg-purple-500"  },
  "Alta":                      { label: "Alta",                color: "text-green-700",   bg: "bg-green-100",   border: "border-green-300",   dot: "bg-green-500"   },
} as const;

export type CareStatusKey = keyof typeof CARE_STATUS_CONFIG;

export const CARE_STATUS_KEYS: CareStatusKey[] = [
  "Aguardando Triagem", "Em Triagem", "Aguardando Atendimento",
  "Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)",
  "Em Medicação", "Aguardando Exames", "Aguardando Reavaliação",
  "Em Observação", "Internado", "Em Transferência", "Alta",
];

export const CARE_STATUS_SECTION_KEYS: CareStatusKey[] = [
  "Aguardando Triagem", "Em Triagem", "Aguardando Atendimento",
  "Em Atendimento (Cons. 1)", "Em Atendimento (Cons. 2)",
  "Em Medicação", "Aguardando Exames", "Aguardando Reavaliação",
  "Em Observação", "Internado", "Em Transferência",
];

export const TRIAGE_CONFIG = {
  red:    { label: "Vermelho",  sub: "EMERGÊNCIA",    border: "border-l-red-500",    dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-100"    },
  orange: { label: "Laranja",   sub: "MUITO URGENTE", border: "border-l-orange-500", dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-100" },
  yellow: { label: "Amarelo",   sub: "URGENTE",       border: "border-l-yellow-500", dot: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-100" },
  green:  { label: "Verde",     sub: "POUCO URGENTE", border: "border-l-green-500",  dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-100"  },
  blue:   { label: "Azul",      sub: "NÃO URGENTE",   border: "border-l-blue-500",   dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-100"   },
} as const;

export type TriageKey = keyof typeof TRIAGE_CONFIG;

export const TRIAGE_SEVERITY: Record<string, number> = { red: 1, orange: 2, yellow: 3, green: 4, blue: 5 };

export const ALL_SECTOR_CONFIG = [
  { key: "triagem",               name: "Triagem",               emoji: "🩺", headerCls: "bg-blue-50 border-blue-200 text-blue-700",    emptyBorder: "border-blue-100",   group: "recepcao" as const },
  { key: "sala_vermelha",         name: "Sala Vermelha",         emoji: "🔴", headerCls: "bg-red-50 border-red-200 text-red-700",       emptyBorder: "border-red-100",    group: "leitos"   as const },
  { key: "observacao_adulto",     name: "Observação Adulto",     emoji: "🟡", headerCls: "bg-amber-50 border-amber-200 text-amber-700", emptyBorder: "border-amber-100",  group: "leitos"   as const },
  { key: "observacao_pediatrica", name: "Observação Pediátrica", emoji: "🟢", headerCls: "bg-green-50 border-green-200 text-green-700", emptyBorder: "border-green-100",  group: "leitos"   as const },
  { key: "observacao_pre_adulto", name: "Pré-Observação",        emoji: "🔵", headerCls: "bg-sky-50 border-sky-200 text-sky-700",       emptyBorder: "border-sky-100",    group: "leitos"   as const },
];

export const OBS_SECTORS = new Set([
  "sala_vermelha",
  "observacao_adulto",
  "observacao_pediatrica",
  "observacao_pre_adulto",
]);

export function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

export function hoursSince(iso: string): number {
  return minutesSince(iso) / 60;
}

export function formatElapsed(iso: string): string {
  const mins = Math.floor(minutesSince(iso));
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export type IsolationType = "contact" | "droplet" | "airborne";

export interface IsolationProtocol {
  type:        IsolationType;
  label:       string;
  color:       string;
  bgColor:     string;
  borderColor: string;
  icon:        string;
  indications: string[];
  measures:    { icon: string; text: string }[];
}

export const ISOLATION_PROTOCOLS: Record<IsolationType, IsolationProtocol> = {
  contact: {
    type:        "contact",
    label:       "Contato",
    color:       "text-orange-300",
    bgColor:     "bg-orange-950/40",
    borderColor: "border-orange-500/50",
    icon:        "🧤",
    indications: [
      "Diarreia (C. difficile)",
      "Infecções de pele",
      "Bactérias multirresistentes (MRSA, VRE, ESBL)",
    ],
    measures: [
      { icon: "🧤", text: "Luvas e avental ao entrar no quarto" },
      { icon: "🧼", text: "Higiene rigorosa das mãos (antes e após)" },
      { icon: "🩺", text: "Equipamentos dedicados (estetoscópio, termômetro)" },
    ],
  },
  droplet: {
    type:        "droplet",
    label:       "Gotículas",
    color:       "text-blue-300",
    bgColor:     "bg-blue-950/40",
    borderColor: "border-blue-500/50",
    icon:        "😷",
    indications: [
      "Influenza (gripe)",
      "COVID-19 (leve/moderada)",
      "Meningite bacteriana",
    ],
    measures: [
      { icon: "😷", text: "Máscara cirúrgica ao entrar no quarto" },
      { icon: "🚶", text: "Máscara no paciente se precisar ser transportado" },
      { icon: "📏", text: "Manter distância > 1 metro de outros pacientes" },
    ],
  },
  airborne: {
    type:        "airborne",
    label:       "Aerossóis",
    color:       "text-purple-300",
    bgColor:     "bg-purple-950/40",
    borderColor: "border-purple-500/50",
    icon:        "🌬️",
    indications: [
      "Tuberculose (ativa ou suspeita)",
      "Sarampo",
      "Varicela (catapora)",
    ],
    measures: [
      { icon: "🛡️", text: "Máscara N95/PFF2 obrigatória" },
      { icon: "🏥", text: "Quarto de pressão negativa (se disponível)" },
      { icon: "🚷", text: "Limitar ao máximo a movimentação do paciente" },
    ],
  },
};

interface DiagnosisRule {
  keywords: string[];
  type:     IsolationType;
}

const DIAGNOSIS_RULES: DiagnosisRule[] = [
  { keywords: ["tuberculose", "tb ", " tb", "baciloscop", "baar", "mycobacter"],            type: "airborne"  },
  { keywords: ["sarampo"],                                                                   type: "airborne"  },
  { keywords: ["varicela", "catapora", "herpes zoster", "zoster"],                          type: "airborne"  },
  { keywords: ["covid", "sars-cov", "coronavir"],                                            type: "droplet"   },
  { keywords: ["influenza", "gripe", "h1n1", "h3n2"],                                       type: "droplet"   },
  { keywords: ["meningite"],                                                                 type: "droplet"   },
  { keywords: ["parainfluenza", "adenovir", "rinovir"],                                     type: "droplet"   },
  { keywords: ["c. difficile", "clostridium", "cdiff", "c.diff"],                           type: "contact"   },
  { keywords: ["mrsa", "vre", "esbl", "kpc", "multirresist", "carbapenem", "enterococ"],    type: "contact"   },
  { keywords: ["infecção de pele", "celulite infecciosa", "impetigo", "escabiose", "sarna"], type: "contact"  },
  { keywords: ["diarreia infecciosa", "gastrenterite infecciosa", "rotavirus"],              type: "contact"   },
];

export function suggestIsolationType(text: string): IsolationType | null {
  if (!text || text.trim().length < 3) return null;
  const lower = text.toLowerCase();
  for (const rule of DIAGNOSIS_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.type;
    }
  }
  return null;
}

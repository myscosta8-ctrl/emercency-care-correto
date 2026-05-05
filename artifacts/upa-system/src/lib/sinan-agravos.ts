export interface SinanAgravo {
  code: string;
  label: string;
  cid10: string;
  template: string;
  urgente?: boolean;
}

export const SINAN_AGRAVOS: SinanAgravo[] = [
  // ── Notificação Imediata (≤24h) ──────────────────────────────────────────────
  { code: "antraz",              label: "Antraz / Carbúnculo",                        cid10: "A22",   template: "outros",        urgente: true },
  { code: "botulismo",           label: "Botulismo",                                  cid10: "A05.1", template: "outros",        urgente: true },
  { code: "cholera",             label: "Cólera",                                     cid10: "A00",   template: "outros",        urgente: true },
  { code: "covid19",             label: "COVID-19",                                   cid10: "B34.2", template: "covid19",       urgente: true },
  { code: "dengue_grave",        label: "Dengue Grave / com Sinais de Alarme",        cid10: "A91",   template: "dengue",        urgente: true },
  { code: "difteria",            label: "Difteria",                                   cid10: "A36",   template: "outros",        urgente: true },
  { code: "chagas_aguda",        label: "Doença de Chagas Aguda",                     cid10: "B57.0", template: "outros",        urgente: true },
  { code: "febre_amarela",       label: "Febre Amarela",                              cid10: "A95",   template: "febre_amarela", urgente: true },
  { code: "febre_nilo",          label: "Febre do Nilo Ocidental",                    cid10: "A92.3", template: "outros",        urgente: true },
  { code: "hantavirose",         label: "Hantavirose",                                cid10: "A98.5", template: "outros",        urgente: true },
  { code: "hepatite_a",          label: "Hepatite A",                                 cid10: "B15",   template: "outros",        urgente: true },
  { code: "influenza_pandemia",  label: "Influenza por Novo Subtipo (Pandêmico)",     cid10: "J09",   template: "srag",          urgente: true },
  { code: "leishmaniose_visceral",label: "Leishmaniose Visceral",                     cid10: "B55.0", template: "outros",        urgente: true },
  { code: "malaria_nao_endemica",label: "Malária (área não endêmica)",                cid10: "B54",   template: "outros",        urgente: true },
  { code: "meningite",           label: "Meningite",                                  cid10: "G03.9", template: "meningite",     urgente: true },
  { code: "mpox",                label: "Monkeypox / MPOX",                           cid10: "B04",   template: "outros",        urgente: true },
  { code: "poliomielite",        label: "Poliomielite por Poliovírus Selvagem",        cid10: "A80",   template: "outros",        urgente: true },
  { code: "raiva",               label: "Raiva Humana",                               cid10: "A82",   template: "outros",        urgente: true },
  { code: "srag",                label: "SRAG Hospitalizado",                         cid10: "J22",   template: "srag",          urgente: true },
  { code: "sarampo",             label: "Sarampo",                                    cid10: "B05",   template: "exantematica",  urgente: true },
  { code: "sindrome_hemolitica", label: "Síndrome Hemolítico-Urêmica",                cid10: "D59.3", template: "outros",        urgente: true },
  { code: "tetano_neonatal",     label: "Tétano Neonatal",                            cid10: "A33",   template: "outros",        urgente: true },
  { code: "tetano_acidental",    label: "Tétano Acidental",                           cid10: "A35",   template: "outros",        urgente: true },
  { code: "variola",             label: "Varíola",                                    cid10: "B03",   template: "outros",        urgente: true },
  // ── Notificação Semanal ──────────────────────────────────────────────────────
  { code: "aids_adulto",         label: "AIDS – Adulto",                              cid10: "B24",   template: "aids_adulto" },
  { code: "aids_crianca",        label: "AIDS – Criança / Adolescente",               cid10: "B24",   template: "outros" },
  { code: "acidente_trabalho",   label: "Acidente de Trabalho Grave",                 cid10: "Z57",   template: "outros" },
  { code: "chikungunya",         label: "Chikungunya",                                cid10: "A92.0", template: "dengue" },
  { code: "coqueluche",          label: "Coqueluche / Pertússis",                     cid10: "A37",   template: "outros" },
  { code: "dengue",              label: "Dengue",                                     cid10: "A90",   template: "dengue" },
  { code: "chagas_cronica",      label: "Doença de Chagas Crônica",                   cid10: "B57.2", template: "outros" },
  { code: "esquistossomose",     label: "Esquistossomose",                             cid10: "B65",   template: "outros" },
  { code: "febre_maculosa",      label: "Febre Maculosa Brasileira",                  cid10: "A77.0", template: "outros" },
  { code: "febre_tifoide",       label: "Febre Tifóide",                              cid10: "A01.0", template: "febre_tifoide" },
  { code: "hanseniase",          label: "Hanseníase",                                 cid10: "A30.9", template: "outros" },
  { code: "hepatite_b",          label: "Hepatite B",                                 cid10: "B16",   template: "outros" },
  { code: "hepatite_c",          label: "Hepatite C",                                 cid10: "B17.1", template: "outros" },
  { code: "hiv",                 label: "Infecção pelo HIV",                          cid10: "B24",   template: "outros" },
  { code: "hiv_gestante",        label: "HIV em Gestante / Sífilis em Gestante",      cid10: "Z21",   template: "outros" },
  { code: "intoxicacao",         label: "Intoxicação Exógena",                        cid10: "T65",   template: "outros" },
  { code: "leptospirose",        label: "Leptospirose",                               cid10: "A27.9", template: "outros" },
  { code: "leishmaniose_tegumentar", label: "Leishmaniose Tegumentar Americana",      cid10: "B55.1", template: "outros" },
  { code: "malaria",             label: "Malária",                                    cid10: "B54",   template: "outros" },
  { code: "rubeola",             label: "Rubéola / Síndrome da Rubéola Congênita",    cid10: "B06",   template: "exantematica" },
  { code: "sifilis_adquirida",   label: "Sífilis Adquirida",                          cid10: "A51",   template: "outros" },
  { code: "sifilis_congenita",   label: "Sífilis Congênita",                          cid10: "A50",   template: "outros" },
  { code: "tuberculose",         label: "Tuberculose",                                cid10: "A16.9", template: "tuberculose" },
  { code: "varicela_grave",      label: "Varicela Grave / Óbito por Varicela",        cid10: "B01",   template: "outros" },
  { code: "violencia",           label: "Violência Doméstica, Sexual e/ou Autoprovocada", cid10: "Y09", template: "violencia" },
  { code: "zika",                label: "Zika Vírus",                                 cid10: "A92.8", template: "outros" },
  { code: "acidente_pecanhento", label: "Acidente por Animais Peçonhentos",            cid10: "X20",   template: "outros" },
];

export function findAgravo(code: string): SinanAgravo | undefined {
  return SINAN_AGRAVOS.find(a => a.code === code);
}

export function agravoToTemplate(code: string): string {
  return findAgravo(code)?.template ?? "outros";
}

export function agravoLabel(code: string): string {
  return findAgravo(code)?.label ?? code;
}

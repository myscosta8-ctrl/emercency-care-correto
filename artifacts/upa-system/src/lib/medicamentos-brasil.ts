/* ── Exames ─────────────────────────────────────────────────────────── */
export interface GrupoExames {
  grupo: string;
  exames: string[];
}

export const PRIORIDADES_EXAME = [
  { value: "urgente",  label: "Urgente",  color: "border-red-500/60 bg-red-500/10 text-red-400" },
  { value: "rotina",   label: "Rotina",   color: "border-yellow-500/60 bg-yellow-500/10 text-yellow-400" },
  { value: "eletivo",  label: "Eletivo",  color: "border-muted-foreground/40 bg-muted/10 text-muted-foreground" },
] as const;

export const EXAMES_LABORATORIAIS: GrupoExames[] = [
  {
    grupo: "Hemograma / Coagulação",
    exames: [
      "Hemograma completo", "Contagem de plaquetas", "Reticulócitos",
      "TP (TAP) / RNI", "TTPA", "Fibrinogênio", "D-Dímero",
      "Hematoscopia", "Tipagem sanguínea ABO/Rh",
    ],
  },
  {
    grupo: "Bioquímica Geral",
    exames: [
      "Glicemia de jejum", "Glicemia capilar (HGT)", "Hemoglobina glicada (HbA1c)",
      "Ureia", "Creatinina", "TFG estimada", "Ácido úrico",
      "Sódio (Na+)", "Potássio (K+)", "Cloro (Cl-)", "Cálcio total", "Cálcio iônico",
      "Magnésio", "Fósforo", "Ferro sérico", "Ferritina",
    ],
  },
  {
    grupo: "Função Hepática / Pancreática",
    exames: [
      "TGO (AST)", "TGP (ALT)", "GGT", "Fosfatase alcalina",
      "Bilirrubina total e frações", "Albumina", "Proteínas totais e frações",
      "Amilase", "Lipase", "LDH",
    ],
  },
  {
    grupo: "Cardíaco / Inflamação",
    exames: [
      "Troponina I / T", "CK-MB (massa)", "CK total", "BNP / NT-proBNP",
      "PCR (Proteína C Reativa)", "PCR ultrassensível", "VHS",
      "Procalcitonina", "Interleucina-6", "Lactato sérico",
    ],
  },
  {
    grupo: "Hormônios / Tireóide",
    exames: [
      "TSH", "T4 livre", "T4 total", "T3 livre",
      "Cortisol basal", "PTH (paratormônio)",
      "Beta-HCG quantitativo", "Beta-HCG qualitativo",
    ],
  },
  {
    grupo: "Gasometria / Eletrólitos",
    exames: [
      "Gasometria arterial", "Gasometria venosa",
      "Eletrólitos completos (Na, K, Cl, Ca, Mg, P)",
      "Bicarbonato sérico", "Ânion-gap",
    ],
  },
  {
    grupo: "Urina / Renal",
    exames: [
      "EAS (Urina tipo 1)", "Urina de 24h (proteína)", "Urina de 24h (creatinina)",
      "Urocultura + antibiograma", "Sedimento urinário",
      "Beta-2 microglobulina", "Microalbuminúria",
    ],
  },
  {
    grupo: "Microbiologia / Infecções",
    exames: [
      "Hemocultura (2 amostras)", "Cultura de secreção", "Cultura de urina",
      "Coprocultura", "Líquor (cultura + citológico)",
      "PCR para SARS-CoV-2 (COVID-19)", "Antígeno para Influenza A/B",
      "Dengue NS1 / IgM / IgG", "Malária (gota espessa + esfregaço)",
      "VDRL / RPR (sífilis)", "Anti-HIV 1 e 2",
      "HBsAg", "Anti-HCV", "Anti-HBc total",
      "Widal / Weil-Felix", "PPD (Mantoux)",
    ],
  },
  {
    grupo: "Líquidos Corporais",
    exames: [
      "Líquor (LCR) — análise completa", "Líquido pleural (análise)",
      "Líquido ascítico (análise)", "Líquido sinovial (análise)",
      "Pesquisa de BAAR (escarro)", "Cultura de escarro",
    ],
  },
  {
    grupo: "Toxicologia / Drogas",
    exames: [
      "Etilômetro / Alcoolemia", "Triagem toxicológica urina",
      "Dosagem de paracetamol", "Dosagem de salicilato",
      "Digoxinemia", "Fenitoína sérica", "Vancocinemia",
    ],
  },
];

export const EXAMES_IMAGEM: GrupoExames[] = [
  {
    grupo: "Radiologia Convencional (RX)",
    exames: [
      "RX de tórax (PA + Perfil)", "RX de tórax (AP — leito)",
      "RX de abdome (simples — decúbito)", "RX de abdome (ortostático)",
      "RX de crânio (AP + Perfil)", "RX de coluna cervical",
      "RX de coluna lombar", "RX de coluna torácica",
      "RX de pelve", "RX de bacia (AP)",
      "RX de mão", "RX de punho", "RX de antebraço",
      "RX de cotovelo", "RX de ombro",
      "RX de pé", "RX de tornozelo", "RX de perna",
      "RX de joelho", "RX de fêmur",
    ],
  },
  {
    grupo: "Ultrassonografia (USG)",
    exames: [
      "USG de abdome total", "USG de abdome superior",
      "USG pélvica (transvaginal)", "USG pélvica (via abdominal)",
      "USG de vias urinárias (rins e bexiga)",
      "USG de tireoide e paratireoide",
      "USG de partes moles", "USG de bolsa escrotal",
      "USG doppler de membros inferiores (TVP)",
      "USG doppler de carótidas",
      "USG de mama", "USG obstétrica",
      "FAST (Focused Assessment with Sonography in Trauma)",
    ],
  },
  {
    grupo: "Tomografia Computadorizada (TC)",
    exames: [
      "TC de crânio sem contraste",
      "TC de crânio com contraste",
      "TC de tórax sem contraste",
      "TC de tórax com contraste (angioTC — TEP)",
      "TC de abdome e pelve sem contraste",
      "TC de abdome e pelve com contraste",
      "TC de coluna cervical", "TC de coluna torácica",
      "TC de coluna lombar", "TC de face e seios paranasais",
      "TC de órbitas", "TC de mastoides",
      "TC de pelve", "TC de membros",
    ],
  },
  {
    grupo: "Ressonância Magnética (RM)",
    exames: [
      "RM de crânio sem contraste",
      "RM de crânio com contraste",
      "RM de coluna cervical",
      "RM de coluna torácica",
      "RM de coluna lombar",
      "RM de joelho", "RM de ombro", "RM de quadril",
      "RM de abdome", "RM de pelve",
    ],
  },
  {
    grupo: "Cardiologia / Vascular",
    exames: [
      "Eletrocardiograma (ECG) — 12 derivações",
      "Ecocardiograma transtorácico",
      "Ecocardiograma transesofágico",
      "Holter 24h", "MAPA 24h",
      "Teste ergométrico (esforço)",
      "Angiografia / Arteriografia",
      "Angiotomografia de aorta",
    ],
  },
  {
    grupo: "Endoscopia / Outros",
    exames: [
      "Endoscopia digestiva alta (EDA)",
      "Colonoscopia",
      "Broncoscopia",
      "Eletroencefalograma (EEG)",
      "Eletromiografia (EMG)",
      "Espirometria",
      "Mapeamento de retina",
    ],
  },
];

export interface Medicamento {
  nome: string;
  apresentacoes: string[];
  vias: string[];
}

export const VIAS_ADMINISTRACAO = [
  "VO", "EV", "IM", "SC", "SL", "SNG", "SNE",
  "Inalatória", "Tópica", "Retal", "Ocular", "Auricular", "Nasal", "Transdérmica",
] as const;

export type ViaAdministracao = typeof VIAS_ADMINISTRACAO[number];

export const FREQUENCIAS = [
  { value: "1x/dia",         label: "1x ao dia"         },
  { value: "2x/dia",         label: "2x ao dia (12/12h)" },
  { value: "3x/dia",         label: "3x ao dia (8/8h)"   },
  { value: "4x/dia",         label: "4x ao dia (6/6h)"   },
  { value: "6x/dia",         label: "6x ao dia (4/4h)"   },
  { value: "SOS",            label: "SOS / Se necessário" },
  { value: "Dose única",     label: "Dose única"          },
  { value: "Contínuo",       label: "Infusão contínua"    },
  { value: "ACM",            label: "A critério médico"   },
] as const;

export const FREQ_CURATIVOS = [
  { value: "1x/dia",  label: "1x ao dia"  },
  { value: "2x/dia",  label: "2x ao dia"  },
  { value: "SOS",     label: "SOS / Se necessário" },
  { value: "48/48h",  label: "48/48h"     },
  { value: "72/72h",  label: "72/72h"     },
] as const;

export const FREQ_VITAIS = [
  { value: "1/1h",   label: "1/1h (contínuo)"  },
  { value: "2/2h",   label: "2/2h"              },
  { value: "4/4h",   label: "4/4h"              },
  { value: "6/6h",   label: "6/6h"              },
  { value: "8/8h",   label: "8/8h"              },
  { value: "12/12h", label: "12/12h"            },
  { value: "1x/dia", label: "1x ao dia"         },
] as const;

export const DIETAS = [
  "Via oral livre",
  "Dieta líquida",
  "Dieta pastosa",
  "Dieta hipossódica",
  "Dieta hipoglicídica",
  "Dieta para diabéticos",
  "Dieta hipoprotéica",
  "Dieta hipocalórica",
  "Jejum",
  "Via oral zero (Nada por boca)",
  "Nutrição enteral (SNG)",
  "Nutrição parenteral total (NPT)",
  "Dieta livre",
] as const;

export const PRODUTOS_CURATIVO = [
  "SF 0,9%", "AGE", "Colagenase + Cloranfenicol", "Sulfadiazina de Prata",
  "Hidrogel", "Alginato de Cálcio", "Espuma de Poliuretano", "Carvão Ativado",
  "Papaína gel", "PVPI tópico", "Clorexidina 0,5%", "Ácidos Graxos Essenciais (AGE)",
  "Curativo com gaze + micropore", "Atadura crepe", "Outro",
] as const;

export const MEDICAMENTOS: Medicamento[] = [
  // Analgésicos / Antitérmicos
  { nome: "Dipirona (Metamizol)", apresentacoes: ["500mg", "1g", "2g"], vias: ["VO", "EV", "IM"] },
  { nome: "Paracetamol", apresentacoes: ["500mg", "750mg", "1g"], vias: ["VO", "EV", "Retal"] },
  { nome: "Ibuprofeno", apresentacoes: ["200mg", "400mg", "600mg"], vias: ["VO"] },
  { nome: "Cetoprofeno", apresentacoes: ["50mg", "100mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Ketorolaco", apresentacoes: ["10mg", "30mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Tramadol", apresentacoes: ["50mg", "100mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Codeína", apresentacoes: ["30mg", "60mg"], vias: ["VO"] },
  { nome: "Morfina", apresentacoes: ["2mg", "5mg", "10mg"], vias: ["EV", "IM", "SC"] },
  { nome: "Fentanil", apresentacoes: ["50mcg", "100mcg"], vias: ["EV", "IM", "Transdérmica"] },
  { nome: "Meperidina (Petidina)", apresentacoes: ["50mg", "100mg"], vias: ["EV", "IM", "SC"] },

  // Antiemético / GI
  { nome: "Ondansetrona", apresentacoes: ["4mg", "8mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Metoclopramida", apresentacoes: ["10mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Bromoprida", apresentacoes: ["10mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Domperidona", apresentacoes: ["10mg"], vias: ["VO"] },
  { nome: "Omeprazol", apresentacoes: ["20mg", "40mg"], vias: ["VO", "EV"] },
  { nome: "Pantoprazol", apresentacoes: ["40mg"], vias: ["VO", "EV"] },
  { nome: "Ranitidina", apresentacoes: ["150mg", "300mg"], vias: ["VO", "EV"] },
  { nome: "Hioscina (Escopolamina)", apresentacoes: ["10mg", "20mg"], vias: ["VO", "EV", "IM"] },

  // Antibióticos
  { nome: "Amoxicilina", apresentacoes: ["500mg", "875mg"], vias: ["VO"] },
  { nome: "Amoxicilina + Clavulanato", apresentacoes: ["875mg+125mg"], vias: ["VO", "EV"] },
  { nome: "Ampicilina-Sulbactam", apresentacoes: ["1,5g", "3g"], vias: ["EV", "IM"] },
  { nome: "Azitromicina", apresentacoes: ["500mg"], vias: ["VO", "EV"] },
  { nome: "Claritromicina", apresentacoes: ["250mg", "500mg"], vias: ["VO", "EV"] },
  { nome: "Ciprofloxacino", apresentacoes: ["500mg", "200mg", "400mg"], vias: ["VO", "EV"] },
  { nome: "Levofloxacino", apresentacoes: ["500mg", "750mg"], vias: ["VO", "EV"] },
  { nome: "Ceftriaxona", apresentacoes: ["1g", "2g"], vias: ["EV", "IM"] },
  { nome: "Cefazolina", apresentacoes: ["1g", "2g"], vias: ["EV", "IM"] },
  { nome: "Cefepima", apresentacoes: ["1g", "2g"], vias: ["EV"] },
  { nome: "Oxacilina", apresentacoes: ["500mg", "1g"], vias: ["EV"] },
  { nome: "Benzilpenicilina Potássica", apresentacoes: ["5.000.000 UI", "10.000.000 UI"], vias: ["EV"] },
  { nome: "Benzilpenicilina Benzatina", apresentacoes: ["600.000 UI", "1.200.000 UI", "2.400.000 UI"], vias: ["IM"] },
  { nome: "Metronidazol", apresentacoes: ["250mg", "400mg", "500mg"], vias: ["VO", "EV"] },
  { nome: "Clindamicina", apresentacoes: ["300mg", "600mg", "900mg"], vias: ["VO", "EV"] },
  { nome: "Gentamicina", apresentacoes: ["80mg", "160mg", "240mg"], vias: ["EV", "IM"] },
  { nome: "Amicacina", apresentacoes: ["500mg"], vias: ["EV", "IM"] },
  { nome: "Vancomicina", apresentacoes: ["500mg", "1g"], vias: ["EV"] },
  { nome: "Meropeném", apresentacoes: ["500mg", "1g"], vias: ["EV"] },
  { nome: "Imipeném-Cilastatina", apresentacoes: ["500mg"], vias: ["EV"] },
  { nome: "Piperacilina + Tazobactam", apresentacoes: ["4,5g"], vias: ["EV"] },
  { nome: "Sulfametoxazol + Trimetoprima", apresentacoes: ["400mg+80mg", "800mg+160mg"], vias: ["VO", "EV"] },
  { nome: "Doxiciclina", apresentacoes: ["100mg"], vias: ["VO", "EV"] },
  { nome: "Aciclovir", apresentacoes: ["200mg", "400mg", "800mg", "250mg"], vias: ["VO", "EV"] },
  { nome: "Oseltamivir", apresentacoes: ["75mg"], vias: ["VO"] },
  { nome: "Fluconazol", apresentacoes: ["150mg", "200mg"], vias: ["VO", "EV"] },

  // Cardiovascular
  { nome: "AAS (Ácido Acetilsalicílico)", apresentacoes: ["100mg", "300mg"], vias: ["VO"] },
  { nome: "Clopidogrel", apresentacoes: ["75mg", "300mg"], vias: ["VO"] },
  { nome: "Atenolol", apresentacoes: ["25mg", "50mg", "100mg"], vias: ["VO"] },
  { nome: "Metoprolol", apresentacoes: ["25mg", "50mg", "100mg"], vias: ["VO", "EV"] },
  { nome: "Carvedilol", apresentacoes: ["6,25mg", "12,5mg", "25mg"], vias: ["VO"] },
  { nome: "Captopril", apresentacoes: ["12,5mg", "25mg", "50mg"], vias: ["VO"] },
  { nome: "Enalapril", apresentacoes: ["5mg", "10mg", "20mg"], vias: ["VO", "EV"] },
  { nome: "Losartana", apresentacoes: ["50mg", "100mg"], vias: ["VO"] },
  { nome: "Amlodipino", apresentacoes: ["5mg", "10mg"], vias: ["VO"] },
  { nome: "Nifedipino", apresentacoes: ["10mg", "30mg"], vias: ["VO"] },
  { nome: "Verapamil", apresentacoes: ["80mg", "240mg"], vias: ["VO", "EV"] },
  { nome: "Hidralazina", apresentacoes: ["25mg", "50mg", "20mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Nitroprussiato de Sódio", apresentacoes: ["50mg"], vias: ["EV"] },
  { nome: "Nitroglicerina", apresentacoes: ["5mg", "25mg"], vias: ["EV", "Transdérmica", "SL"] },
  { nome: "Furosemida", apresentacoes: ["20mg", "40mg", "80mg"], vias: ["VO", "EV"] },
  { nome: "Espironolactona", apresentacoes: ["25mg", "50mg", "100mg"], vias: ["VO"] },
  { nome: "Digoxina", apresentacoes: ["0,25mg"], vias: ["VO", "EV"] },
  { nome: "Amiodarona", apresentacoes: ["100mg", "200mg", "150mg"], vias: ["VO", "EV"] },
  { nome: "Adenosina", apresentacoes: ["6mg", "12mg"], vias: ["EV"] },
  { nome: "Atropina", apresentacoes: ["0,25mg", "0,5mg", "1mg"], vias: ["EV", "IM"] },
  { nome: "Dopamina", apresentacoes: ["200mg", "400mg"], vias: ["EV"] },
  { nome: "Dobutamina", apresentacoes: ["250mg"], vias: ["EV"] },
  { nome: "Norepinefrina (Noradrenalina)", apresentacoes: ["4mg", "8mg"], vias: ["EV"] },
  { nome: "Epinefrina (Adrenalina)", apresentacoes: ["0,1mg", "1mg"], vias: ["EV", "IM"] },
  { nome: "Vasopressina", apresentacoes: ["20 UI"], vias: ["EV"] },
  { nome: "Enoxaparina", apresentacoes: ["20mg", "40mg", "60mg", "80mg", "100mg"], vias: ["SC"] },
  { nome: "Heparina não-fracionada", apresentacoes: ["5.000 UI", "25.000 UI"], vias: ["EV", "SC"] },
  { nome: "Varfarina", apresentacoes: ["1mg", "2,5mg", "5mg"], vias: ["VO"] },

  // Corticosteroides
  { nome: "Dexametasona", apresentacoes: ["2mg", "4mg", "8mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Hidrocortisona", apresentacoes: ["100mg", "200mg", "500mg"], vias: ["EV", "IM"] },
  { nome: "Metilprednisolona", apresentacoes: ["40mg", "125mg", "500mg", "1g"], vias: ["EV", "IM"] },
  { nome: "Prednisolona", apresentacoes: ["5mg", "20mg", "40mg"], vias: ["VO"] },
  { nome: "Prednisona", apresentacoes: ["5mg", "20mg"], vias: ["VO"] },
  { nome: "Betametasona", apresentacoes: ["0,1mg", "4mg"], vias: ["VO", "IM"] },

  // Respiratório / Broncodilatadores
  { nome: "Salbutamol (Albuterol)", apresentacoes: ["2,5mg/2,5mL", "5mg/2,5mL", "5mg"], vias: ["Inalatória", "EV", "VO"] },
  { nome: "Fenoterol", apresentacoes: ["2,5mg/2,5mL", "5mg/2,5mL"], vias: ["Inalatória"] },
  { nome: "Brometo de Ipratrópio", apresentacoes: ["0,25mg/2mL", "0,5mg/2mL"], vias: ["Inalatória"] },
  { nome: "Aminofilina", apresentacoes: ["240mg", "480mg"], vias: ["EV"] },
  { nome: "Budesonida", apresentacoes: ["0,25mg/2mL", "0,5mg/2mL"], vias: ["Inalatória"] },
  { nome: "Salmeterol + Fluticasona", apresentacoes: ["25/250mcg", "50/500mcg"], vias: ["Inalatória"] },

  // SNC / Psiquiátrico / Anestesia
  { nome: "Diazepam", apresentacoes: ["5mg", "10mg"], vias: ["VO", "EV", "IM", "Retal"] },
  { nome: "Lorazepam", apresentacoes: ["1mg", "2mg", "4mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Midazolam", apresentacoes: ["5mg", "15mg"], vias: ["EV", "IM", "Nasal"] },
  { nome: "Clonazepam", apresentacoes: ["0,5mg", "1mg", "2mg"], vias: ["VO", "EV"] },
  { nome: "Fenobarbital", apresentacoes: ["100mg", "200mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Fenitoína", apresentacoes: ["100mg", "250mg"], vias: ["VO", "EV"] },
  { nome: "Valproato de Sódio", apresentacoes: ["250mg", "500mg", "300mg/3mL"], vias: ["VO", "EV"] },
  { nome: "Levetiracetam", apresentacoes: ["250mg", "500mg", "1000mg"], vias: ["VO", "EV"] },
  { nome: "Carbamazepina", apresentacoes: ["200mg", "400mg"], vias: ["VO"] },
  { nome: "Haloperidol", apresentacoes: ["1mg", "5mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Risperidona", apresentacoes: ["1mg", "2mg", "3mg"], vias: ["VO"] },
  { nome: "Olanzapina", apresentacoes: ["5mg", "10mg"], vias: ["VO", "IM"] },
  { nome: "Quetiapina", apresentacoes: ["25mg", "100mg", "200mg"], vias: ["VO"] },
  { nome: "Prometazina", apresentacoes: ["25mg", "50mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Ketamina", apresentacoes: ["50mg", "100mg", "200mg", "500mg"], vias: ["EV", "IM"] },
  { nome: "Propofol", apresentacoes: ["200mg", "500mg"], vias: ["EV"] },
  { nome: "Etomidato", apresentacoes: ["20mg"], vias: ["EV"] },
  { nome: "Succinilcolina", apresentacoes: ["100mg", "200mg"], vias: ["EV", "IM"] },
  { nome: "Rocurônio", apresentacoes: ["50mg"], vias: ["EV"] },
  { nome: "Lidocaína", apresentacoes: ["2%", "5%", "200mg"], vias: ["EV", "Tópica"] },

  // Antídotos / Emergência
  { nome: "Naloxona", apresentacoes: ["0,4mg", "2mg"], vias: ["EV", "IM", "Nasal"] },
  { nome: "Flumazenil", apresentacoes: ["0,5mg", "1mg"], vias: ["EV"] },
  { nome: "N-Acetilcisteína", apresentacoes: ["200mg", "600mg", "2g"], vias: ["VO", "EV"] },
  { nome: "Ácido Tranexâmico", apresentacoes: ["500mg", "1g"], vias: ["EV"] },
  { nome: "Fitomenadiona (Vitamina K)", apresentacoes: ["1mg", "10mg"], vias: ["VO", "EV", "SC", "IM"] },
  { nome: "Gluconato de Cálcio 10%", apresentacoes: ["1g/10mL"], vias: ["EV"] },
  { nome: "Bicarbonato de Sódio 8,4%", apresentacoes: ["84mEq/100mL"], vias: ["EV"] },
  { nome: "Cloreto de Potássio (KCl 19,1%)", apresentacoes: ["25mEq/20mL"], vias: ["EV"] },
  { nome: "Sulfato de Magnésio", apresentacoes: ["1g/2mL", "2g/10mL", "10g/50mL"], vias: ["EV", "IM"] },
  { nome: "Glicose 50%", apresentacoes: ["25g/50mL"], vias: ["EV"] },
  { nome: "Glicose 25%", apresentacoes: ["25g/100mL"], vias: ["EV"] },

  // Soluções EV
  { nome: "SF 0,9% (Soro Fisiológico)", apresentacoes: ["100mL", "250mL", "500mL", "1000mL"], vias: ["EV"] },
  { nome: "SG 5% (Soro Glicosado)", apresentacoes: ["250mL", "500mL"], vias: ["EV"] },
  { nome: "Ringer Lactato", apresentacoes: ["500mL", "1000mL"], vias: ["EV"] },
  { nome: "Albumina Humana 20%", apresentacoes: ["20g/100mL"], vias: ["EV"] },

  // Endócrino / Metabólico
  { nome: "Insulina Regular (Humana)", apresentacoes: ["100 UI/mL"], vias: ["SC", "EV"] },
  { nome: "Insulina NPH (Humana)", apresentacoes: ["100 UI/mL"], vias: ["SC"] },
  { nome: "Insulina Glargina", apresentacoes: ["100 UI/mL"], vias: ["SC"] },
  { nome: "Metformina", apresentacoes: ["500mg", "850mg", "1g"], vias: ["VO"] },
  { nome: "Glibenclamida", apresentacoes: ["5mg"], vias: ["VO"] },
  { nome: "Levotiroxina", apresentacoes: ["25mcg", "50mcg", "100mcg"], vias: ["VO"] },

  // Antihistamínico / Alergia
  { nome: "Dexclorfeniramina", apresentacoes: ["2mg", "5mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Loratadina", apresentacoes: ["10mg"], vias: ["VO"] },
  { nome: "Cetirizina", apresentacoes: ["10mg"], vias: ["VO"] },
  { nome: "Fexofenadina", apresentacoes: ["60mg", "120mg", "180mg"], vias: ["VO"] },

  // Outros
  { nome: "Tiamina (Vitamina B1)", apresentacoes: ["100mg", "300mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Piridoxina (Vitamina B6)", apresentacoes: ["40mg", "100mg"], vias: ["VO", "EV", "IM"] },
  { nome: "Ácido Fólico", apresentacoes: ["0,4mg", "5mg"], vias: ["VO"] },
  { nome: "Sulfato Ferroso", apresentacoes: ["40mg", "200mg"], vias: ["VO"] },
  { nome: "Dimeticona", apresentacoes: ["40mg", "75mg"], vias: ["VO"] },
  { nome: "Lactulose", apresentacoes: ["667mg/mL"], vias: ["VO"] },
  { nome: "Bisacodil", apresentacoes: ["5mg", "10mg"], vias: ["VO", "Retal"] },
  { nome: "Diosmectita", apresentacoes: ["3g"], vias: ["VO"] },
  { nome: "Simeticona", apresentacoes: ["80mg", "125mg"], vias: ["VO"] },
  { nome: "Zinco (Sulfato)", apresentacoes: ["70mg", "220mg"], vias: ["VO"] },
];

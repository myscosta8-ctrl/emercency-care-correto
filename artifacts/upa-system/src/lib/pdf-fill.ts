import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, PDFName } from "pdf-lib";
import { SINAN_AGRAVOS, agravoToTemplate } from "./sinan-agravos";

// ── types ─────────────────────────────────────────────────────────────────────

export interface PdfPatient {
  full_name: string;
  birthDate?: string | null;
  age?: number | null;
  sex?: string | null;
  race?: string | null;           // raca_cor: "Branca"|"Preta"|"Amarela"|"Parda"|"Indígena"|"Ignorada"
  motherName?: string | null;
  cns?: string | null;
  cpf?: string | null;
  rg?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Single-string address (legacy / API model). Used as fallback when split fields are absent. */
  address?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  addressState?: string | null;
  zipCode?: string | null;
  weight?: number | null;
  height?: number | null;
  symptoms?: string | null;
  symptomOnsetDate?: string | null;
  triageStatus?: string | null;   // "red"|"orange"|"yellow"|"green"|"blue"
  attendanceDate?: string | null;
  attendanceTime?: string | null;
  healthUnit?: string | null;
  responsibleProfessional?: string | null;
  // ── SINAN notification + investigation
  agravo?: string | null;
  dataNotificacao?: string | null;
  municipioNotificacao?: string | null;
  codigoIbge?: string | null;
  evolucaoCaso?: string | null;
  classificacaoFinal?: string | null;
  criterioConfirmacao?: string | null;
}

export interface PdfNotification {
  disease?: string | null;
  classification?: string | null;
  agravoCode?: string | null;
  dataNotificacao?: string | null;
  dataInicioSintomas?: string | null;
  logradouro?: string | null;
  numeroEndereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipioResidencia?: string | null;
  ufResidencia?: string | null;
  cep?: string | null;
  formData?: string | null;
}

interface TextPos { x: number; y: number; maxWidth?: number; }
type FormCoords = Record<string, TextPos>;

// ── template resolver ─────────────────────────────────────────────────────────

function templatePath(type: string): string {
  const MAP: Record<string, string> = {
    dengue:        "pdf-templates/dengue.pdf",
    covid19:       "pdf-templates/covid19.pdf",
    tuberculose:   "pdf-templates/tuberculose.pdf",
    meningite:     "pdf-templates/meningite.pdf",
    febre_amarela: "pdf-templates/febre-amarela.pdf",
    febre_tifoide: "pdf-templates/febre-tifoide.pdf",
    exantematica:  "pdf-templates/exantematica.pdf",
    srag:          "pdf-templates/srag.pdf",
    aids_adulto:   "pdf-templates/aids-adulto.pdf",
    violencia:     "pdf-templates/notificacao-individual.pdf",
    outros:        "pdf-templates/notificacao-individual.pdf",
  };
  return MAP[type] ?? "pdf-templates/notificacao-individual.pdf";
}

// ── coordinate maps ───────────────────────────────────────────────────────────
// All coordinates are in pdf-lib space: origin bottom-left of A4 (595×842 pt).
// "fill y" = label_y − 14  (8 pt Helvetica sits ~14 pt below label baseline).
//
// Source legend:
//  [D]  extract-pdf-coords, direct text-stream parse  — highest confidence
//  [F]  extract-formax-coords (Formax CTM 0.06×scale)  — verified
//  [O]  offset-derived from [D]/[F] anchor using SINAN consistent spacing
//  [R]  raster-image PDF: no text layer; notificacao-individual used as proxy
//       (fine-tune COVID19_Y_OFFSET if needed after visual check)

// ─── DENGUE ──────────────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=842, fill_y = 842−label_y−14):
//   agravo label py=176.2,x=69.8 → fill(652,70); data_notif boxes py=191.8 → fill(650,455)
//   municipio_notif label py=205.3,x=98.4 → fill(623,100); ibge py=204.6,x=489.6 → fill(623,491)
//   unidade_saude label py=234.8,x=69.1 → fill(593,70); data_inicio boxes py=248.2 → fill(594,455)
//   nome label py=263.6,x=62.4 → fill(564,62); data_nasc boxes py=279.4 → fill(563,460)
//   idade/sexo label py=292.9 → fill(535,65/163); raca_cor label py=291.7,x=459.1 → fill(536,460)
//   cns/mae label py=353.6/354.3 → fill(474,68/244)
//   municipio_res label py=385.0,x=93.1 → fill(443,95); bairro py=410.0 → fill(418,67)
//   logradouro py=410.7,x=204.5 → fill(417,206); numero/complemento py=434.2 → fill(394,67/122)
//   cep label py=462.3,x=468.5 → fill(366,470); telefone py=485.1 → fill(343,68)
//   Conclusão PAGE 2: classificacao py=177.0 → fill_p2(651,70); criterio py=183.2 → fill_p2(645,315)
const COORDS_DENGUE: FormCoords = {
  nome_paciente:        { x: 62,  y: 564, maxWidth: 386 },
  data_nascimento:      { x: 460, y: 563, maxWidth: 110 },  // date boxes py=279.4 → 842-279.4=562.6
  idade:                { x: 65,  y: 535, maxWidth: 88  },
  sexo:                 { x: 163, y: 535, maxWidth: 88  },
  raca_cor:             { x: 460, y: 536, maxWidth: 120 },  // label py=291.7,x=459.1 → fill(536,460)
  cpf:                  { x: 68,  y: 504, maxWidth: 160 },
  rg:                   { x: 248, y: 504, maxWidth: 150 },
  cns:                  { x: 68,  y: 474, maxWidth: 170 },
  nome_mae:             { x: 244, y: 474, maxWidth: 290 },  // label x=242.6
  cidade:               { x: 95,  y: 443, maxWidth: 220 },  // label x=93.1
  uf:                   { x: 430, y: 443, maxWidth: 30  },
  bairro:               { x: 67,  y: 418, maxWidth: 130 },  // label x=65.3
  endereco_rua:         { x: 206, y: 417, maxWidth: 200 },  // label x=204.5
  endereco_numero:      { x: 67,  y: 394, maxWidth: 50  },  // label x=65.8
  endereco_complemento: { x: 122, y: 394, maxWidth: 110 },  // label x=119.8
  cep:                  { x: 470, y: 366, maxWidth: 100 },  // label x=468.5
  telefone:             { x: 68,  y: 343, maxWidth: 140 },  // label x=66.5
  email:                { x: 222, y: 343, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 594, maxWidth: 100 },  // date boxes py=248.2 → 842-248.2=593.8; x right-col
  classificacao_risco:  { x: 68,  y: 290, maxWidth: 200 },
  unidade_saude:           { x: 70,  y: 593, maxWidth: 290 },  // label py=234.8,x=69.1 → fill(593,70)
  data_atendimento:        { x: 455, y: 580, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 580, maxWidth: 60  },
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 70,  y: 652, maxWidth: 290 },  // label py=176.2,x=69.8
  data_notificacao:        { x: 455, y: 650, maxWidth: 100 },  // boxes py=191.8 → 650; label "Data da Notificação" x=451.7
  municipio_notificacao:   { x: 100, y: 623, maxWidth: 280 },  // label py=205.3,x=98.4
  codigo_ibge:             { x: 491, y: 623, maxWidth: 90  },  // label py=204.6,x=489.6
  evolucao_caso:           { x: 68,  y: 270, maxWidth: 200 },  // page-1 fallback (see COORDS2_DENGUE for p2)
  classificacao_final:     { x: 68,  y: 235, maxWidth: 250 },
  criterio_confirmacao:    { x: 280, y: 235, maxWidth: 150 },
};

// ─── TUBERCULOSE ─────────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=842, fill_y = 842−label_y−14):
//   agravo label py=123.9,x=64.6 → fill(704,65); data_notif boxes py=134.7 → pdflib(707,455)
//   municipio_notif label py=152.0,x=95.3 → fill(676,96); ibge py=152.0,x=475.7 → fill(676,477)
//   unidade_saude label py=181.5,x=66.2 → fill(647,67); data_inicio boxes py=195.0 → pdflib(647,455)
//   nome label py=209.6,x=67.0 → fill(618,68); data_nasc boxes py=225.4 → pdflib(617,460)
//   idade/sexo label py=238.9 → fill(589,67/163); raca_cor label py=237.9,x=455.0 → fill(590,456)
//   cns/mae label py=299.8/300.6 → fill(528,70/240)
//   municipio_res label py=330.6,x=93.8 → fill(497,95); bairro py=355.3 → fill(473,67)
//   logradouro py=356.0,x=205.2 → fill(472,206); numero/complemento py=379.5/379.8 → fill(448,67/122)
//   cep label py=407.6,x=463.7 → fill(420,465); telefone py=430.4,x=67.4 → fill(398,68)
//   Single-page form — conclusion fields stay on page 1 (bottom area)
const COORDS_TUBERCULOSE: FormCoords = {
  nome_paciente:        { x: 68,  y: 618, maxWidth: 375 },  // label py=209.6
  data_nascimento:      { x: 460, y: 617, maxWidth: 110 },  // boxes py=225.4 → 842-225.4=616.6
  idade:                { x: 67,  y: 589, maxWidth: 88  },  // label py=238.9
  sexo:                 { x: 163, y: 589, maxWidth: 88  },  // label py=238.9,x=161.8
  raca_cor:             { x: 456, y: 590, maxWidth: 120 },  // label py=237.9,x=455.0 → fill(590,456)
  cpf:                  { x: 68,  y: 559, maxWidth: 160 },
  rg:                   { x: 248, y: 559, maxWidth: 150 },
  cns:                  { x: 70,  y: 528, maxWidth: 162 },  // label py=299.8,x=69.4
  nome_mae:             { x: 240, y: 527, maxWidth: 295 },  // label py=300.6,x=238.6
  cidade:               { x: 95,  y: 497, maxWidth: 220 },  // label py=330.6,x=93.8
  uf:                   { x: 426, y: 497, maxWidth: 30  },
  bairro:               { x: 67,  y: 473, maxWidth: 130 },  // label py=355.3,x=66.0
  endereco_rua:         { x: 206, y: 472, maxWidth: 200 },  // label py=356.0,x=205.2
  endereco_numero:      { x: 67,  y: 448, maxWidth: 50  },  // label py=379.8,x=66.5
  endereco_complemento: { x: 122, y: 448, maxWidth: 110 },  // label py=379.5,x=120.5
  cep:                  { x: 465, y: 420, maxWidth: 100 },  // label py=407.6,x=463.7
  telefone:             { x: 68,  y: 398, maxWidth: 140 },  // label py=430.4,x=67.4
  email:                { x: 223, y: 398, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 647, maxWidth: 100 },  // boxes py=195.0 → 842-195=647; same row as unidade_saude
  classificacao_risco:  { x: 68,  y: 360, maxWidth: 200 },
  unidade_saude:           { x: 67,  y: 647, maxWidth: 280 },  // label py=181.5,x=66.2 → fill(647,67)
  data_atendimento:        { x: 455, y: 634, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 634, maxWidth: 60  },
  profissional_responsavel:{ x: 67,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 65,  y: 704, maxWidth: 290 },  // label py=123.9,x=64.6
  data_notificacao:        { x: 455, y: 707, maxWidth: 100 },  // boxes py=134.7 → pdflib 707; label x=444.2
  municipio_notificacao:   { x: 96,  y: 676, maxWidth: 280 },  // label py=152.0,x=95.3
  codigo_ibge:             { x: 477, y: 676, maxWidth: 90  },  // label py=152.0,x=475.7
  evolucao_caso:           { x: 67,  y: 325, maxWidth: 200 },  // bottom of single-page form
  classificacao_final:     { x: 67,  y: 290, maxWidth: 250 },
  criterio_confirmacao:    { x: 280, y: 290, maxWidth: 150 },
};

// ─── FEBRE-AMARELA ───────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=842, fill_y = 842−label_y−14):
//   agravo label py=135.0,x=63.8 → fill(693,65); data_notif boxes py=150.6 → pdflib(691,455)
//   municipio_notif label py=166.4,x=93.8 → fill(662,95); ibge py=165.4,x=484.3 → fill(663,485)
//   unidade_saude label py=195.9,x=64.6 → fill(632,65); data_inicio boxes py=209.4 → pdflib(633,455)
//   nome label py=223.8,x=65.3 → fill(604,66); data_nasc boxes py=239.8 → pdflib(602,460)
//   idade/sexo label py=253.0 → fill(575,65/162); raca_cor label py=252.1,x=459.1 → fill(576,460)
//   cns/mae label py=314.0/314.7 → fill(514,68/244)
//   municipio_res label py=344.7,x=92.4 → fill(483,94); bairro py=369.4 → fill(459,65)
//   logradouro py=370.2,x=203.8 → fill(458,205); numero/complemento py=393.9/393.7 → fill(434,66/120)
//   cep label py=421.8,x=467.5 → fill(406,469); telefone py=444.6,x=65.8 → fill(383,67)
const COORDS_FEBRE_AMARELA: FormCoords = {
  nome_paciente:        { x: 66,  y: 604, maxWidth: 382 },  // label py=223.8,x=65.3
  data_nascimento:      { x: 460, y: 602, maxWidth: 110 },  // boxes py=239.8 → 842-239.8=602.2
  idade:                { x: 65,  y: 575, maxWidth: 88  },  // label py=253.0
  sexo:                 { x: 162, y: 575, maxWidth: 88  },  // label py=253.0,x=160.3
  raca_cor:             { x: 460, y: 576, maxWidth: 120 },  // label py=252.1,x=459.1 → fill(576,460)
  cpf:                  { x: 68,  y: 545, maxWidth: 160 },
  rg:                   { x: 248, y: 545, maxWidth: 150 },
  cns:                  { x: 68,  y: 514, maxWidth: 168 },  // label py=314.0,x=67.9
  nome_mae:             { x: 244, y: 513, maxWidth: 292 },  // label py=314.7,x=242.6
  cidade:               { x: 94,  y: 483, maxWidth: 220 },  // label py=344.7,x=92.4
  uf:                   { x: 426, y: 483, maxWidth: 30  },
  bairro:               { x: 65,  y: 459, maxWidth: 132 },  // label py=369.4,x=64.3
  endereco_rua:         { x: 205, y: 458, maxWidth: 200 },  // label py=370.2,x=203.8
  endereco_numero:      { x: 66,  y: 434, maxWidth: 50  },  // label py=393.9,x=65.0
  endereco_complemento: { x: 120, y: 434, maxWidth: 110 },  // label py=393.7,x=118.8
  cep:                  { x: 469, y: 406, maxWidth: 100 },  // label py=421.8,x=467.5
  telefone:             { x: 67,  y: 383, maxWidth: 140 },  // label py=444.6,x=65.8
  email:                { x: 220, y: 383, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 633, maxWidth: 100 },  // boxes py=209.4 → 842-209.4=632.6; same row as unidade_saude
  classificacao_risco:  { x: 66,  y: 345, maxWidth: 200 },
  unidade_saude:           { x: 65,  y: 632, maxWidth: 290 },  // label py=195.9,x=64.6 → fill(632,65)
  data_atendimento:        { x: 455, y: 619, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 619, maxWidth: 60  },
  profissional_responsavel:{ x: 65,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 65,  y: 693, maxWidth: 290 },  // label py=135.0,x=63.8
  data_notificacao:        { x: 455, y: 691, maxWidth: 100 },  // boxes py=150.6 → pdflib 691; label x=445.4
  municipio_notificacao:   { x: 95,  y: 662, maxWidth: 280 },  // label py=166.4,x=93.8
  codigo_ibge:             { x: 485, y: 663, maxWidth: 90  },  // label py=165.4,x=484.3
  evolucao_caso:           { x: 65,  y: 310, maxWidth: 200 },  // page-1 fallback
  classificacao_final:     { x: 65,  y: 275, maxWidth: 250 },
  criterio_confirmacao:    { x: 278, y: 275, maxWidth: 150 },
};

// ─── MENINGITE ───────────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=841, fill_y = 841−label_y−14):
//   Offset from dengue: nome at py=227.2 vs dengue py=263.6 → meningite is ~36pt higher
//   agravo label py≈139.8 → fill(687,70); data_notif boxes py≈155.4 → pdflib(686,455)
//   municipio_notif label py≈168.9 → fill(658,100); ibge py≈168.2 → fill(659,491)
//   unidade_saude label py≈198.4 → fill(629,71); data_inicio boxes py≈211.8 → pdflib(629,455)
//   nome label py=227.2,x=62.0 → fill(600,62); data_nasc boxes py≈243.0 → pdflib(598,460)
//   idade/sexo label py≈256.5 → fill(571,70/166); raca_cor label py≈255.4,x=460 → fill(572,460)
//   cns label py=317.3,x=73.2 → fill(510,73); mae py=318.0,x=247.9 → fill(509,248)
//   municipio_res label py=347.9,x=96.9 → fill(479,97); bairro py=372.8,x=69.0 → fill(454,70)
//   logradouro py=373.6,x=208.2 → fill(453,209); numero/complemento py=397.2/397.1 → fill(430,70/124)
//   cep label py=425.2,x=472.2 → fill(402,473); telefone py=448.0,x=70.4 → fill(379,71)
const COORDS_MENINGITE: FormCoords = {
  nome_paciente:        { x: 62,  y: 600, maxWidth: 380 },  // label py=227.2,x=62.0
  data_nascimento:      { x: 460, y: 598, maxWidth: 110 },  // boxes py≈243.0 → 841-243=598
  idade:                { x: 70,  y: 571, maxWidth: 88  },  // label py≈256.5
  sexo:                 { x: 166, y: 571, maxWidth: 88  },
  raca_cor:             { x: 460, y: 572, maxWidth: 120 },  // label py≈255.4,x=460 → fill(572,460)
  cpf:                  { x: 68,  y: 541, maxWidth: 160 },
  rg:                   { x: 248, y: 541, maxWidth: 150 },
  cns:                  { x: 73,  y: 510, maxWidth: 168 },  // label py=317.3,x=73.2
  nome_mae:             { x: 248, y: 509, maxWidth: 292 },  // label py=318.0,x=247.9
  cidade:               { x: 97,  y: 479, maxWidth: 220 },  // label py=347.9,x=96.9
  uf:                   { x: 428, y: 479, maxWidth: 30  },
  bairro:               { x: 70,  y: 454, maxWidth: 130 },  // label py=372.8,x=69.0
  endereco_rua:         { x: 209, y: 453, maxWidth: 200 },  // label py=373.6,x=208.2
  endereco_numero:      { x: 70,  y: 430, maxWidth: 50  },  // label py=397.2,x=69.6
  endereco_complemento: { x: 124, y: 430, maxWidth: 110 },  // label py=397.1,x=123.5
  cep:                  { x: 473, y: 402, maxWidth: 100 },  // label py=425.2,x=472.2
  telefone:             { x: 71,  y: 379, maxWidth: 140 },  // label py=448.0,x=70.4
  email:                { x: 223, y: 379, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 629, maxWidth: 100 },  // boxes py≈211.8 → 841-211.8=629.2; same row as unidade
  classificacao_risco:  { x: 71,  y: 341, maxWidth: 200 },
  unidade_saude:           { x: 71,  y: 629, maxWidth: 290 },  // label py≈198.4 → fill(629,71)
  data_atendimento:        { x: 455, y: 615, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 615, maxWidth: 60  },
  profissional_responsavel:{ x: 71,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 70,  y: 687, maxWidth: 290 },  // label py≈139.8 → fill(687,70)
  data_notificacao:        { x: 455, y: 686, maxWidth: 100 },  // boxes py≈155.4 → pdflib 686; x right-col
  municipio_notificacao:   { x: 100, y: 658, maxWidth: 280 },  // label py≈168.9 → fill(658,100)
  codigo_ibge:             { x: 491, y: 659, maxWidth: 90  },  // label py≈168.2 → fill(659,491)
  evolucao_caso:           { x: 71,  y: 306, maxWidth: 200 },  // page-1 fallback
  classificacao_final:     { x: 71,  y: 271, maxWidth: 250 },
  criterio_confirmacao:    { x: 284, y: 271, maxWidth: 150 },
};

// ─── NOTIFICAÇÃO INDIVIDUAL (violência / outros) ──────────────────────────────
// [D] PyMuPDF direct measurements (page_height=841, fill_y = 841−label_y−14):
//   agravo label py=99.1,x=70.4 → fill(728,71); data_notif boxes py=115.0 → pdflib(726,455)
//   municipio_notif label py=129.1,x=97.6 → fill(698,99); ibge py=129.1,x=483.6 → fill(698,485)
//   unidade_saude label py=157.6,x=69.7 → fill(669,70); data_inicio boxes py=171.4 → pdflib(670,455)
//   nome label py=185.9,x=67.7 → fill(641,68); data_nasc boxes py=202.2 → pdflib(639,460)
//   idade/sexo label py=215.2 → fill(612,68/163); raca_cor label py=214.2,x=461.4 → fill(613,462)
//   cns label py=276.1,x=70.2 → fill(551,71); mae py=276.8,x=244.8 → fill(550,246)
//   municipio_res label py=372.8,x=92.5 → fill(454,94); bairro py=397.7,x=64.5 → fill(429,65)
//   logradouro py=398.4,x=203.8 → fill(429,205); numero/complemento py=422.0/421.9 → fill(405,66/121)
//   cep label py=450.0,x=467.7 → fill(377,469); telefone py=472.8,x=65.9 → fill(354,67)
const COORDS_NOTIF_INDIVIDUAL: FormCoords = {
  nome_paciente:        { x: 68,  y: 641, maxWidth: 380 },  // label py=185.9,x=67.7
  data_nascimento:      { x: 460, y: 639, maxWidth: 110 },  // boxes py=202.2 → 841-202.2=638.8
  idade:                { x: 68,  y: 612, maxWidth: 88  },  // label py=215.2,x=67.1
  sexo:                 { x: 163, y: 612, maxWidth: 88  },  // label py=215.2,x=162.5
  raca_cor:             { x: 462, y: 613, maxWidth: 120 },  // label py=214.2,x=461.4 → fill(613,462)
  cpf:                  { x: 68,  y: 582, maxWidth: 160 },
  rg:                   { x: 248, y: 582, maxWidth: 150 },
  cns:                  { x: 71,  y: 551, maxWidth: 168 },  // label py=276.1,x=70.2
  nome_mae:             { x: 246, y: 550, maxWidth: 292 },  // label py=276.8,x=244.8
  cidade:               { x: 94,  y: 454, maxWidth: 220 },  // label py=372.8,x=92.5
  uf:                   { x: 424, y: 454, maxWidth: 30  },
  bairro:               { x: 65,  y: 429, maxWidth: 130 },  // label py=397.7,x=64.5
  endereco_rua:         { x: 205, y: 429, maxWidth: 200 },  // label py=398.4,x=203.8
  endereco_numero:      { x: 66,  y: 405, maxWidth: 50  },  // label py=422.0,x=65.1
  endereco_complemento: { x: 121, y: 405, maxWidth: 110 },  // label py=421.9,x=119.0
  cep:                  { x: 469, y: 377, maxWidth: 100 },  // label py=450.0,x=467.7
  telefone:             { x: 67,  y: 354, maxWidth: 140 },  // label py=472.8,x=65.9
  email:                { x: 220, y: 354, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 670, maxWidth: 100 },  // boxes py=171.4 → 841-171.4=669.6; same row as unidade
  classificacao_risco:  { x: 68,  y: 316, maxWidth: 200 },
  unidade_saude:           { x: 70,  y: 669, maxWidth: 280 },  // label py=157.6,x=69.7 → fill(669,70)
  data_atendimento:        { x: 455, y: 657, maxWidth: 90  },
  hora_atendimento:        { x: 520, y: 657, maxWidth: 55  },
  profissional_responsavel:{ x: 68,  y: 290, maxWidth: 460 },
  agravo_notificacao:      { x: 71,  y: 728, maxWidth: 290 },  // label py=99.1,x=70.4
  data_notificacao:        { x: 455, y: 726, maxWidth: 100 },  // boxes py=115.0 → pdflib 726; label x=452.1
  municipio_notificacao:   { x: 99,  y: 698, maxWidth: 280 },  // label py=129.1,x=97.6
  codigo_ibge:             { x: 485, y: 698, maxWidth: 90  },  // label py=129.1,x=483.6
  evolucao_caso:           { x: 68,  y: 281, maxWidth: 200 },  // page-1 fallback
  classificacao_final:     { x: 68,  y: 246, maxWidth: 250 },
  criterio_confirmacao:    { x: 281, y: 246, maxWidth: 150 },
};

// ─── FEBRE TIFOIDE ───────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=841, fill_y = 841−label_y−14):
//   agravo label py=148.9,x=64.5 → fill(678,65); data_notif boxes py=164.9 → pdflib(676,455)
//   municipio_notif label py=180.2,x=94.6 → fill(647,96); ibge py=179.3,x=485.9 → fill(648,487)
//   unidade_saude label py=209.6,x=65.4 → fill(617,66); data_inicio boxes py=223.4 → pdflib(618,455)
//   nome label py=237.7,x=66.2 → fill(589,67); data_nasc boxes py=254.0 → pdflib(587,460)
//   idade/sexo label py=266.9 → fill(560,67/162); raca_cor label py=265.9,x=459.9 → fill(561,461)
//   cns label py=327.8,x=68.7 → fill(499,69); mae py=328.6,x=243.3 → fill(498,244)
//   municipio_res label py=360.7,x=93.9 → fill(466,95); bairro py=385.6,x=66.0 → fill(441,67)
//   logradouro py=386.3,x=205.2 → fill(441,206); numero/complemento py=409.9/409.8 → fill(417,68/122)
//   cep label py=437.9,x=469.2 → fill(389,471); telefone py=460.7,x=67.4 → fill(366,69)
const COORDS_FEBRE_TIFOIDE: FormCoords = {
  nome_paciente:        { x: 67,  y: 589, maxWidth: 382 },  // label py=237.7,x=66.2
  data_nascimento:      { x: 460, y: 587, maxWidth: 110 },  // boxes py=254.0 → 841-254.0=587
  idade:                { x: 67,  y: 560, maxWidth: 88  },  // label py=266.9,x=65.6
  sexo:                 { x: 162, y: 560, maxWidth: 88  },  // label py=266.9,x=161.0
  raca_cor:             { x: 461, y: 561, maxWidth: 120 },  // label py=265.9,x=459.9 → fill(561,461)
  cpf:                  { x: 68,  y: 530, maxWidth: 160 },
  rg:                   { x: 248, y: 530, maxWidth: 150 },
  cns:                  { x: 69,  y: 499, maxWidth: 168 },  // label py=327.8,x=68.7
  nome_mae:             { x: 244, y: 498, maxWidth: 292 },  // label py=328.6,x=243.3
  cidade:               { x: 95,  y: 466, maxWidth: 220 },  // label py=360.7,x=93.9
  uf:                   { x: 428, y: 466, maxWidth: 30  },
  bairro:               { x: 67,  y: 441, maxWidth: 130 },  // label py=385.6,x=66.0
  endereco_rua:         { x: 206, y: 441, maxWidth: 200 },  // label py=386.3,x=205.2
  endereco_numero:      { x: 68,  y: 417, maxWidth: 50  },  // label py=409.9,x=66.6
  endereco_complemento: { x: 122, y: 417, maxWidth: 110 },  // label py=409.8,x=120.4
  cep:                  { x: 471, y: 389, maxWidth: 100 },  // label py=437.9,x=469.2
  telefone:             { x: 69,  y: 366, maxWidth: 140 },  // label py=460.7,x=67.4
  email:                { x: 223, y: 366, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 618, maxWidth: 100 },  // boxes py=223.4 → 841-223.4=617.6; same row as unidade
  classificacao_risco:  { x: 67,  y: 328, maxWidth: 200 },
  unidade_saude:           { x: 66,  y: 617, maxWidth: 290 },  // label py=209.6,x=65.4 → fill(617,66)
  data_atendimento:        { x: 455, y: 604, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 604, maxWidth: 60  },
  profissional_responsavel:{ x: 66,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 65,  y: 678, maxWidth: 290 },  // label py=148.9,x=64.5
  data_notificacao:        { x: 455, y: 676, maxWidth: 100 },  // boxes py=164.9 → pdflib 676; label x=446.1
  municipio_notificacao:   { x: 96,  y: 647, maxWidth: 280 },  // label py=180.2,x=94.6
  codigo_ibge:             { x: 487, y: 648, maxWidth: 90  },  // label py=179.3,x=485.9
  evolucao_caso:           { x: 66,  y: 293, maxWidth: 200 },  // page-1 fallback
  classificacao_final:     { x: 66,  y: 258, maxWidth: 250 },
  criterio_confirmacao:    { x: 279, y: 258, maxWidth: 150 },
};

// ─── AIDS ADULTO ─────────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=841, fill_y = 841−label_y−14):
//   agravo label py=147.5,x=68.2 → fill(680,69); data_notif boxes py=163.4 → pdflib(678,455)
//   municipio_notif label py=176.5,x=96.6 → fill(651,98); ibge py=175.5,x=488.1 → fill(652,489)
//   unidade_saude label py=205.9,x=67.5 → fill(621,68); data_inicio boxes py=219.7 → pdflib(621,455)
//   nome label py=233.9,x=68.2 → fill(593,69); data_nasc boxes py=250.3 → pdflib(591,460)
//   idade/sexo label py=263.2 → fill(564,68/164); raca_cor label py=262.2,x=461.9 → fill(565,463)
//   cns label py=324.1,x=70.7 → fill(503,71); mae py=324.8,x=245.4 → fill(502,246)
//   municipio_res label py=356.9,x=95.4 → fill(470,96); bairro py=381.8,x=67.5 → fill(445,68)
//   logradouro py=382.6,x=206.7 → fill(444,208); numero/complemento py=406.2/406.1 → fill(421,69/123)
//   cep label py=434.2,x=470.7 → fill(393,472); telefone py=457.0,x=68.9 → fill(370,70)
const COORDS_AIDS_ADULTO: FormCoords = {
  nome_paciente:        { x: 69,  y: 593, maxWidth: 380 },  // label py=233.9,x=68.2
  data_nascimento:      { x: 460, y: 591, maxWidth: 110 },  // boxes py=250.3 → 841-250.3=590.7
  idade:                { x: 68,  y: 564, maxWidth: 88  },  // label py=263.2,x=67.6
  sexo:                 { x: 164, y: 564, maxWidth: 88  },  // label py=263.2,x=163.1
  raca_cor:             { x: 463, y: 565, maxWidth: 120 },  // label py=262.2,x=461.9 → fill(565,463)
  cpf:                  { x: 68,  y: 534, maxWidth: 160 },
  rg:                   { x: 248, y: 534, maxWidth: 150 },
  cns:                  { x: 71,  y: 503, maxWidth: 165 },  // label py=324.1,x=70.7
  nome_mae:             { x: 246, y: 502, maxWidth: 290 },  // label py=324.8,x=245.4
  cidade:               { x: 96,  y: 470, maxWidth: 220 },  // label py=356.9,x=95.4
  uf:                   { x: 395, y: 470, maxWidth: 30  },  // between municipio and IBGE (label x=329.9)
  bairro:               { x: 68,  y: 445, maxWidth: 130 },  // label py=381.8,x=67.5
  endereco_rua:         { x: 208, y: 444, maxWidth: 200 },  // label py=382.6,x=206.7
  endereco_numero:      { x: 69,  y: 421, maxWidth: 50  },  // label py=406.2,x=68.1
  endereco_complemento: { x: 123, y: 421, maxWidth: 110 },  // label py=406.1,x=122.0
  cep:                  { x: 472, y: 393, maxWidth: 100 },  // label py=434.2,x=470.7
  telefone:             { x: 70,  y: 370, maxWidth: 140 },  // label py=457.0,x=68.9
  email:                { x: 223, y: 370, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 621, maxWidth: 100 },  // boxes py=219.7 → 841-219.7=621.3; same row as unidade
  classificacao_risco:  { x: 69,  y: 332, maxWidth: 200 },
  unidade_saude:           { x: 68,  y: 621, maxWidth: 290 },  // label py=205.9,x=67.5 → fill(621,68)
  data_atendimento:        { x: 455, y: 607, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 607, maxWidth: 60  },
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 69,  y: 680, maxWidth: 290 },  // label py=147.5,x=68.2
  data_notificacao:        { x: 455, y: 678, maxWidth: 100 },  // boxes py=163.4 → pdflib 678; label x=449.8
  municipio_notificacao:   { x: 98,  y: 651, maxWidth: 280 },  // label py=176.5,x=96.6
  codigo_ibge:             { x: 489, y: 652, maxWidth: 90  },  // label py=175.5,x=488.1
  evolucao_caso:           { x: 68,  y: 297, maxWidth: 200 },  // page-1 fallback
  classificacao_final:     { x: 68,  y: 262, maxWidth: 250 },
  criterio_confirmacao:    { x: 281, y: 262, maxWidth: 150 },
};

// ─── EXANTEMATICA ────────────────────────────────────────────────────────────
// [D] PyMuPDF direct measurements (page_height=842):
//   Exantematica is ~13.3pt lower than dengue (label py offset +13.3 vs dengue).
//   agravo label py≈189.5 → fill(639,67); data_notif boxes py≈205.1 → pdflib(637,455)
//   municipio_notif label py≈218.6 → fill(609,100); ibge py≈217.9 → fill(610,491)
//   unidade_saude label py≈248.1 → fill(580,67); data_inicio boxes py≈261.5 → pdflib(581,455)
//   nome label py≈276.9,x=67 → fill(551,67); data_nasc boxes py≈292.7 → pdflib(549,460)
//   idade/sexo label py=306.2 → fill(522,66/162); raca_cor label py=305.2,x=460.5 → fill(523,461)
//   cns label py=367.1,x=69.3 → fill(461,70); mae py=367.8,x=243.9 → fill(460,244)
//   municipio_res label py=399.1,x=93.6 → fill(429,95); bairro py=424.1,x=65.7 → fill(404,67)
//   logradouro py=424.8,x=204.9 → fill(403,206); numero/complemento py=448.4/448.3 → fill(380,67/121)
//   cep label py=476.3,x=468.9 → fill(352,470); telefone py=499.1,x=67.1 → fill(329,68)
const COORDS_EXANTEMATICA: FormCoords = {
  nome_paciente:        { x: 67,  y: 551, maxWidth: 380 },  // label py≈276.9
  data_nascimento:      { x: 460, y: 549, maxWidth: 110 },  // boxes py≈292.7 → 842-292.7=549.3
  idade:                { x: 66,  y: 522, maxWidth: 88  },  // label py=306.2
  sexo:                 { x: 162, y: 522, maxWidth: 88  },  // label py=306.2,x=161.6
  raca_cor:             { x: 461, y: 523, maxWidth: 120 },  // label py=305.2,x=460.5 → fill(523,461)
  cpf:                  { x: 68,  y: 491, maxWidth: 160 },
  rg:                   { x: 248, y: 491, maxWidth: 150 },
  cns:                  { x: 70,  y: 461, maxWidth: 168 },  // label py=367.1,x=69.3
  nome_mae:             { x: 244, y: 460, maxWidth: 292 },  // label py=367.8,x=243.9
  cidade:               { x: 95,  y: 429, maxWidth: 220 },  // label py=399.1,x=93.6
  uf:                   { x: 425, y: 429, maxWidth: 30  },
  bairro:               { x: 67,  y: 404, maxWidth: 130 },  // label py=424.1,x=65.7
  endereco_rua:         { x: 206, y: 403, maxWidth: 200 },  // label py=424.8,x=204.9
  endereco_numero:      { x: 67,  y: 380, maxWidth: 50  },  // label py=448.4,x=66.3
  endereco_complemento: { x: 121, y: 380, maxWidth: 110 },  // label py=448.3,x=120.2
  cep:                  { x: 470, y: 352, maxWidth: 100 },  // label py=476.3,x=468.9
  telefone:             { x: 68,  y: 329, maxWidth: 140 },  // label py=499.1,x=67.1
  email:                { x: 221, y: 329, maxWidth: 200 },
  data_inicio_sintomas: { x: 455, y: 581, maxWidth: 100 },  // boxes py≈261.5 → 842-261.5=580.5; same row as unidade
  classificacao_risco:  { x: 67,  y: 290, maxWidth: 200 },
  unidade_saude:           { x: 67,  y: 580, maxWidth: 290 },  // label py≈248.1 → fill(580,67)
  data_atendimento:        { x: 455, y: 567, maxWidth: 100 },
  hora_atendimento:        { x: 520, y: 567, maxWidth: 60  },
  profissional_responsavel:{ x: 67,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 67,  y: 639, maxWidth: 290 },  // label py≈189.5 → fill(639,67)
  data_notificacao:        { x: 455, y: 637, maxWidth: 100 },  // boxes py≈205.1 → pdflib 637; x right-col
  municipio_notificacao:   { x: 100, y: 609, maxWidth: 280 },  // label py≈218.6 → fill(609,100)
  codigo_ibge:             { x: 491, y: 610, maxWidth: 90  },  // label py≈217.9 → fill(610,491)
  evolucao_caso:           { x: 67,  y: 255, maxWidth: 200 },  // page-1 fallback
  classificacao_final:     { x: 67,  y: 220, maxWidth: 250 },
  criterio_confirmacao:    { x: 280, y: 220, maxWidth: 150 },
};

// ─── COVID-19 / SRAG ─────────────────────────────────────────────────────────
// [R] covid19.pdf and srag.pdf are raster-image PDFs (no text layer).
//     The SINAN COVID-19 form shares the same "Notificação Individual"
//     patient-identification layout. COORDS_NOTIF_INDIVIDUAL is the proxy.
//     To calibrate visually, set COVID19_Y_OFFSET (+ = up, − = down).
const COVID19_Y_OFFSET = 0;
const COORDS_COVID19 = COVID19_Y_OFFSET === 0
  ? COORDS_NOTIF_INDIVIDUAL
  : (Object.fromEntries(
      Object.entries(COORDS_NOTIF_INDIVIDUAL).map(([k, v]) => [k, { ...v, y: v.y + COVID19_Y_OFFSET }])
    ) as FormCoords);

// ── coordinate registry ───────────────────────────────────────────────────────

const COORDS: Record<string, FormCoords> = {
  dengue:        COORDS_DENGUE,
  covid19:       COORDS_COVID19,
  srag:          COORDS_COVID19,         // same raster-image proxy
  tuberculose:   COORDS_TUBERCULOSE,
  meningite:     COORDS_MENINGITE,
  febre_amarela: COORDS_FEBRE_AMARELA,
  febre_tifoide: COORDS_FEBRE_TIFOIDE,
  exantematica:  COORDS_EXANTEMATICA,
  aids_adulto:   COORDS_AIDS_ADULTO,
  violencia:     COORDS_NOTIF_INDIVIDUAL,
  outros:        COORDS_NOTIF_INDIVIDUAL,
};

// ── PAGE 2 — Conclusão / Encerramento coords ──────────────────────────────────
// For multi-page SINAN forms the "Conclusão" section is on page 2.
// These coordinates are measured on the DENGUE page 2 (ph=842) and shared
// across dengue / meningite / febre_amarela / exantematica / febre_tifoide /
// aids_adulto / notificacao_individual (all share the same standard p2 layout).
// tuberculose is single-page — no entry here; its p1 conclusion coords are used.
// fill_y = 842 − pymupdf_label_y − 14
//   "Classificação Final" label py=177.0,x=69.6 → fill(651,70)
//   "Critério de Confirmação" label row py=183.2,x=314.2 → fill(645,315)
//   "Evolução do Caso" label py=219.0,x=67.9; text area just below at py=229 → fill(599,175)
const COORDS2_CONCLUSION: FormCoords = {
  classificacao_final:  { x: 70,  y: 651, maxWidth: 230 },
  criterio_confirmacao: { x: 315, y: 645, maxWidth: 200 },
  evolucao_caso:        { x: 175, y: 599, maxWidth: 350 },
};

const COORDS2: Record<string, FormCoords> = {
  dengue:        COORDS2_CONCLUSION,
  meningite:     COORDS2_CONCLUSION,
  febre_amarela: COORDS2_CONCLUSION,
  febre_tifoide: COORDS2_CONCLUSION,
  exantematica:  COORDS2_CONCLUSION,
  aids_adulto:   COORDS2_CONCLUSION,
  violencia:     COORDS2_CONCLUSION,
  outros:        COORDS2_CONCLUSION,
  // covid19 / srag / tuberculose intentionally omitted — single-page or diff layout
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s?: string | null): string {
  if (!s) return "";
  const parts = s.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

function sexLabel(sex?: string | null): string {
  if (sex === "M") return "M - Masculino";
  if (sex === "F") return "F - Feminino";
  return "I - Ignorado";
}

function riskLabel(status?: string | null): string {
  if (status === "red")    return "Vermelho — Emergência";
  if (status === "orange") return "Laranja — Muito Urgente";
  if (status === "yellow") return "Amarelo — Urgente";
  if (status === "green")  return "Verde — Pouco Urgente";
  if (status === "blue")   return "Azul — Não Urgente";
  return "";
}

// ── field value map ───────────────────────────────────────────────────────────
// Keys use the 14 standardized field names shared by BOTH systems (overlay + AcroForm):
//   nome_paciente  nome_mae     data_nascimento  cpf
//   rg             cns          endereco_rua     endereco_numero
//   endereco_complemento  bairro  cidade         uf   cep   peso
//
// cpf / rg / peso have no coord boxes on SINAN forms — draw() silently skips
// them (pos is undefined); AcroForm fill loop catches the missing-field error.
// They ARE rendered on the Ficha de Identificação, which has all 14 fields.
//
// 3 SINAN-context keys (coord boxes exist on SINAN forms; not on Ficha ID):
//   idade  sexo  telefone

function buildFieldValues(patient: PdfPatient, notif?: PdfNotification): Record<string, string> {
  // parse any extra disease-specific fields stored in formData
  let formExtra: Record<string, string> = {};
  if (notif?.formData) {
    try { formExtra = JSON.parse(notif.formData); } catch { /* ignore */ }
  }

  // helper: use notification override first, then patient fallback
  const addr = (notifVal: string | null | undefined, patientVal: string | null | undefined) =>
    (notifVal && notifVal.trim()) ? notifVal : (patientVal ?? "");

  // agravo label: prefer structured code label, then patient.agravo, then disease text
  const agravoLabel = notif?.agravoCode
    ? (AGRAVO_LABELS[notif.agravoCode] ?? notif.agravoCode)
    : (patient.agravo ?? notif?.disease ?? "");

  return {
    // ── 14 standard patient fields ────────────────────────────────────────
    nome_paciente:        patient.full_name,
    nome_mae:             patient.motherName     ?? "",
    data_nascimento:      fmtDate(patient.birthDate),
    cpf:                  patient.cpf            ?? "",
    rg:                   patient.rg             ?? "",
    cns:                  patient.cns            ?? "",
    // address: use notification overrides if provided, fallback to split patient fields,
    // then to the single patient.address string (legacy/API model)
    endereco_rua:         addr(notif?.logradouro,          patient.street)          || patient.address || "",
    endereco_numero:      addr(notif?.numeroEndereco,      patient.addressNumber),
    endereco_complemento: addr(notif?.complemento,         patient.addressComplement),
    bairro:               addr(notif?.bairro,              patient.neighborhood),
    cidade:               addr(notif?.municipioResidencia, patient.city),
    uf:                   addr(notif?.ufResidencia,        patient.addressState),
    cep:                  addr(notif?.cep,                 patient.zipCode),
    peso:                 patient.weight != null ? `${patient.weight}` : "",
    altura:               patient.height ? `${patient.height} cm` : "",
    // ── SINAN-context fields
    raca_cor:             patient.race           ?? "",
    idade:                patient.age ? `${patient.age} anos` : "",
    sexo:                 sexLabel(patient.sex),
    telefone:             patient.phone          ?? "",
    email:                patient.email          ?? "",
    // ── clinical fields
    data_inicio_sintomas: fmtDate(notif?.dataInicioSintomas ?? patient.symptomOnsetDate),
    sintomas:             patient.symptoms       ?? "",
    classificacao_risco:  riskLabel(patient.triageStatus),
    // ── atendimento fields — formData overrides patient defaults
    unidade_saude:            formExtra.unidade_saude            || patient.healthUnit              || "",
    data_atendimento:         fmtDate(patient.attendanceDate),
    hora_atendimento:         patient.attendanceTime           ?? "",
    profissional_responsavel: formExtra.profissional_responsavel || patient.responsibleProfessional || "",
    // ── SINAN notification header — formData overrides patient defaults
    agravo_notificacao:    agravoLabel,
    data_notificacao:      fmtDate(notif?.dataNotificacao ?? patient.dataNotificacao),
    municipio_notificacao: formExtra.municipio_notificacao || patient.municipioNotificacao || "",
    codigo_ibge:           formExtra.codigo_ibge           || patient.codigoIbge            || "",
    // ── SINAN investigation/conclusion — formData overrides patient defaults
    evolucao_caso:        formExtra.evolucao || patient.evolucaoCaso || "",
    classificacao_final:  notif?.classification ?? patient.classificacaoFinal ?? "",
    criterio_confirmacao: formExtra.criterio_confirmacao || patient.criterioConfirmacao || "",
    // ── extra disease-specific fields from formData (non-overriding keys)
    ...Object.fromEntries(
      Object.entries(formExtra)
        .filter(([k]) => !["unidade_saude","profissional_responsavel","municipio_notificacao","codigo_ibge","evolucao","criterio_confirmacao"].includes(k))
        .map(([k, v]) => [k, String(v ?? "")])
    ),
  };
}

// ── Disease-specific clinical field filler ────────────────────────────────────
// Draws checkbox marks and text values for investigation/clinical sections that
// are unique to each SINAN disease template. Coordinates verified via
// pdftotext -bbox + python row-grouping against each PDF template.
//
// Convention:
//   mark(x, y)        → draws "X" (bold, 7.5 pt) at position — used for checkboxes
//   write(x, y, text) → draws text value (regular, 7.5 pt) clipped to maxW
//
// Checkbox x = label_x − 12  (label_x from pdftotext bbox xMin)
// Confirmed coords:
//   DENGUE   sinais row1 y=260-266, row2 y=245-250; hosp-opts y=783; classif y=648/639; evo y=621
//   TB       entrada y=361/352; forma y=302/293; bacil y=229/220; HIV y=228/219; assoc y=257/244
//   F.AMAR   vacinado-opts y=235; hosp-opts y=127
//   F.TIF    atendimento-opts y=100
//   MENING   classif codes y=527-473; evo-opts y=352/343
//   EXANT    classif y=488-471; evo-opts y=327/318
//   AIDS     evo-opts y=437

function fillClinical(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  type: string,
  fd: Record<string, string>,
  ink: ReturnType<typeof rgb>,
): void {
  const SZ = 7.5;

  function mark(x: number, y: number) {
    page.drawText("X", { x, y, font: bold, size: SZ, color: ink });
  }

  function write(x: number, y: number, text: string, maxW = 200) {
    if (!text?.trim()) return;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t, SZ) > maxW) t = t.slice(0, -1);
    page.drawText(t, { x, y, font, size: SZ, color: ink });
  }

  const sinais = new Set((fd.sinais ?? "").split(",").filter(Boolean));

  // ── DENGUE ─────────────────────────────────────────────────────────────────
  if (type === "dengue") {
    // Sinais e Sintomas — row 1 (y≈260-266): labels at x=71,115,174,317,404,486
    if (sinais.has("febre"))      mark(59,  260);
    if (sinais.has("cefaleia"))   mark(103, 262);
    if (sinais.has("vomito"))     mark(162, 260);
    if (sinais.has("artrite"))    mark(305, 262);
    if (sinais.has("petequias"))  mark(392, 264);
    if (sinais.has("prova_laco")) mark(474, 266);
    // row 2 (y≈245-250): labels at x=70,115,173,314,402,486
    if (sinais.has("mialgia"))    mark(58,  247);
    if (sinais.has("exantema"))   mark(103, 247);
    if (sinais.has("nauseas"))    mark(161, 247);
    if (sinais.has("artralgia"))  mark(302, 248);
    if (sinais.has("leucopenia")) mark(390, 250);
    if (sinais.has("dor_retro"))  mark(474, 245);

    // Hospitalização (50) — options at y=783: "1"@60 "2"@90 "9"@119
    if      (fd.internacao === "sim")      mark(55,  783);
    else if (fd.internacao === "nao")      mark(85,  783);
    else if (fd.internacao === "ignorado") mark(114, 783);

    // Classificação Final (63) — y=648: "5-"@58 "10-"@113 "11-"@160; y=639: "12-"@58 "13-"@127
    const fc = (fd.forma_clinica ?? "").toLowerCase();
    if      (fc === "1" || fc === "dengue")         mark(108, 648); // 10-Dengue
    else if (fc === "2" || fc.includes("alarme"))   mark(155, 648); // 11-Dengue c/ Sinais de Alarme
    else if (fc === "3" || fc.includes("grave"))    mark(53,  639); // 12-Dengue Grave
    else if (fc === "4" || fc.includes("chik"))     mark(122, 639); // 13-Chikungunya
    else if (fc === "5" || fc.includes("descart"))  mark(53,  648); // 5-Descartado

    // Evolução do Caso (65) — label at y=621; write value after it
    if (fd.evolucao) write(168, 621, fd.evolucao, 130);
  }

  // ── TUBERCULOSE ────────────────────────────────────────────────────────────
  if (type === "tuberculose") {
    // Tipo de Entrada (32) — y=361: "1"@222 "2"@288 "3"@346 "4"@473; y=352: "5-Transf"@222 "6"@278
    const entMap: Record<string, [number, number]> = {
      caso_novo:     [210, 361],
      recidiva:      [276, 361],
      reingresso:    [334, 361],
      nao_sabe:      [461, 361],
      transferencia: [210, 352],
      pos_obito:     [266, 352],
    };
    if (fd.tipo_entrada && entMap[fd.tipo_entrada]) {
      const [ex, ey] = entMap[fd.tipo_entrada];
      mark(ex, ey);
    }

    // Forma (35) — y=302: "1"@94 "2"@147; y=293: "3"@94
    if      (fd.forma === "pulmonar")                   mark(82,  302);
    else if (fd.forma === "extrapulmonar")               mark(135, 302);
    else if (fd.forma === "pulmonar_extrapulmonar")      mark(82,  293);

    // Doenças e Agravos Associados (37)
    // Row 1 headers at y=271 → Sim boxes at y=257 (same row as "1-Sim" legend x=57)
    if (fd.aids          === "sim") mark(205, 257);
    if (fd.alcoolismo    === "sim") mark(249, 257);
    if (fd.diabetes      === "sim") mark(320, 257);
    if (fd.doenca_mental === "sim") mark(384, 257);
    // Row 2 headers at y=255 → Sim boxes at y=244
    if (fd.drogas        === "sim") mark(205, 244);
    if (fd.tabagismo     === "sim") mark(341, 244);

    // Baciloscopia de Escarro (38) — y=229: "1"@62 "2"@109; y=220: "3"@62 "4"@130
    const bacilMap: Record<string, [number, number]> = {
      positiva:      [50,  229],
      negativa:      [97,  229],
      nao_realizada: [50,  220],
      nao_aplica:    [118, 220],
    };
    if (fd.baciloscopia && bacilMap[fd.baciloscopia]) {
      const [bx, by] = bacilMap[fd.baciloscopia];
      mark(bx, by);
    }

    // HIV (40) — y=228: "1-Positivo"@415 "3-Em Andamento"@463; y=219: "2-Negativo"@415
    const hivMap: Record<string, [number, number]> = {
      positivo:      [412, 228],
      negativo:      [412, 219],
      andamento:     [460, 228],
      nao_realizado: [460, 219],
    };
    if (fd.hiv && hivMap[fd.hiv]) {
      const [hx, hy] = hivMap[fd.hiv];
      mark(hx, hy);
    }

    // Evolução — write after label (existing coord from COORDS_TUBERCULOSE)
    if (fd.evolucao) write(160, 325, fd.evolucao, 150);
  }

  // ── FEBRE AMARELA ──────────────────────────────────────────────────────────
  if (type === "febre_amarela") {
    // Vacinado (34) — options at y=235: "1-Sim"@203 "2-Não"@241 "9-Ignorado"@279
    if      (fd.vacinado === "sim")       mark(200, 235);
    else if (fd.vacinado === "nao")       mark(238, 235);
    else if (fd.vacinado === "ignorado")  mark(276, 235);

    // Hospitalização (40) — options at y=127: "1-Sim"@165 "2-Não"@194 "9-Ignorado"@224
    if      (fd.hospitalizacao === "sim")       mark(162, 127);
    else if (fd.hospitalizacao === "nao")       mark(191, 127);
    else if (fd.hospitalizacao === "ignorado")  mark(221, 127);

    // Evolução — write at footer area (bottom of form, after lab data)
    if (fd.evolucao) write(160, 84, fd.evolucao, 160);
  }

  // ── FEBRE TIFÓIDE ──────────────────────────────────────────────────────────
  if (type === "febre_tifoide") {
    // Tipo de Atendimento (39) — y=100: "1-Hospitalar"@69 "2-Ambulatorial"@134
    //   "3-Domiciliar"@197 "4-Nenhum"@259 "9-Ignorado"@314
    const atenMap: Record<string, number> = {
      hospitalar: 57, ambulatorial: 122, domiciliar: 185, nenhum: 247, ignorado: 302,
    };
    const atenOpt = fd.tipo_atendimento;
    if (atenOpt && atenMap[atenOpt] !== undefined) mark(atenMap[atenOpt], 100);

    // Hospitalização — write text (no dedicated field coord extracted yet)
    if (fd.hospitalizacao === "sim") write(200, 112, "1 - Sim", 80);
    else if (fd.hospitalizacao === "nao") write(200, 112, "2 - Não", 80);

    // Evolução — write value (no dedicated coord; use generic area)
    if (fd.evolucao) write(160, 488, fd.evolucao, 160);
  }

  // ── MENINGITE ──────────────────────────────────────────────────────────────
  if (type === "meningite") {
    // Hospitalização — write text value in header area
    if      (fd.hospitalizacao === "sim")      write(220, 797, "1 - Sim", 90);
    else if (fd.hospitalizacao === "nao")      write(220, 797, "2 - Não", 90);
    else if (fd.hospitalizacao === "ignorado") write(220, 797, "9 - Ignorado", 90);

    // Classificação / Agente Etiológico (50/51)
    // Codes (mark 12pt left of label x=168 for left col, x=363 for right col):
    //   y=527: 1-Meningococemia | 6-Não especificada
    //   y=513: 2-Meningite Meningocócica | 7-Asséptica (viral)
    //   y=500: 3-MM+Meningococemia | 8-Outra etiologia
    //   y=486: 4-Meningite Tuberculosa | 9-Hemófilo
    //   y=473: 5-Outras bactérias | 10-Pneumococos
    const agenteMap: Record<string, [number, number]> = {
      meningococo:  [155, 513],
      pneumococo:   [350, 473],
      haemophilus:  [350, 486],
      listeria:     [155, 473],
      outros:       [350, 500],
      ignorado:     [350, 527],
    };
    if (fd.agente && agenteMap[fd.agente]) {
      const [ax, ay] = agenteMap[fd.agente];
      mark(ax, ay);
    }
    // tipo_meningite as supplemental text label
    if (fd.tipo_meningite && fd.tipo_meningite !== "ignorado") {
      write(68, 543, fd.tipo_meningite, 80);
    }

    // Critério de Confirmação (52) — y=452: "1-Cultura"@80 "4-Clínico"@139 "7-Clínico-epid"@218
    const criterioMening: Record<string, [number, number]> = {
      cultura:          [67, 452],
      cie:              [67, 443],
      ag_latex:         [67, 434],
      clinico:          [127, 452],
      bacterioscopia:   [127, 443],
      quimiocitologico: [127, 433],
      clinico_epid:     [205, 452],
      pcr:              [205, 434],
      outros:           [203, 408],
    };
    if (fd.criterio_mening && criterioMening[fd.criterio_mening]) {
      const [cx, cy] = criterioMening[fd.criterio_mening];
      mark(cx, cy);
    }

    // Evolução do Caso (58) — y=352: "1-Alta"@90 "2-Óbito por meningite"@185
    //                          y=343: "3-Óbito outra"@90 "9-Ignorado"@185
    const evo = (fd.evolucao ?? "").toLowerCase();
    if      (evo === "cura" || evo === "alta")   mark(87,  352);
    else if (evo.includes("menin"))              mark(182, 352);
    else if (evo.includes("obito") || evo.includes("óbito")) mark(87, 343);
    else if (evo === "ignorado")                 mark(182, 343);
    else if (fd.evolucao)                        write(120, 352, fd.evolucao, 100);
  }

  // ── EXANTEMÁTICA (Sarampo / Rubéola) ──────────────────────────────────────
  if (type === "exantematica") {
    // Hospitalização — write text (no specific coord extracted; use header area)
    if      (fd.hospitalizacao === "sim")      write(230, 799, "1 - Sim", 90);
    else if (fd.hospitalizacao === "nao")      write(230, 799, "2 - Não", 90);

    // Classificação Final (54) — y=488: "1-Sarampo"@119; y=480: "2-Rubéola"@119; y=471: "3-Descartado"@119
    const exantClass = (fd.classificacao_exant ?? "").toLowerCase();
    if      (exantClass === "sarampo"  || exantClass === "1") mark(106, 488);
    else if (exantClass === "rubeola"  || exantClass === "2") mark(106, 480);
    else if (exantClass === "descartado" || exantClass === "3") mark(106, 471);

    // Critério de Confirmação (55) — y=479: "1-Laboratorial"@236 "2-Clínico-epid"@304 "3-Clínico"@409
    const critExant: Record<string, [number, number]> = {
      laboratorial:    [223, 479],
      clinico_epid:    [291, 479],
      clinico:         [396, 479],
    };
    if (fd.criterio_exant && critExant[fd.criterio_exant]) {
      const [qx, qy] = critExant[fd.criterio_exant];
      mark(qx, qy);
    }

    // Evolução do Caso (63) — y=327: "1-Cura"@76 "2-Óbito por doenças exantemáticas"@116
    //                          y=318: "3-Óbito por outras causas"@76 "9-Ignorado"@192
    const evoEx = (fd.evolucao ?? "").toLowerCase();
    if      (evoEx === "cura")                   mark(73,  327);
    else if (evoEx.includes("exant"))            mark(113, 327);
    else if (evoEx.includes("obito") || evoEx.includes("óbito")) mark(73, 318);
    else if (evoEx === "ignorado")               mark(189, 318);
    else if (fd.evolucao)                        write(105, 327, fd.evolucao, 110);
  }

  // ── AIDS ADULTO ────────────────────────────────────────────────────────────
  if (type === "aids_adulto") {
    // Evolução do Caso (47) — y=437: "1-Vivo"@102 "2-Óbito por Aids"@142 "3-Óbito outras"@218
    const evoAids = (fd.evolucao ?? "").toLowerCase();
    if      (evoAids === "vivo" || evoAids === "cura") mark(99,  437);
    else if (evoAids.includes("aids"))                  mark(139, 437);
    else if (evoAids.includes("obito") || evoAids.includes("óbito")) mark(215, 437);
    else if (fd.evolucao)                               write(110, 437, fd.evolucao, 90);
  }

  // ── COVID-19 / SRAG (raster proxy — notificacao-individual) ────────────────
  if (type === "covid19" || type === "srag") {
    // These use the notificacao-individual proxy PDF (raster images).
    // Write key clinical values as text near the form's general area.
    if (fd.hospitalizacao === "sim") write(200, 400, "Hospitalização: Sim", 160);
    else if (fd.hospitalizacao === "nao") write(200, 400, "Hospitalização: Não", 160);
    if (fd.uti === "sim") write(200, 388, "UTI: Sim", 160);
    if (fd.evolucao) write(200, 376, `Evolução: ${fd.evolucao}`, 200);
    // List selected symptoms
    if (sinais.size > 0) {
      write(200, 364, `Sintomas: ${[...sinais].join(", ")}`, 330);
    }
  }
}

// Build agravo label map directly from the canonical SINAN_AGRAVOS list so it
// is always in sync — no need to maintain a separate static copy here.
const AGRAVO_LABELS: Record<string, string> = Object.fromEntries(
  SINAN_AGRAVOS.map(a => [a.code, a.label]),
);

// ── core fill function ────────────────────────────────────────────────────────
// Strategy:
//   1. Fill AcroForm fields (if present) — enables manual editing in
//      Adobe Reader / browser PDF viewer before printing.
//   2. Draw text overlay at the same coordinates — fallback for viewers that
//      ignore form data, and so the printed copy always looks correct.
//   3. Save with updateFieldAppearances() so filled AcroForm values are
//      visible immediately without the viewer needing to re-render them.

async function fillTemplate(
  templateBytes: ArrayBuffer,
  patient: PdfPatient,
  type: string,
  notif?: PdfNotification,
): Promise<Uint8Array> {
  const doc    = await PDFDocument.load(templateBytes);
  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const INK    = rgb(0, 0, 0);
  const SIZE   = 8;
  const coords  = COORDS[type] ?? COORDS_NOTIF_INDIVIDUAL;
  const coords2 = COORDS2[type] ?? null;          // page-2 conclusion coords (null for single-page forms)
  const pages  = doc.getPages();
  const page   = pages[0];
  const page2  = pages.length > 1 ? pages[1] : null;

  const values = buildFieldValues(patient, notif);

  // ── 1. Erase blue AcroForm highlights with white rectangles, then flatten ──
  // AcroForm widget annotations carry colored backgrounds that persist even
  // after flatten() in some viewers. Strategy:
  //   a) Draw a white filled rectangle over every widget's bounding box — this
  //      permanently covers any colored background on the rendered page stream.
  //   b) Flatten afterwards so widget appearances are merged into page content.
  //      The white rectangles are drawn BEFORE text, so text sits on top.
  const form = doc.getForm();
  try {
    for (const field of form.getFields()) {
      for (const widget of field.acroField.getWidgets()) {
        const rect = widget.getRectangle();
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        // Find which page this widget belongs to via its /P entry
        let targetPage = pages[0];
        if (pages.length > 1) {
          const pageRef = widget.dict.get(PDFName.of("P"));
          if (pageRef) {
            for (const pg of pages) {
              if (pg.ref === pageRef) { targetPage = pg; break; }
            }
          }
        }
        targetPage.drawRectangle({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });
      }
    }
    form.flatten();
  } catch { /* ignore — some templates have no form */ }

  // ── 2. Draw text overlay (fallback + raster-image PDFs) ──────────────────
  function drawOnPage(pg: typeof page, coordMap: FormCoords, key: string, useBold = false) {
    const pos   = coordMap[key];
    const value = values[key] ?? "";
    if (!pos || !value.trim()) return;
    const f = useBold ? bold : font;
    let text = value;
    if (pos.maxWidth) {
      while (text.length > 1 && f.widthOfTextAtSize(text, SIZE) > pos.maxWidth) {
        text = text.slice(0, -1);
      }
    }
    pg.drawText(text, { x: pos.x, y: pos.y, font: f, size: SIZE, color: INK });
  }

  function draw(key: string, useBold = false) {
    drawOnPage(page, coords, key, useBold);
  }

  // draw2: for conclusion fields — writes to page 2 (via COORDS2) when available,
  // otherwise falls back to page 1 coords (for single-page forms like tuberculose).
  function draw2(key: string) {
    if (page2 && coords2 && coords2[key]) {
      drawOnPage(page2, coords2, key);
    } else {
      draw(key);  // page 1 fallback (tuberculose, covid19, srag)
    }
  }

  // ── 14 standard fields — draw() silently skips any key whose coord is absent
  draw("nome_paciente",        true);
  draw("nome_mae");
  draw("data_nascimento");
  draw("cpf");                   // no coord on SINAN forms → no-op; coord on Ficha ID
  draw("rg");                    // same
  draw("peso");                  // same
  draw("cns");
  draw("endereco_rua");
  draw("endereco_numero");
  draw("endereco_complemento");
  draw("bairro");
  draw("cidade");
  draw("uf");
  draw("cep");
  // ── SINAN-context fields — have coord boxes on SINAN forms; not on Ficha ID
  draw("idade");
  draw("telefone");
  draw("email");
  // ── clinical fields — have coord boxes on SINAN forms; also on Ficha ID
  draw("data_inicio_sintomas");
  draw("classificacao_risco");
  draw("altura");    // Ficha ID only; no-op on SINAN forms
  draw("sintomas");  // Ficha ID only; no-op on SINAN forms
  // ── atendimento fields — SINAN header/footer + Ficha ID
  draw("unidade_saude");
  draw("data_atendimento");
  draw("hora_atendimento");
  // profissional_responsavel omitted from SINAN overlay — y=90 on dengue/meningite
  // forms overlaps with the laboratory data section (item 43 area).
  // ── SINAN notification header
  draw("agravo_notificacao");
  draw("data_notificacao");
  draw("municipio_notificacao");
  draw("codigo_ibge");
  // ── SINAN investigation/conclusion — written to page 2 when form has one
  draw2("evolucao_caso");
  draw2("classificacao_final");
  draw2("criterio_confirmacao");

  // ── 3. Disease-specific clinical fields (checkboxes, radio marks, text) ──
  let formExtra: Record<string, string> = {};
  if (notif?.formData) {
    try { formExtra = JSON.parse(notif.formData); } catch { /* ignore */ }
  }
  fillClinical(page, font, bold, type, formExtra, INK);

  // ── 4. Standard SINAN checkbox fields (sexo, raça/cor) ────────────────────
  // These are radio-button style fields: the form already has the option labels
  // pre-printed; we only draw "X" at the position of the selected option's box.
  // x/y base comes from the coords map (measured per-template); horizontal
  // offsets below were measured from the standard Notificação Individual row.
  const XSZ = 7.5;
  function markX(x: number, y: number) {
    page.drawText("X", { x, y, font: bold, size: XSZ, color: INK });
  }

  // Field 11 — Sexo
  // Options in row: M - Masculino □  F - Feminino □  I - Ignorado □
  // COORDS["sexo"] points to the M-option box position.
  const sexPos = coords["sexo"];
  if (sexPos) {
    if      (patient.sex === "M") markX(sexPos.x,       sexPos.y);
    else if (patient.sex === "F") markX(sexPos.x + 74,  sexPos.y);
    else if (patient.sex === "I") markX(sexPos.x + 143, sexPos.y);
  }

  // Field 13 — Raça/Cor
  // Options in row: 1-Branca □  2-Preta □  3-Amarela □  4-Parda □  5-Indígena □  9-Ignorado □
  // COORDS["raca_cor"] points to the 1-Branca option box position.
  const racaPos = coords["raca_cor"];
  if (racaPos && patient.race) {
    const race = patient.race.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let rx = racaPos.x;
    if      (race.includes("branca"))               rx = racaPos.x;
    else if (race.includes("preta"))                rx = racaPos.x + 22;
    else if (race.includes("amarela"))              rx = racaPos.x + 46;
    else if (race.includes("parda"))                rx = racaPos.x + 70;
    else if (race.includes("indig") || race.includes("indí") || race.includes("indi")) rx = racaPos.x + 94;
    else if (race.includes("ignor"))                rx = racaPos.x + 118;
    markX(rx, racaPos.y);
  }

  return doc.save();
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Generates a merged SINAN PDF for all notification types and triggers a
 * browser download.
 * @param patient  Patient data
 * @param notif    Notification data
 * @param baseUrl  import.meta.env.BASE_URL (proxy prefix, trailing slash)
 */
/**
 * Generates a merged SINAN PDF for all notification types and returns it as a
 * Blob without triggering a browser download.
 */
function diseaseToType(notif: PdfNotification): string {
  // Prefer the structured agravo code — delegate to agravoToTemplate() which
  // reads directly from SINAN_AGRAVOS and covers every known agravo.
  if (notif.agravoCode) {
    return agravoToTemplate(notif.agravoCode); // returns "outros" for unknown codes
  }
  // Fallback: text matching for legacy/free-text disease strings
  const d = (notif.disease ?? "").toLowerCase();
  if (d.includes("dengue") || d.includes("chikungunya")) return "dengue";
  if (d.includes("covid") || d.includes("coronavírus"))  return "covid19";
  if (d.includes("srag"))                                return "srag";
  if (d.includes("tuberc"))                              return "tuberculose";
  if (d.includes("meningite"))                           return "meningite";
  if (d.includes("febre amarela"))                       return "febre_amarela";
  if (d.includes("febre tif"))                           return "febre_tifoide";
  if (d.includes("sarampo") || d.includes("rubéola") || d.includes("rubeola")) return "exantematica";
  if (d.includes("aids") || d.includes("hiv"))           return "aids_adulto";
  if (d.includes("violên") || d.includes("violenci"))    return "violencia";
  return "outros";
}

export async function generateSinanPdfBlob(
  patient: PdfPatient,
  notif: PdfNotification,
  baseUrl: string,
): Promise<Blob> {
  const types = [diseaseToType(notif)];

  const merged = await PDFDocument.create();

  for (const type of types) {
    const url = `${baseUrl}${templatePath(type)}`;
    let templateBytes: ArrayBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      templateBytes = await res.arrayBuffer();
    } catch { continue; }

    const filledBytes = await fillTemplate(templateBytes, patient, type, notif);
    const filled      = await PDFDocument.load(filledBytes);
    const copied      = await merged.copyPages(filled, filled.getPageIndices());
    copied.forEach(p => merged.addPage(p));
  }

  if (merged.getPageCount() === 0) {
    throw new Error("Nenhum template PDF encontrado para os tipos selecionados.");
  }

  const bytes = await merged.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function downloadSinanPdf(
  patient: PdfPatient,
  notif: PdfNotification,
  baseUrl: string,
): Promise<void> {
  const blob = await generateSinanPdfBlob(patient, notif, baseUrl);
  const href  = URL.createObjectURL(blob);
  const a     = Object.assign(document.createElement("a"), {
    href,
    download: `SINAN_${patient.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

// ── Ficha de Identificação do Paciente ────────────────────────────────────────
// Generates a patient identification card with the 14 standardized fields:
//   nome_paciente  nome_mae          data_nascimento  cpf
//   rg             cns               endereco_rua     endereco_numero
//   endereco_complemento  bairro     cidade           uf
//   cep            peso

export async function downloadIdentificacaoPdf(patient: PdfPatient): Promise<void> {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── palette ────────────────────────────────────────────────────────────────
  const NAVY    = rgb(0.06, 0.09, 0.18);
  const ACCENT  = rgb(0.15, 0.35, 0.78);
  const LBLBG   = rgb(0.93, 0.95, 0.97);
  const VALBG   = rgb(0.97, 0.97, 1.00);
  const DARK    = rgb(0.06, 0.07, 0.12);
  const MUTED   = rgb(0.42, 0.44, 0.54);
  const WHITE   = rgb(1, 1, 1);
  const BORDER  = rgb(0.80, 0.82, 0.88);
  const LTBLUE  = rgb(0.72, 0.78, 0.96);

  // ── layout (23 rows, ROW_H=24, GAP=6, STEP=30) ───────────────────────────
  const ML      = 40;
  const CW      = 515;
  const LBL_W   = 140;
  const VAL_W   = CW - LBL_W;
  const ROW_H   = 24;
  const STEP    = 30;           // ROW_H + 6 gap
  const FIRST_Y = 752;          // y-top of first row

  // ── header (y 762 → 812) ──────────────────────────────────────────────────
  const HDR_BOT = 762;
  const HDR_H   = 50;
  page.drawRectangle({ x: ML, y: HDR_BOT, width: CW,  height: HDR_H, color: NAVY   });
  page.drawRectangle({ x: ML, y: HDR_BOT, width: 5,   height: HDR_H, color: ACCENT });
  page.drawRectangle({ x: ML, y: HDR_BOT, width: CW,  height: HDR_H, borderColor: BORDER, borderWidth: 0.5 });

  page.drawText("UPA BREVES — GESTÃO DE PACIENTES", {
    x: ML + 14, y: HDR_BOT + 30, font: bold, size: 12.5, color: WHITE,
  });
  page.drawText("FICHA DE IDENTIFICAÇÃO DO PACIENTE", {
    x: ML + 14, y: HDR_BOT + 11, font, size: 8, color: LTBLUE,
  });
  const emitida = `Emitida em: ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
  page.drawText(emitida, {
    x: ML + CW - font.widthOfTextAtSize(emitida, 6.5) - 4, y: HDR_BOT + 5,
    font, size: 6.5, color: LTBLUE,
  });

  // ── 19 field definitions ──────────────────────────────────────────────────
  const fields: Array<{ key: string; label: string; value: string }> = [
    { key: "nome_paciente",        label: "NOME DO PACIENTE",         value: patient.full_name },
    { key: "nome_mae",             label: "NOME DA MÃE",              value: patient.motherName          ?? "" },
    { key: "data_nascimento",      label: "DATA DE NASCIMENTO",       value: fmtDate(patient.birthDate)  },
    { key: "cpf",                  label: "CPF",                      value: patient.cpf                 ?? "" },
    { key: "rg",                   label: "RG",                       value: patient.rg                  ?? "" },
    { key: "cns",                  label: "CNS / CARTÃO SUS",         value: patient.cns                 ?? "" },
    { key: "endereco_rua",         label: "ENDEREÇO (RUA)",           value: patient.street              ?? "" },
    { key: "endereco_numero",      label: "NÚMERO",                   value: patient.addressNumber       ?? "" },
    { key: "endereco_complemento", label: "COMPLEMENTO",              value: patient.addressComplement   ?? "" },
    { key: "bairro",               label: "BAIRRO",                   value: patient.neighborhood        ?? "" },
    { key: "cidade",               label: "MUNICÍPIO",                value: patient.city                ?? "" },
    { key: "uf",                   label: "UF",                       value: patient.addressState        ?? "" },
    { key: "cep",                  label: "CEP",                      value: patient.zipCode             ?? "" },
    { key: "peso",                 label: "PESO (kg)",                value: patient.weight   ? `${patient.weight}`  : "" },
    { key: "altura",               label: "ALTURA (cm)",              value: patient.height   ? `${patient.height}`  : "" },
    { key: "telefone",             label: "TELEFONE",                 value: patient.phone               ?? "" },
    { key: "email",                label: "E-MAIL",                   value: patient.email               ?? "" },
    { key: "data_inicio_sintomas",    label: "INÍCIO DOS SINTOMAS",    value: fmtDate(patient.symptomOnsetDate) },
    { key: "sintomas",                label: "SINTOMAS",               value: patient.symptoms                    ?? "" },
    { key: "data_atendimento",        label: "DATA DO ATENDIMENTO",    value: fmtDate(patient.attendanceDate) },
    { key: "hora_atendimento",        label: "HORA DO ATENDIMENTO",    value: patient.attendanceTime              ?? "" },
    { key: "unidade_saude",           label: "UNIDADE DE SAÚDE",       value: patient.healthUnit                  ?? "" },
    { key: "profissional_responsavel",label: "PROFISSIONAL RESP.",     value: patient.responsibleProfessional     ?? "" },
  ];

  // ── draw rows + AcroForm fields ───────────────────────────────────────────
  // Each value cell becomes a fillable text field so external code can do:
  //   form.getTextField('nome_paciente').setText(paciente.nome)
  //   form.getTextField('cpf').setText(paciente.cpf)
  //   form.getTextField('peso').setText(paciente.peso.toString())
  const form = doc.getForm();

  fields.forEach(({ key, label, value }, i) => {
    const yBot  = FIRST_Y - i * STEP - ROW_H;
    const yTop  = yBot + ROW_H;

    // ── label side ───────────────────────────────────────────────────────
    page.drawRectangle({ x: ML,         y: yBot, width: LBL_W, height: ROW_H, color: LBLBG });
    page.drawRectangle({ x: ML + LBL_W, y: yBot, width: VAL_W, height: ROW_H, color: VALBG });
    page.drawRectangle({ x: ML, y: yBot, width: CW, height: ROW_H, borderColor: BORDER, borderWidth: 0.5 });
    page.drawLine({ start: { x: ML + LBL_W, y: yBot }, end: { x: ML + LBL_W, y: yTop }, thickness: 0.5, color: BORDER });

    // field key badge
    const badgeLabel = key.replace(/_/g, " ");
    page.drawRectangle({ x: ML + 4, y: yTop - 13, width: bold.widthOfTextAtSize(badgeLabel, 5.5) + 6, height: 10, color: ACCENT });
    page.drawText(badgeLabel, { x: ML + 7, y: yTop - 12, font: bold, size: 5.5, color: WHITE });

    // display label
    page.drawText(label, { x: ML + 6, y: yBot + 8, font: bold, size: 6.5, color: MUTED });

    // ── value side: AcroForm text field ──────────────────────────────────
    // Positioned to fill the value column with 6pt horizontal padding.
    const FIELD_PAD = 6;
    const field = form.createTextField(key);
    if (value) field.setText(value);
    field.addToPage(page, {
      x:               ML + LBL_W + FIELD_PAD,
      y:               yBot + 2,
      width:           VAL_W - FIELD_PAD * 2,
      height:          ROW_H - 4,
      borderWidth:     0,
      backgroundColor: VALBG,
    });
    field.setFontSize(9.5);
    // Pre-filled values are editable so staff can correct on-screen before printing.
  });

  // ── footer ─────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y: 38 }, end: { x: ML + CW, y: 38 }, thickness: 0.4, color: BORDER });
  page.drawText(
    "UPA Breves — Prontuário Eletrônico  |  Documento gerado automaticamente pelo sistema",
    { x: ML, y: 26, font, size: 6.5, color: MUTED },
  );

  // ── save & download ────────────────────────────────────────────────────────
  const bytes = await doc.save();
  const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const href  = URL.createObjectURL(blob);
  const link  = Object.assign(document.createElement("a"), {
    href,
    download: `Identificacao_${patient.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}

// ── preencherPDF — simplified Portuguese API ──────────────────────────────────
// NOTE: Medical prescription PDFs are generated server-side via
// GET /api/patients/:id/prescriptions/:prescriptionId/pdf (see artifacts/api-server)
// Field names match the 14 standardized AcroForm field names exactly so the
// caller can use the same object to fill any template:
//
//   preencherPDF("dengue", dadosPaciente)
//   preencherPDF(["dengue", "covid19"], dadosPaciente)
//
// baseUrl defaults to "" (works for in-browser relative fetches).

export interface DadosPaciente {
  // ── 14 standard patient fields (match AcroForm field names) ────────────────
  nome_paciente:         string;
  nome_mae?:             string | null;
  data_nascimento?:      string | null;   // ISO "YYYY-MM-DD" or "DD/MM/YYYY"
  cpf?:                  string | null;
  rg?:                   string | null;
  cns?:                  string | null;
  endereco_rua?:         string | null;
  endereco_numero?:      string | null;
  endereco_complemento?: string | null;
  bairro?:               string | null;
  cidade?:               string | null;
  uf?:                   string | null;
  cep?:                  string | null;
  peso?:                 string | number | null;   // "75" | 75 | 75.5
  altura?:               string | number | null;   // "170" | 170
  // ── SINAN-context fields (have coord boxes on SINAN forms; not on Ficha ID)
  raca_cor?:             string | null;            // "Branca"|"Preta"|"Amarela"|"Parda"|"Indígena"|"Ignorada"
  idade?:                string | number | null;   // "35" | 35
  sexo?:                 string | null;            // "M" | "F" | "I"
  telefone?:             string | null;
  email?:                string | null;
  // ── clinical fields (Ficha ID + SINAN clinical section)
  sintomas?:             string | null;
  data_inicio_sintomas?: string | null;            // ISO "YYYY-MM-DD" or "DD/MM/YYYY"
  classificacao_risco?:  string | null;            // "Vermelho — Emergência" etc., or raw "red"|…
  // ── atendimento fields (SINAN header/footer + Ficha ID)
  unidade_saude?:           string | null;
  data_atendimento?:        string | null;         // ISO "YYYY-MM-DD" or "DD/MM/YYYY"
  hora_atendimento?:        string | null;         // "HH:MM"
  profissional_responsavel?: string | null;
  // ── SINAN notification header + investigation
  agravo_notificacao?:   string | null;
  data_notificacao?:     string | null;
  municipio_notificacao?: string | null;
  codigo_ibge?:          string | null;
  evolucao_caso?:        string | null;
  classificacao_final?:  string | null;
  criterio_confirmacao?: string | null;
}

function dadosParaPdfPatient(d: DadosPaciente): PdfPatient {
  // Normalise data_nascimento: if the user passes "DD/MM/YYYY" keep as-is;
  // fmtDate() inside fillTemplate handles both formats (ISO and already formatted).
  const rawDate = d.data_nascimento ?? null;
  const isoDate = rawDate && /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)
    ? rawDate.split("/").reverse().join("-")   // "DD/MM/YYYY" → "YYYY-MM-DD"
    : rawDate;

  const pesoNum   = d.peso   != null ? parseFloat(String(d.peso))   : null;
  const alturaNum = d.altura != null ? parseFloat(String(d.altura)) : null;
  const idadeNum  = d.idade  != null ? parseInt(String(d.idade), 10) : null;

  // data_inicio_sintomas: normalise to ISO
  const rawOnset = d.data_inicio_sintomas ?? null;
  const isoOnset = rawOnset && /^\d{2}\/\d{2}\/\d{4}$/.test(rawOnset)
    ? rawOnset.split("/").reverse().join("-")
    : rawOnset;

  // classificacao_risco: accept raw "red"|… or already-formatted label
  const rawRisco = d.classificacao_risco ?? null;
  const risco = rawRisco
    ? (["red","orange","yellow","green","blue"].includes(rawRisco)
        ? riskLabel(rawRisco)
        : rawRisco)
    : null;

  return {
    full_name:          d.nome_paciente,
    motherName:         d.nome_mae             ?? null,
    birthDate:          isoDate,
    cpf:                d.cpf                  ?? null,
    rg:                 d.rg                   ?? null,
    cns:                d.cns                  ?? null,
    street:             d.endereco_rua         ?? null,
    addressNumber:      d.endereco_numero      ?? null,
    addressComplement:  d.endereco_complemento ?? null,
    neighborhood:       d.bairro               ?? null,
    city:               d.cidade               ?? null,
    addressState:       d.uf                   ?? null,
    zipCode:            d.cep                  ?? null,
    weight:             Number.isFinite(pesoNum)   ? pesoNum   : null,
    height:             Number.isFinite(alturaNum)  ? alturaNum : null,
    age:                Number.isFinite(idadeNum)   ? idadeNum  : null,
    sex:                d.sexo                 ?? null,
    race:               d.raca_cor             ?? null,
    phone:              d.telefone             ?? null,
    email:              d.email                ?? null,
    symptoms:           d.sintomas             ?? null,
    symptomOnsetDate:   isoOnset,
    triageStatus:       ["red","orange","yellow","green","blue"].includes(rawRisco ?? "")
                          ? rawRisco
                          : null,              // pass raw status; buildFieldValues calls riskLabel()
    attendanceDate:          d.data_atendimento        ?? null,
    attendanceTime:          d.hora_atendimento        ?? null,
    healthUnit:              d.unidade_saude           ?? null,
    responsibleProfessional: d.profissional_responsavel ?? null,
    agravo:              d.agravo_notificacao   ?? null,
    dataNotificacao:     d.data_notificacao     ?? null,
    municipioNotificacao: d.municipio_notificacao ?? null,
    codigoIbge:          d.codigo_ibge           ?? null,
    evolucaoCaso:        d.evolucao_caso         ?? null,
    classificacaoFinal:  d.classificacao_final   ?? null,
    criterioConfirmacao: d.criterio_confirmacao  ?? null,
  };
}

/**
 * Gera e faz o download do PDF SINAN para o tipo de doença informado.
 *
 * @param tipoDoenca  Tipo de doença: string única ("dengue") ou array (["dengue","covid19"])
 * @param dadosPaciente  Dados do paciente com os nomes de campo padronizados
 * @param baseUrl  Prefixo de URL do app (padrão: "")
 *
 * @example
 * await preencherPDF("dengue", {
 *   nome_paciente: "Maria Silva",
 *   cpf: "123.456.789-00",
 *   peso: 68,
 * });
 */
export async function preencherPDF(
  tipoDoenca: string | string[],
  dadosPaciente: DadosPaciente,
  baseUrl = "",
): Promise<void> {
  const tipos = Array.isArray(tipoDoenca) ? tipoDoenca : [tipoDoenca];
  const patient = dadosParaPdfPatient(dadosPaciente);
  const notif: PdfNotification = { disease: tipos[0] ?? "outros" };
  await downloadSinanPdf(patient, notif, baseUrl);
}

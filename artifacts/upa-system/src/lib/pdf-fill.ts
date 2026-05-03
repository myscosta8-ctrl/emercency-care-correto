import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ── types ─────────────────────────────────────────────────────────────────────

export interface PdfPatient {
  nome: string;
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
  types: string;
  otherType?: string | null;
  diagnosis?: string | null;
  symptomOnsetDate?: string | null;
  notifiedAt?: string | null;
  responsible?: string | null;
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
// [D] nome label y=578→fill 564; data_nasc y=579→565; sexo/idade y=549→535
//     cns/mae y=488→474; municipio y=457→443; bairro/logradouro y=432/431→418/417
//     numero y=408→394; cep y=380→366; telefone y=357→343
//     uf: estimated right of cidade (x≈430, same y)
const COORDS_DENGUE: FormCoords = {
  nome_paciente:        { x: 62,  y: 564, maxWidth: 386 },
  data_nascimento:      { x: 459, y: 565, maxWidth: 110 },
  idade:                { x: 65,  y: 535, maxWidth: 88  },
  sexo:                 { x: 162, y: 535, maxWidth: 88  },
  raca_cor:             { x: 260, y: 535, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 504, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 504, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 68,  y: 474, maxWidth: 170 },
  nome_mae:             { x: 247, y: 474, maxWidth: 290 },
  cidade:               { x: 97,  y: 443, maxWidth: 310 },
  uf:                   { x: 430, y: 443, maxWidth: 30  },
  bairro:               { x: 68,  y: 418, maxWidth: 130 },
  endereco_rua:         { x: 208, y: 417, maxWidth: 200 },
  endereco_numero:      { x: 68,  y: 394, maxWidth: 90  },
  endereco_complemento: { x: 170, y: 394, maxWidth: 110 },
  cep:                  { x: 470, y: 366, maxWidth: 100 },
  telefone:             { x: 68,  y: 343, maxWidth: 140 },
  email:                { x: 222, y: 343, maxWidth: 200 },
  data_inicio_sintomas: { x: 68,  y: 305, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 220, y: 305, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 68,  y: 620, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 620, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 620, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 68,  y: 676, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 676, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 68,  y: 648, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 648, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 68,  y: 270, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 68,  y: 235, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 280, y: 235, maxWidth: 150 },  // [O] right of classificacao
};

// ─── TUBERCULOSE ─────────────────────────────────────────────────────────────
// [D] nome label y=632→618; data_nasc y=633→619; sexo/idade y=603→589
//     cns y=542→528; mae y=541→527; municipio y=511→497; bairro y=487→473
//     logradouro y=486→472; numero y=462→448; cep y=434→420; telefone y=412→398
//     uf: estimated right of cidade
const COORDS_TUBERCULOSE: FormCoords = {
  nome_paciente:        { x: 67,  y: 618, maxWidth: 375 },
  data_nascimento:      { x: 455, y: 619, maxWidth: 110 },
  idade:                { x: 66,  y: 589, maxWidth: 88  },
  sexo:                 { x: 165, y: 589, maxWidth: 88  },
  raca_cor:             { x: 263, y: 589, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 559, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 559, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 69,  y: 528, maxWidth: 162 },
  nome_mae:             { x: 243, y: 527, maxWidth: 295 },
  cidade:               { x: 98,  y: 497, maxWidth: 305 },
  uf:                   { x: 426, y: 497, maxWidth: 30  },
  bairro:               { x: 68,  y: 473, maxWidth: 130 },
  endereco_rua:         { x: 209, y: 472, maxWidth: 200 },
  endereco_numero:      { x: 68,  y: 448, maxWidth: 90  },
  endereco_complemento: { x: 170, y: 448, maxWidth: 110 },
  cep:                  { x: 467, y: 420, maxWidth: 100 },
  telefone:             { x: 69,  y: 398, maxWidth: 140 },
  email:                { x: 223, y: 398, maxWidth: 200 },
  data_inicio_sintomas: { x: 69,  y: 360, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 221, y: 360, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 67,  y: 674, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 674, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 674, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 67,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 67,  y: 730, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 730, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 67,  y: 702, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 702, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 67,  y: 325, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 67,  y: 290, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 280, y: 290, maxWidth: 150 },  // [O] right of classificacao
};

// ─── FEBRE-AMARELA ───────────────────────────────────────────────────────────
// [D] nome label y=618→604; data_nasc y=618→604; sexo/idade y=589→575
//     cns y=528→514; mae y=527→513; municipio y=497→483; bairro y=473→459
//     logradouro y=472→458; numero y=448→434; cep y=420→406; telefone y=397→383
//     uf: estimated right of cidade
const COORDS_FEBRE_AMARELA: FormCoords = {
  nome_paciente:        { x: 65,  y: 604, maxWidth: 382 },
  data_nascimento:      { x: 458, y: 604, maxWidth: 110 },
  idade:                { x: 65,  y: 575, maxWidth: 88  },
  sexo:                 { x: 163, y: 575, maxWidth: 88  },
  raca_cor:             { x: 261, y: 575, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 545, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 545, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 68,  y: 514, maxWidth: 168 },
  nome_mae:             { x: 243, y: 513, maxWidth: 292 },
  cidade:               { x: 95,  y: 483, maxWidth: 308 },
  uf:                   { x: 426, y: 483, maxWidth: 30  },
  bairro:               { x: 64,  y: 459, maxWidth: 132 },
  endereco_rua:         { x: 207, y: 458, maxWidth: 200 },
  endereco_numero:      { x: 66,  y: 434, maxWidth: 90  },
  endereco_complemento: { x: 168, y: 434, maxWidth: 110 },
  cep:                  { x: 468, y: 406, maxWidth: 100 },
  telefone:             { x: 66,  y: 383, maxWidth: 140 },
  email:                { x: 220, y: 383, maxWidth: 200 },
  data_inicio_sintomas: { x: 66,  y: 345, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 218, y: 345, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 65,  y: 660, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 660, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 660, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 65,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 65,  y: 716, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 716, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 65,  y: 688, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 688, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 65,  y: 310, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 65,  y: 275, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 278, y: 275, maxWidth: 150 },  // [O] right of classificacao
};

// ─── MENINGITE ───────────────────────────────────────────────────────────────
// [F] nome label pdf_y=614,x=71→fill y=600; data_nasc pdf_y=614,x=461→fill y=600
//     sexo/idade pdf_y=585→fill y=571
// [O] cns/mae/municipio/bairro/logradouro/numero/cep/telefone: consistent offsets
//     uf: estimated right of cidade
const COORDS_MENINGITE: FormCoords = {
  nome_paciente:        { x: 71,  y: 600, maxWidth: 380 },
  data_nascimento:      { x: 461, y: 600, maxWidth: 110 },
  idade:                { x: 70,  y: 571, maxWidth: 88  },
  sexo:                 { x: 166, y: 571, maxWidth: 88  },
  raca_cor:             { x: 264, y: 571, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 541, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 541, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 69,  y: 510, maxWidth: 168 },
  nome_mae:             { x: 243, y: 509, maxWidth: 292 },
  cidade:               { x: 97,  y: 479, maxWidth: 308 },
  uf:                   { x: 428, y: 479, maxWidth: 30  },
  bairro:               { x: 68,  y: 455, maxWidth: 130 },
  endereco_rua:         { x: 209, y: 454, maxWidth: 200 },
  endereco_numero:      { x: 68,  y: 430, maxWidth: 90  },
  endereco_complemento: { x: 170, y: 430, maxWidth: 110 },
  cep:                  { x: 467, y: 402, maxWidth: 100 },
  telefone:             { x: 69,  y: 379, maxWidth: 140 },
  email:                { x: 223, y: 379, maxWidth: 200 },
  data_inicio_sintomas: { x: 69,  y: 341, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 221, y: 341, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 71,  y: 656, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 656, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 656, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 71,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 71,  y: 712, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 712, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 71,  y: 684, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 684, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 71,  y: 306, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 71,  y: 271, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 284, y: 271, maxWidth: 150 },  // [O] right of classificacao
};

// ─── NOTIFICAÇÃO INDIVIDUAL (violência / outros) ──────────────────────────────
// [F] nome pdf_y=655,x=68→fill y=641; data_nasc pdf_y=655,x=458→fill y=641
//     sexo pdf_y=626,x=163→fill y=612; cns pdf_y=565,x=70→fill y=551
//     mae pdf_y=564,x=245→fill y=550; municipio pdf_y=468,x=93→fill y=454
//     bairro pdf_y=443,x=65→fill y=429; logradouro pdf_y=443,x=207→fill y=429 (same row)
//     numero pdf_y=419,x=65→fill y=405; cep pdf_y=391,x=468→fill y=377
//     telefone pdf_y=368,x=66→fill y=354
//     uf: estimated right of cidade
const COORDS_NOTIF_INDIVIDUAL: FormCoords = {
  nome_paciente:        { x: 68,  y: 641, maxWidth: 380 },
  data_nascimento:      { x: 458, y: 641, maxWidth: 110 },
  idade:                { x: 67,  y: 612, maxWidth: 88  },
  sexo:                 { x: 163, y: 612, maxWidth: 88  },
  raca_cor:             { x: 261, y: 612, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 582, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 582, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 70,  y: 551, maxWidth: 168 },
  nome_mae:             { x: 245, y: 550, maxWidth: 292 },
  cidade:               { x: 93,  y: 454, maxWidth: 308 },
  uf:                   { x: 424, y: 454, maxWidth: 30  },
  bairro:               { x: 65,  y: 429, maxWidth: 130 },
  endereco_rua:         { x: 207, y: 429, maxWidth: 200 },
  endereco_numero:      { x: 65,  y: 405, maxWidth: 90  },
  endereco_complemento: { x: 167, y: 405, maxWidth: 110 },
  cep:                  { x: 468, y: 377, maxWidth: 100 },
  telefone:             { x: 66,  y: 354, maxWidth: 140 },
  email:                { x: 220, y: 354, maxWidth: 200 },
  data_inicio_sintomas: { x: 66,  y: 316, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 218, y: 316, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 68,  y: 697, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 697, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 697, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 68,  y: 753, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 753, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 68,  y: 725, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 725, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 68,  y: 281, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 68,  y: 246, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 281, y: 246, maxWidth: 150 },  // [O] right of classificacao
};

// ─── FEBRE TIFOIDE ───────────────────────────────────────────────────────────
// [F] nome pdf_y=603,x=66→fill y=589; data_nasc pdf_y=604,x=456→fill y=590
//     cep pdf_y=403→fill y=389 (explicit); telefone pdf_y=380→fill y=366 (explicit)
// [O] sexo/idade/cns/mae/municipio/bairro/logradouro/numero: consistent offsets
//     uf: estimated right of cidade
const COORDS_FEBRE_TIFOIDE: FormCoords = {
  nome_paciente:        { x: 66,  y: 589, maxWidth: 382 },
  data_nascimento:      { x: 456, y: 590, maxWidth: 110 },
  idade:                { x: 66,  y: 560, maxWidth: 88  },
  sexo:                 { x: 165, y: 560, maxWidth: 88  },
  raca_cor:             { x: 263, y: 560, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 530, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 530, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 69,  y: 499, maxWidth: 168 },
  nome_mae:             { x: 243, y: 498, maxWidth: 292 },
  cidade:               { x: 97,  y: 468, maxWidth: 308 },
  uf:                   { x: 428, y: 468, maxWidth: 30  },
  bairro:               { x: 68,  y: 444, maxWidth: 130 },
  endereco_rua:         { x: 209, y: 443, maxWidth: 200 },
  endereco_numero:      { x: 68,  y: 419, maxWidth: 90  },
  endereco_complemento: { x: 170, y: 419, maxWidth: 110 },
  cep:                  { x: 469, y: 389, maxWidth: 100 },
  telefone:             { x: 69,  y: 366, maxWidth: 140 },
  email:                { x: 223, y: 366, maxWidth: 200 },
  data_inicio_sintomas: { x: 69,  y: 328, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 221, y: 328, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 66,  y: 645, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 645, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 645, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 66,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 66,  y: 701, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 701, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 66,  y: 673, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 673, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 66,  y: 293, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 66,  y: 258, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 279, y: 258, maxWidth: 150 },  // [O] right of classificacao
};

// ─── AIDS ADULTO ─────────────────────────────────────────────────────────────
// [F] nome pdf_y=607,x=68→fill y=593; data_nasc pdf_y=607,x=457→fill y=593
//     sexo pdf_y=578,x=163→fill y=564; cns pdf_y=517,x=71→fill y=503
//     mae pdf_y=516,x=245→fill y=502; municipio pdf_y=484,x=95→fill y=470
//     bairro pdf_y=459,x=67→fill y=445; logradouro pdf_y=458,x=207→fill y=444
//     numero pdf_y=435,x=68→fill y=421; cep pdf_y=407,x=471→fill y=393
//     telefone pdf_y=384,x=69→fill y=370
//     uf: estimated right of cidade
const COORDS_AIDS_ADULTO: FormCoords = {
  nome_paciente:        { x: 68,  y: 593, maxWidth: 380 },
  data_nascimento:      { x: 457, y: 593, maxWidth: 110 },
  idade:                { x: 65,  y: 564, maxWidth: 88  },
  sexo:                 { x: 163, y: 564, maxWidth: 88  },
  raca_cor:             { x: 261, y: 564, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 534, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 534, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 71,  y: 503, maxWidth: 165 },
  nome_mae:             { x: 245, y: 502, maxWidth: 290 },
  cidade:               { x: 95,  y: 470, maxWidth: 240 },
  uf:                   { x: 358, y: 470, maxWidth: 30  },
  bairro:               { x: 67,  y: 445, maxWidth: 130 },
  endereco_rua:         { x: 207, y: 444, maxWidth: 200 },
  endereco_numero:      { x: 68,  y: 421, maxWidth: 90  },
  endereco_complemento: { x: 170, y: 421, maxWidth: 110 },
  cep:                  { x: 471, y: 393, maxWidth: 100 },
  telefone:             { x: 69,  y: 370, maxWidth: 140 },
  email:                { x: 223, y: 370, maxWidth: 200 },
  data_inicio_sintomas: { x: 69,  y: 332, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 221, y: 332, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 68,  y: 649, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 649, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 649, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 68,  y: 705, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 705, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 68,  y: 677, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 677, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 68,  y: 297, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 68,  y: 262, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 281, y: 262, maxWidth: 150 },  // [O] right of classificacao
};

// ─── EXANTEMATICA ────────────────────────────────────────────────────────────
// [F] nome pdf_y=564,x=67→fill y=550; data_nasc pdf_y=564,x=457→fill y=550
//     sexo pdf_y=535,x=162→fill y=521; cns pdf_y=474,x=69→fill y=460
//     mae pdf_y=473,x=244→fill y=459; municipio pdf_y=442,x=94→fill y=428
//     bairro pdf_y=417,x=66→fill y=403; logradouro pdf_y=416,x=205→fill y=402
//     numero pdf_y=393,x=66→fill y=379; cep pdf_y=365,x=469→fill y=351
//     telefone pdf_y=342,x=67→fill y=328
//     uf: estimated right of cidade
const COORDS_EXANTEMATICA: FormCoords = {
  nome_paciente:        { x: 67,  y: 550, maxWidth: 380 },
  data_nascimento:      { x: 457, y: 550, maxWidth: 110 },
  idade:                { x: 65,  y: 521, maxWidth: 88  },
  sexo:                 { x: 162, y: 521, maxWidth: 88  },
  raca_cor:             { x: 260, y: 521, maxWidth: 88  },  // [O] right of sexo
  cpf:                  { x: 68,  y: 491, maxWidth: 160 },  // [O] row between sexo and cns
  rg:                   { x: 248, y: 491, maxWidth: 150 },  // [O] right of cpf
  cns:                  { x: 69,  y: 460, maxWidth: 168 },
  nome_mae:             { x: 244, y: 459, maxWidth: 292 },
  cidade:               { x: 94,  y: 428, maxWidth: 308 },
  uf:                   { x: 425, y: 428, maxWidth: 30  },
  bairro:               { x: 66,  y: 403, maxWidth: 130 },
  endereco_rua:         { x: 205, y: 402, maxWidth: 200 },
  endereco_numero:      { x: 66,  y: 379, maxWidth: 90  },
  endereco_complemento: { x: 168, y: 379, maxWidth: 110 },
  cep:                  { x: 469, y: 351, maxWidth: 100 },
  telefone:             { x: 67,  y: 328, maxWidth: 140 },
  email:                { x: 221, y: 328, maxWidth: 200 },
  data_inicio_sintomas: { x: 67,  y: 290, maxWidth: 130 },  // [O] clinical section row 1
  classificacao_risco:  { x: 219, y: 290, maxWidth: 200 },  // [O] right of data_inicio
  unidade_saude:           { x: 67,  y: 606, maxWidth: 290 },  // [O] notification header
  data_atendimento:        { x: 380, y: 606, maxWidth: 100 },  // [O] right of unidade_saude
  hora_atendimento:        { x: 490, y: 606, maxWidth: 80  },  // [O] right of data_atendimento
  profissional_responsavel:{ x: 67,  y: 90,  maxWidth: 460 },  // [O] footer notifier
  agravo_notificacao:      { x: 67,  y: 662, maxWidth: 290 },  // [O] header row: agravo
  data_notificacao:        { x: 380, y: 662, maxWidth: 100 },  // [O] right of agravo
  municipio_notificacao:   { x: 67,  y: 634, maxWidth: 280 },  // [O] header row: municipio
  codigo_ibge:             { x: 380, y: 634, maxWidth: 90  },  // [O] right of municipio
  evolucao_caso:           { x: 67,  y: 255, maxWidth: 200 },  // [O] conclusion section
  classificacao_final:     { x: 67,  y: 220, maxWidth: 250 },  // [O] below evolucao
  criterio_confirmacao:    { x: 280, y: 220, maxWidth: 150 },  // [O] right of classificacao
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

function buildFieldValues(patient: PdfPatient): Record<string, string> {
  return {
    // ── 14 standard patient fields ────────────────────────────────────────
    nome_paciente:        patient.nome,
    nome_mae:             patient.motherName     ?? "",
    data_nascimento:      fmtDate(patient.birthDate),
    cpf:                  patient.cpf            ?? "",
    rg:                   patient.rg             ?? "",
    cns:                  patient.cns            ?? "",
    endereco_rua:         patient.street         ?? "",
    endereco_numero:      patient.addressNumber  ?? "",
    endereco_complemento: patient.addressComplement ?? "",
    bairro:               patient.neighborhood   ?? "",
    cidade:               patient.city           ?? "",
    uf:                   patient.addressState   ?? "",
    cep:                  patient.zipCode        ?? "",
    peso:                 patient.weight != null ? `${patient.weight}` : "",
    altura:               patient.height ? `${patient.height} cm` : "",
    // ── SINAN-context fields (have coord boxes on SINAN forms; not on Ficha ID)
    raca_cor:             patient.race           ?? "",
    idade:                patient.age ? `${patient.age} anos` : "",
    sexo:                 sexLabel(patient.sex),
    telefone:             patient.phone          ?? "",
    email:                patient.email          ?? "",
    // ── clinical fields (coord boxes in SINAN clinical section; also on Ficha ID)
    data_inicio_sintomas: fmtDate(patient.symptomOnsetDate),
    sintomas:             patient.symptoms       ?? "",
    classificacao_risco:  riskLabel(patient.triageStatus),
    // ── atendimento fields (header + footer of SINAN forms; also on Ficha ID)
    unidade_saude:           patient.healthUnit             ?? "",
    data_atendimento:        fmtDate(patient.attendanceDate),
    hora_atendimento:        patient.attendanceTime          ?? "",
    profissional_responsavel: patient.responsibleProfessional ?? "",
    // ── SINAN notification header
    agravo_notificacao:   patient.agravo               ?? "",
    data_notificacao:     fmtDate(patient.dataNotificacao),
    municipio_notificacao: patient.municipioNotificacao ?? "",
    codigo_ibge:          patient.codigoIbge            ?? "",
    // ── SINAN investigation/conclusion
    evolucao_caso:        patient.evolucaoCaso          ?? "",
    classificacao_final:  patient.classificacaoFinal    ?? "",
    criterio_confirmacao: patient.criterioConfirmacao   ?? "",
  };
}

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
): Promise<Uint8Array> {
  const doc    = await PDFDocument.load(templateBytes);
  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const INK    = rgb(0.04, 0.08, 0.22);
  const SIZE   = 8;
  const coords = COORDS[type] ?? COORDS_NOTIF_INDIVIDUAL;
  const page   = doc.getPages()[0];

  const values = buildFieldValues(patient);

  // ── 1. Fill AcroForm fields ───────────────────────────────────────────────
  const form = doc.getForm();
  for (const [fieldName, value] of Object.entries(values)) {
    if (!value.trim()) continue;
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
      field.enableReadOnly(); // lock so staff can't accidentally clear it
    } catch {
      // field not present in this template — text overlay will handle it
    }
  }

  // ── 2. Draw text overlay (fallback + raster-image PDFs) ──────────────────
  function draw(key: string, useBold = false) {
    const pos   = coords[key];
    const value = values[key] ?? "";
    if (!pos || !value.trim()) return;
    const f = useBold ? bold : font;
    let text = value;
    if (pos.maxWidth) {
      while (text.length > 1 && f.widthOfTextAtSize(text, SIZE) > pos.maxWidth) {
        text = text.slice(0, -1);
      }
    }
    page.drawText(text, { x: pos.x, y: pos.y, font: f, size: SIZE, color: INK });
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
  draw("raca_cor");
  draw("idade");
  draw("sexo");
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
  draw("profissional_responsavel");
  // ── SINAN notification header
  draw("agravo_notificacao");
  draw("data_notificacao");
  draw("municipio_notificacao");
  draw("codigo_ibge");
  // ── SINAN investigation/conclusion
  draw("evolucao_caso");
  draw("classificacao_final");
  draw("criterio_confirmacao");

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
export async function downloadSinanPdf(
  patient: PdfPatient,
  notif: PdfNotification,
  baseUrl: string,
): Promise<void> {
  let types: string[] = [];
  try { types = JSON.parse(notif.types) as string[]; } catch { /* ignore */ }
  if (!types.length) types = ["outros"];

  const merged = await PDFDocument.create();

  for (const type of types) {
    const url = `${baseUrl}${templatePath(type)}`;
    let templateBytes: ArrayBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      templateBytes = await res.arrayBuffer();
    } catch { continue; }

    const filledBytes = await fillTemplate(templateBytes, patient, type);
    const filled      = await PDFDocument.load(filledBytes);
    const copied      = await merged.copyPages(filled, filled.getPageIndices());
    copied.forEach(p => merged.addPage(p));
  }

  if (merged.getPageCount() === 0) {
    throw new Error("Nenhum template PDF encontrado para os tipos selecionados.");
  }

  const bytes = await merged.save();
  const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const href  = URL.createObjectURL(blob);
  const a     = Object.assign(document.createElement("a"), {
    href,
    download: `SINAN_${patient.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
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
    { key: "nome_paciente",        label: "NOME DO PACIENTE",         value: patient.nome },
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
    "UPA Breves — Gestão de Pacientes  |  Documento gerado automaticamente pelo sistema",
    { x: ML, y: 26, font, size: 6.5, color: MUTED },
  );

  // ── save & download ────────────────────────────────────────────────────────
  const bytes = await doc.save();
  const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const href  = URL.createObjectURL(blob);
  const link  = Object.assign(document.createElement("a"), {
    href,
    download: `Identificacao_${patient.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}

// ── preencherPDF — simplified Portuguese API ──────────────────────────────────
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
    nome:               d.nome_paciente,
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
  const notif: PdfNotification = { types: JSON.stringify(tipos) };
  await downloadSinanPdf(patient, notif, baseUrl);
}

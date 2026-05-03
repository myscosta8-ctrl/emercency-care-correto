/**
 * add-acroform.ts
 * Injects transparent AcroForm text fields into every SINAN PDF template,
 * positioned exactly over the printed boxes using the verified coordinates
 * from pdf-fill.ts.
 *
 * Run:  pnpm --filter @workspace/scripts run add-acroform
 *
 * Field names use the 14 standardized patient field names (shared by both
 * the text-overlay pass and the AcroForm fill loop in pdf-fill.ts):
 *   nome_paciente  nome_mae          data_nascimento  cpf *
 *   rg *           cns               endereco_rua     endereco_numero
 *   endereco_complemento  bairro     cidade           uf   cep   peso *
 *
 * (* cpf / rg / peso have no printed boxes on SINAN forms, so they are NOT
 *    injected into SINAN templates. They only appear on the Ficha ID card.)
 *
 * SINAN-specific context fields (have printed boxes; also get AcroForm fields):
 *   idade  sexo  telefone
 *
 * Idempotent: backs up originals as <file>.pdf.orig on first run;
 * subsequent runs re-inject from the backup so fields are never duplicated.
 */

import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, PDFName, rgb } from "pdf-lib";

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, "../../artifacts/upa-system/public/pdf-templates");

interface TextPos { x: number; y: number; maxWidth?: number; }
type FormCoords = Record<string, TextPos>;

const FIELD_H = 12;

// ── coordinate maps — must stay in sync with pdf-fill.ts ─────────────────────

const COORDS_DENGUE: FormCoords = {
  nome_paciente:        { x: 62,  y: 564, maxWidth: 386 },
  data_nascimento:      { x: 459, y: 565, maxWidth: 110 },
  idade:                { x: 65,  y: 535, maxWidth: 88  },
  sexo:                 { x: 162, y: 535, maxWidth: 88  },
  raca_cor:             { x: 260, y: 535, maxWidth: 88  },
  cpf:                  { x: 68,  y: 504, maxWidth: 160 },
  rg:                   { x: 248, y: 504, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 68,  y: 305, maxWidth: 130 },
  classificacao_risco:  { x: 220, y: 305, maxWidth: 200 },
  unidade_saude:           { x: 68,  y: 620, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 620, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 620, maxWidth: 80  },
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 68,  y: 676, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 676, maxWidth: 100 },
  municipio_notificacao:   { x: 68,  y: 648, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 648, maxWidth: 90  },
  evolucao_caso:           { x: 68,  y: 270, maxWidth: 200 },
  classificacao_final:     { x: 68,  y: 235, maxWidth: 250 },
  criterio_confirmacao:    { x: 280, y: 235, maxWidth: 150 },
};

const COORDS_TUBERCULOSE: FormCoords = {
  nome_paciente:        { x: 67,  y: 618, maxWidth: 375 },
  data_nascimento:      { x: 455, y: 619, maxWidth: 110 },
  idade:                { x: 66,  y: 589, maxWidth: 88  },
  sexo:                 { x: 165, y: 589, maxWidth: 88  },
  raca_cor:             { x: 263, y: 589, maxWidth: 88  },
  cpf:                  { x: 68,  y: 559, maxWidth: 160 },
  rg:                   { x: 248, y: 559, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 69,  y: 360, maxWidth: 130 },
  classificacao_risco:  { x: 221, y: 360, maxWidth: 200 },
  unidade_saude:           { x: 67,  y: 674, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 674, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 674, maxWidth: 80  },
  profissional_responsavel:{ x: 67,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 67,  y: 730, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 730, maxWidth: 100 },
  municipio_notificacao:   { x: 67,  y: 702, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 702, maxWidth: 90  },
  evolucao_caso:           { x: 67,  y: 325, maxWidth: 200 },
  classificacao_final:     { x: 67,  y: 290, maxWidth: 250 },
  criterio_confirmacao:    { x: 280, y: 290, maxWidth: 150 },
};

const COORDS_FEBRE_AMARELA: FormCoords = {
  nome_paciente:        { x: 65,  y: 604, maxWidth: 382 },
  data_nascimento:      { x: 458, y: 604, maxWidth: 110 },
  idade:                { x: 65,  y: 575, maxWidth: 88  },
  sexo:                 { x: 163, y: 575, maxWidth: 88  },
  raca_cor:             { x: 261, y: 575, maxWidth: 88  },
  cpf:                  { x: 68,  y: 545, maxWidth: 160 },
  rg:                   { x: 248, y: 545, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 66,  y: 345, maxWidth: 130 },
  classificacao_risco:  { x: 218, y: 345, maxWidth: 200 },
  unidade_saude:           { x: 65,  y: 660, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 660, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 660, maxWidth: 80  },
  profissional_responsavel:{ x: 65,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 65,  y: 716, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 716, maxWidth: 100 },
  municipio_notificacao:   { x: 65,  y: 688, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 688, maxWidth: 90  },
  evolucao_caso:           { x: 65,  y: 310, maxWidth: 200 },
  classificacao_final:     { x: 65,  y: 275, maxWidth: 250 },
  criterio_confirmacao:    { x: 278, y: 275, maxWidth: 150 },
};

const COORDS_MENINGITE: FormCoords = {
  nome_paciente:        { x: 71,  y: 600, maxWidth: 380 },
  data_nascimento:      { x: 461, y: 600, maxWidth: 110 },
  idade:                { x: 70,  y: 571, maxWidth: 88  },
  sexo:                 { x: 166, y: 571, maxWidth: 88  },
  raca_cor:             { x: 264, y: 571, maxWidth: 88  },
  cpf:                  { x: 68,  y: 541, maxWidth: 160 },
  rg:                   { x: 248, y: 541, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 69,  y: 341, maxWidth: 130 },
  classificacao_risco:  { x: 221, y: 341, maxWidth: 200 },
  unidade_saude:           { x: 71,  y: 656, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 656, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 656, maxWidth: 80  },
  profissional_responsavel:{ x: 71,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 71,  y: 712, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 712, maxWidth: 100 },
  municipio_notificacao:   { x: 71,  y: 684, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 684, maxWidth: 90  },
  evolucao_caso:           { x: 71,  y: 306, maxWidth: 200 },
  classificacao_final:     { x: 71,  y: 271, maxWidth: 250 },
  criterio_confirmacao:    { x: 284, y: 271, maxWidth: 150 },
};

const COORDS_NOTIF_INDIVIDUAL: FormCoords = {
  nome_paciente:        { x: 68,  y: 641, maxWidth: 380 },
  data_nascimento:      { x: 458, y: 641, maxWidth: 110 },
  idade:                { x: 67,  y: 612, maxWidth: 88  },
  sexo:                 { x: 163, y: 612, maxWidth: 88  },
  raca_cor:             { x: 261, y: 612, maxWidth: 88  },
  cpf:                  { x: 68,  y: 582, maxWidth: 160 },
  rg:                   { x: 248, y: 582, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 66,  y: 316, maxWidth: 130 },
  classificacao_risco:  { x: 218, y: 316, maxWidth: 200 },
  unidade_saude:           { x: 68,  y: 697, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 697, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 697, maxWidth: 80  },
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 68,  y: 753, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 753, maxWidth: 100 },
  municipio_notificacao:   { x: 68,  y: 725, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 725, maxWidth: 90  },
  evolucao_caso:           { x: 68,  y: 281, maxWidth: 200 },
  classificacao_final:     { x: 68,  y: 246, maxWidth: 250 },
  criterio_confirmacao:    { x: 281, y: 246, maxWidth: 150 },
};

const COORDS_FEBRE_TIFOIDE: FormCoords = {
  nome_paciente:        { x: 66,  y: 589, maxWidth: 382 },
  data_nascimento:      { x: 456, y: 590, maxWidth: 110 },
  idade:                { x: 66,  y: 560, maxWidth: 88  },
  sexo:                 { x: 165, y: 560, maxWidth: 88  },
  raca_cor:             { x: 263, y: 560, maxWidth: 88  },
  cpf:                  { x: 68,  y: 530, maxWidth: 160 },
  rg:                   { x: 248, y: 530, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 69,  y: 328, maxWidth: 130 },
  classificacao_risco:  { x: 221, y: 328, maxWidth: 200 },
  unidade_saude:           { x: 66,  y: 645, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 645, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 645, maxWidth: 80  },
  profissional_responsavel:{ x: 66,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 66,  y: 701, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 701, maxWidth: 100 },
  municipio_notificacao:   { x: 66,  y: 673, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 673, maxWidth: 90  },
  evolucao_caso:           { x: 66,  y: 293, maxWidth: 200 },
  classificacao_final:     { x: 66,  y: 258, maxWidth: 250 },
  criterio_confirmacao:    { x: 279, y: 258, maxWidth: 150 },
};

const COORDS_AIDS_ADULTO: FormCoords = {
  nome_paciente:        { x: 68,  y: 593, maxWidth: 380 },
  data_nascimento:      { x: 457, y: 593, maxWidth: 110 },
  idade:                { x: 65,  y: 564, maxWidth: 88  },
  sexo:                 { x: 163, y: 564, maxWidth: 88  },
  raca_cor:             { x: 261, y: 564, maxWidth: 88  },
  cpf:                  { x: 68,  y: 534, maxWidth: 160 },
  rg:                   { x: 248, y: 534, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 69,  y: 332, maxWidth: 130 },
  classificacao_risco:  { x: 221, y: 332, maxWidth: 200 },
  unidade_saude:           { x: 68,  y: 649, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 649, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 649, maxWidth: 80  },
  profissional_responsavel:{ x: 68,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 68,  y: 705, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 705, maxWidth: 100 },
  municipio_notificacao:   { x: 68,  y: 677, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 677, maxWidth: 90  },
  evolucao_caso:           { x: 68,  y: 297, maxWidth: 200 },
  classificacao_final:     { x: 68,  y: 262, maxWidth: 250 },
  criterio_confirmacao:    { x: 281, y: 262, maxWidth: 150 },
};

const COORDS_EXANTEMATICA: FormCoords = {
  nome_paciente:        { x: 67,  y: 550, maxWidth: 380 },
  data_nascimento:      { x: 457, y: 550, maxWidth: 110 },
  idade:                { x: 65,  y: 521, maxWidth: 88  },
  sexo:                 { x: 162, y: 521, maxWidth: 88  },
  raca_cor:             { x: 260, y: 521, maxWidth: 88  },
  cpf:                  { x: 68,  y: 491, maxWidth: 160 },
  rg:                   { x: 248, y: 491, maxWidth: 150 },
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
  data_inicio_sintomas: { x: 67,  y: 290, maxWidth: 130 },
  classificacao_risco:  { x: 219, y: 290, maxWidth: 200 },
  unidade_saude:           { x: 67,  y: 606, maxWidth: 290 },
  data_atendimento:        { x: 380, y: 606, maxWidth: 100 },
  hora_atendimento:        { x: 490, y: 606, maxWidth: 80  },
  profissional_responsavel:{ x: 67,  y: 90,  maxWidth: 460 },
  agravo_notificacao:      { x: 67,  y: 662, maxWidth: 290 },
  data_notificacao:        { x: 380, y: 662, maxWidth: 100 },
  municipio_notificacao:   { x: 67,  y: 634, maxWidth: 280 },
  codigo_ibge:             { x: 380, y: 634, maxWidth: 90  },
  evolucao_caso:           { x: 67,  y: 255, maxWidth: 200 },
  classificacao_final:     { x: 67,  y: 220, maxWidth: 250 },
  criterio_confirmacao:    { x: 280, y: 220, maxWidth: 150 },
};

const TEMPLATES: Array<{ file: string; coords: FormCoords }> = [
  { file: "dengue.pdf",                coords: COORDS_DENGUE            },
  { file: "tuberculose.pdf",           coords: COORDS_TUBERCULOSE       },
  { file: "febre-amarela.pdf",         coords: COORDS_FEBRE_AMARELA     },
  { file: "meningite.pdf",             coords: COORDS_MENINGITE         },
  { file: "notificacao-individual.pdf",coords: COORDS_NOTIF_INDIVIDUAL  },
  { file: "febre-tifoide.pdf",         coords: COORDS_FEBRE_TIFOIDE     },
  { file: "aids-adulto.pdf",           coords: COORDS_AIDS_ADULTO       },
  { file: "exantematica.pdf",          coords: COORDS_EXANTEMATICA      },
  { file: "covid19.pdf",               coords: COORDS_NOTIF_INDIVIDUAL  },
  { file: "srag.pdf",                  coords: COORDS_NOTIF_INDIVIDUAL  },
];

// ── inject via high-level PDFForm API ─────────────────────────────────────────

async function injectAcroForm(filePath: string, coords: FormCoords): Promise<void> {
  const backupPath = filePath + ".orig";

  // Always inject from the original backup so re-runs are idempotent
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  const bytes = fs.readFileSync(backupPath);
  const doc   = await PDFDocument.load(bytes.buffer as ArrayBuffer, { ignoreEncryption: true });

  // Strip any pre-existing AcroForm entries (built-in SINAN fields or
  // fields from a previous injection run) so re-runs never duplicate.
  doc.catalog.delete(PDFName.of("AcroForm"));

  const form  = doc.getForm();
  const page  = doc.getPage(0);

  for (const [fieldName, pos] of Object.entries(coords)) {
    const width = pos.maxWidth ?? 200;
    const field = form.createTextField(fieldName);
    field.addToPage(page, {
      x:           pos.x,
      y:           pos.y - 2,
      width:       width,
      height:      FIELD_H,
      borderWidth: 0,
      backgroundColor: rgb(1, 1, 1),
    });
  }

  const saved = await doc.save({ useObjectStreams: false });
  fs.writeFileSync(filePath, saved);
  console.log(`  ✓  ${path.basename(filePath)} — ${Object.keys(coords).length} fields`);
}

async function main(): Promise<void> {
  console.log("\nInjecting AcroForm fields into SINAN PDF templates…");
  console.log(`Templates dir: ${TEMPLATES_DIR}\n`);

  for (const { file, coords } of TEMPLATES) {
    const filePath = path.join(TEMPLATES_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠  ${file} not found — skipping`);
      continue;
    }
    try {
      await injectAcroForm(filePath, coords);
    } catch (err) {
      console.error(`  ✗  ${file}:`, err);
    }
  }

  console.log("\nDone.\n");
}

main().catch(err => { console.error(err); process.exit(1); });

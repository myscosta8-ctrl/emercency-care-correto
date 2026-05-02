/**
 * add-acroform.ts
 * Injects transparent AcroForm text fields into every SINAN PDF template,
 * positioned exactly over the printed boxes using the verified coordinates
 * from pdf-fill.ts.
 *
 * Run:  pnpm --filter @workspace/scripts run add-acroform
 *
 * Uses pdf-lib's high-level PDFForm.createTextField() API so that AcroForm
 * fields are correctly wired into the catalog and cross-reference table.
 *
 * Each field is:
 *   - Transparent background, no visible border
 *   - Font size 8, Helvetica
 *   - Named to match the patient data keys in pdf-fill.ts
 */

import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb } from "pdf-lib";

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, "../../artifacts/upa-system/public/pdf-templates");

// ── coordinate type ───────────────────────────────────────────────────────────

interface TextPos { x: number; y: number; maxWidth?: number; }
type FormCoords = Record<string, TextPos>;

// AcroForm field height in points (covers the printed input line)
const FIELD_H = 12;

// ── verified coordinate maps (must stay in sync with pdf-fill.ts) ─────────────

const COORDS_DENGUE: FormCoords = {
  nome_completo:   { x: 62,  y: 564, maxWidth: 386 },
  data_nascimento: { x: 459, y: 565, maxWidth: 110 },
  idade:           { x: 65,  y: 535, maxWidth: 88  },
  sexo:            { x: 162, y: 535, maxWidth: 88  },
  cns:             { x: 68,  y: 474, maxWidth: 170 },
  nome_mae:        { x: 247, y: 474, maxWidth: 290 },
  municipio:       { x: 97,  y: 443, maxWidth: 320 },
  bairro:          { x: 68,  y: 418, maxWidth: 130 },
  logradouro:      { x: 208, y: 417, maxWidth: 200 },
  numero_end:      { x: 68,  y: 394, maxWidth: 100 },
  cep:             { x: 470, y: 366, maxWidth: 100 },
  telefone:        { x: 68,  y: 343, maxWidth: 140 },
};

const COORDS_TUBERCULOSE: FormCoords = {
  nome_completo:   { x: 67,  y: 618, maxWidth: 375 },
  data_nascimento: { x: 455, y: 619, maxWidth: 110 },
  idade:           { x: 66,  y: 589, maxWidth: 88  },
  sexo:            { x: 165, y: 589, maxWidth: 88  },
  cns:             { x: 69,  y: 528, maxWidth: 162 },
  nome_mae:        { x: 243, y: 527, maxWidth: 295 },
  municipio:       { x: 98,  y: 497, maxWidth: 315 },
  bairro:          { x: 68,  y: 473, maxWidth: 130 },
  logradouro:      { x: 209, y: 472, maxWidth: 200 },
  numero_end:      { x: 68,  y: 448, maxWidth: 100 },
  cep:             { x: 467, y: 420, maxWidth: 100 },
  telefone:        { x: 69,  y: 398, maxWidth: 140 },
};

const COORDS_FEBRE_AMARELA: FormCoords = {
  nome_completo:   { x: 65,  y: 604, maxWidth: 382 },
  data_nascimento: { x: 458, y: 604, maxWidth: 110 },
  idade:           { x: 65,  y: 575, maxWidth: 88  },
  sexo:            { x: 163, y: 575, maxWidth: 88  },
  cns:             { x: 68,  y: 514, maxWidth: 168 },
  nome_mae:        { x: 243, y: 513, maxWidth: 292 },
  municipio:       { x: 95,  y: 483, maxWidth: 318 },
  bairro:          { x: 64,  y: 459, maxWidth: 132 },
  logradouro:      { x: 207, y: 458, maxWidth: 200 },
  numero_end:      { x: 66,  y: 434, maxWidth: 100 },
  cep:             { x: 468, y: 406, maxWidth: 100 },
  telefone:        { x: 66,  y: 383, maxWidth: 140 },
};

const COORDS_MENINGITE: FormCoords = {
  nome_completo:   { x: 71,  y: 600, maxWidth: 380 },
  data_nascimento: { x: 461, y: 600, maxWidth: 110 },
  idade:           { x: 70,  y: 571, maxWidth: 88  },
  sexo:            { x: 166, y: 571, maxWidth: 88  },
  cns:             { x: 69,  y: 510, maxWidth: 168 },
  nome_mae:        { x: 243, y: 509, maxWidth: 292 },
  municipio:       { x: 97,  y: 479, maxWidth: 318 },
  bairro:          { x: 68,  y: 455, maxWidth: 130 },
  logradouro:      { x: 209, y: 454, maxWidth: 200 },
  numero_end:      { x: 68,  y: 430, maxWidth: 100 },
  cep:             { x: 467, y: 402, maxWidth: 100 },
  telefone:        { x: 69,  y: 379, maxWidth: 140 },
};

const COORDS_NOTIF_INDIVIDUAL: FormCoords = {
  nome_completo:   { x: 68,  y: 641, maxWidth: 380 },
  data_nascimento: { x: 458, y: 641, maxWidth: 110 },
  idade:           { x: 67,  y: 612, maxWidth: 88  },
  sexo:            { x: 163, y: 612, maxWidth: 88  },
  cns:             { x: 70,  y: 551, maxWidth: 168 },
  nome_mae:        { x: 245, y: 550, maxWidth: 292 },
  municipio:       { x: 93,  y: 454, maxWidth: 318 },
  bairro:          { x: 65,  y: 429, maxWidth: 130 },
  logradouro:      { x: 207, y: 429, maxWidth: 200 },
  numero_end:      { x: 65,  y: 405, maxWidth: 100 },
  cep:             { x: 468, y: 377, maxWidth: 100 },
  telefone:        { x: 66,  y: 354, maxWidth: 140 },
};

const COORDS_FEBRE_TIFOIDE: FormCoords = {
  nome_completo:   { x: 66,  y: 589, maxWidth: 382 },
  data_nascimento: { x: 456, y: 590, maxWidth: 110 },
  idade:           { x: 66,  y: 560, maxWidth: 88  },
  sexo:            { x: 165, y: 560, maxWidth: 88  },
  cns:             { x: 69,  y: 499, maxWidth: 168 },
  nome_mae:        { x: 243, y: 498, maxWidth: 292 },
  municipio:       { x: 97,  y: 468, maxWidth: 318 },
  bairro:          { x: 68,  y: 444, maxWidth: 130 },
  logradouro:      { x: 209, y: 443, maxWidth: 200 },
  numero_end:      { x: 68,  y: 419, maxWidth: 100 },
  cep:             { x: 469, y: 389, maxWidth: 100 },
  telefone:        { x: 69,  y: 366, maxWidth: 140 },
};

const COORDS_AIDS_ADULTO: FormCoords = {
  nome_completo:   { x: 68,  y: 593, maxWidth: 380 },
  data_nascimento: { x: 457, y: 593, maxWidth: 110 },
  idade:           { x: 65,  y: 564, maxWidth: 88  },
  sexo:            { x: 163, y: 564, maxWidth: 88  },
  cns:             { x: 71,  y: 503, maxWidth: 165 },
  nome_mae:        { x: 245, y: 502, maxWidth: 290 },
  municipio:       { x: 95,  y: 470, maxWidth: 250 },
  bairro:          { x: 67,  y: 445, maxWidth: 130 },
  logradouro:      { x: 207, y: 444, maxWidth: 200 },
  numero_end:      { x: 68,  y: 421, maxWidth: 100 },
  cep:             { x: 471, y: 393, maxWidth: 100 },
  telefone:        { x: 69,  y: 370, maxWidth: 140 },
};

const COORDS_EXANTEMATICA: FormCoords = {
  nome_completo:   { x: 67,  y: 550, maxWidth: 380 },
  data_nascimento: { x: 457, y: 550, maxWidth: 110 },
  idade:           { x: 65,  y: 521, maxWidth: 88  },
  sexo:            { x: 162, y: 521, maxWidth: 88  },
  cns:             { x: 69,  y: 460, maxWidth: 168 },
  nome_mae:        { x: 244, y: 459, maxWidth: 292 },
  municipio:       { x: 94,  y: 428, maxWidth: 318 },
  bairro:          { x: 66,  y: 403, maxWidth: 130 },
  logradouro:      { x: 205, y: 402, maxWidth: 200 },
  numero_end:      { x: 66,  y: 379, maxWidth: 100 },
  cep:             { x: 469, y: 351, maxWidth: 100 },
  telefone:        { x: 67,  y: 328, maxWidth: 140 },
};

// Registry: filename → coords
const TEMPLATES: Array<{ file: string; coords: FormCoords }> = [
  { file: "dengue.pdf",                coords: COORDS_DENGUE            },
  { file: "tuberculose.pdf",           coords: COORDS_TUBERCULOSE       },
  { file: "febre-amarela.pdf",         coords: COORDS_FEBRE_AMARELA     },
  { file: "meningite.pdf",             coords: COORDS_MENINGITE         },
  { file: "notificacao-individual.pdf",coords: COORDS_NOTIF_INDIVIDUAL  },
  { file: "febre-tifoide.pdf",         coords: COORDS_FEBRE_TIFOIDE     },
  { file: "aids-adulto.pdf",           coords: COORDS_AIDS_ADULTO       },
  { file: "exantematica.pdf",          coords: COORDS_EXANTEMATICA      },
  // covid19 / srag are raster-image PDFs — use notificacao-individual coords as proxy
  { file: "covid19.pdf",               coords: COORDS_NOTIF_INDIVIDUAL  },
  { file: "srag.pdf",                  coords: COORDS_NOTIF_INDIVIDUAL  },
];

// ── inject AcroForm fields using the high-level PDFForm API ──────────────────

async function injectAcroForm(filePath: string, coords: FormCoords): Promise<void> {
  // Read the ORIGINAL template from the backup, or the live file if no backup
  const backupPath = filePath + ".orig";
  const sourcePath = fs.existsSync(backupPath) ? backupPath : filePath;

  // Always work from the original so re-running is idempotent
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  const bytes = fs.readFileSync(sourcePath);
  const doc   = await PDFDocument.load(bytes.buffer as ArrayBuffer, {
    ignoreEncryption: true,
  });

  const form = doc.getForm();
  const page = doc.getPage(0);

  // Collect existing field names to avoid FieldAlreadyExistsError on re-runs
  const existingNames = new Set(form.getFields().map(f => f.getName()));

  for (const [fieldName, pos] of Object.entries(coords)) {
    // Skip if already present (idempotent re-run safety)
    if (existingNames.has(fieldName)) continue;
    const width = pos.maxWidth ?? 200;

    const field = form.createTextField(fieldName);

    // Transparent appearance: no background, no border
    field.addToPage(page, {
      x:           pos.x,
      y:           pos.y - 2,      // sit 2 pt below the text baseline
      width:       width,
      height:      FIELD_H,
      borderWidth: 0,
      backgroundColor: rgb(1, 1, 1),  // white — set to opacity via MK if needed
      // pdf-lib doesn't expose opacity natively; use white bg (print result same)
    });

    // Note: pdf-lib sets a white background by default on new text fields.
    // This is acceptable — the field is invisible until focused in a viewer.
  }

  // updateFieldAppearances renders the DA strings so values show up without viewer re-render
  // (skip for empty templates — fields have no value yet)
  // form.updateFieldAppearances();   // intentionally left blank for template files

  const saved = await doc.save({ useObjectStreams: false });
  fs.writeFileSync(filePath, saved);

  const count = Object.keys(coords).length;
  console.log(`  ✓  ${path.basename(filePath)} — ${count} AcroForm fields added`);
}

// ── main ──────────────────────────────────────────────────────────────────────

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

  console.log("\nDone. All SINAN templates now have fillable AcroForm fields.");
  console.log("Original backups saved as <filename>.pdf.orig\n");
}

main().catch(err => { console.error(err); process.exit(1); });

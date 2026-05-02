import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ── types ─────────────────────────────────────────────────────────────────────

export interface PdfPatient {
  name: string;
  birthDate?: string | null;
  age?: number | null;
  sex?: string | null;
  motherName?: string | null;
  cns?: string | null;
  cpf?: string | null;
  rg?: string | null;
  phone?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  addressState?: string | null;
  zipCode?: string | null;
  weight?: number | null;
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

// ── field value map ───────────────────────────────────────────────────────────
// Keys match the 12 standardized patient field names.
// Extra SINAN-only keys (idade, sexo, telefone, numero_end) are included for
// the text-overlay draw pass; they are not AcroForm field names.

function buildFieldValues(patient: PdfPatient): Record<string, string> {
  return {
    // ── 14 standard patient fields ────────────────────────────────────────
    nome_paciente:        patient.name,
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
    // ── SINAN overlay-only fields (not AcroForm field names) ─────────────
    idade:                patient.age ? `${patient.age} anos` : "",
    sexo:                 sexLabel(patient.sex),
    telefone:             patient.phone          ?? "",
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

  // 14 standard fields
  draw("nome_paciente",        true);
  draw("nome_mae");
  draw("data_nascimento");
  draw("cns");
  draw("endereco_rua");
  draw("endereco_numero");
  draw("endereco_complemento");
  draw("bairro");
  draw("cidade");
  draw("uf");
  draw("cep");
  // SINAN-only overlay fields (not AcroForm names)
  draw("idade");
  draw("sexo");
  draw("telefone");

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
    download: `SINAN_${patient.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
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

  // ── layout (12 rows, ROW_H=38, GAP=6, STEP=44) ───────────────────────────
  const ML      = 40;
  const CW      = 515;
  const LBL_W   = 140;
  const VAL_W   = CW - LBL_W;
  const ROW_H   = 38;
  const STEP    = 44;           // ROW_H + 6 gap
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

  // ── 14 standard field definitions ─────────────────────────────────────────
  const fields: Array<{ key: string; label: string; value: string }> = [
    { key: "nome_paciente",        label: "NOME DO PACIENTE",    value: patient.name },
    { key: "nome_mae",             label: "NOME DA MÃE",         value: patient.motherName        ?? "" },
    { key: "data_nascimento",      label: "DATA DE NASCIMENTO",  value: fmtDate(patient.birthDate) },
    { key: "cpf",                  label: "CPF",                 value: patient.cpf               ?? "" },
    { key: "rg",                   label: "RG",                  value: patient.rg                ?? "" },
    { key: "cns",                  label: "CNS / CARTÃO SUS",    value: patient.cns               ?? "" },
    { key: "endereco_rua",         label: "ENDEREÇO (RUA)",      value: patient.street            ?? "" },
    { key: "endereco_numero",      label: "NÚMERO",              value: patient.addressNumber     ?? "" },
    { key: "endereco_complemento", label: "COMPLEMENTO",         value: patient.addressComplement ?? "" },
    { key: "bairro",               label: "BAIRRO",              value: patient.neighborhood      ?? "" },
    { key: "cidade",               label: "MUNICÍPIO",           value: patient.city              ?? "" },
    { key: "uf",                   label: "UF",                  value: patient.addressState      ?? "" },
    { key: "cep",                  label: "CEP",                 value: patient.zipCode           ?? "" },
    { key: "peso",                 label: "PESO (kg)",           value: patient.weight != null ? `${patient.weight}` : "" },
  ];

  // ── draw rows ──────────────────────────────────────────────────────────────
  fields.forEach(({ key, label, value }, i) => {
    const yBot = FIRST_Y - i * STEP - ROW_H;
    const yTop = yBot + ROW_H;

    page.drawRectangle({ x: ML,          y: yBot, width: LBL_W, height: ROW_H, color: LBLBG });
    page.drawRectangle({ x: ML + LBL_W,  y: yBot, width: VAL_W, height: ROW_H, color: VALBG });
    page.drawRectangle({ x: ML, y: yBot, width: CW, height: ROW_H, borderColor: BORDER, borderWidth: 0.5 });
    page.drawLine({ start: { x: ML + LBL_W, y: yBot }, end: { x: ML + LBL_W, y: yTop }, thickness: 0.5, color: BORDER });

    // field key badge (small, top-left of label column)
    const badgeLabel = key.replace(/_/g, " ");
    page.drawRectangle({ x: ML + 4, y: yTop - 13, width: bold.widthOfTextAtSize(badgeLabel, 5.5) + 6, height: 10, color: ACCENT });
    page.drawText(badgeLabel, { x: ML + 7, y: yTop - 12, font: bold, size: 5.5, color: WHITE });

    // display label (bottom of label column)
    page.drawText(label, { x: ML + 6, y: yBot + 8, font: bold, size: 6.5, color: MUTED });

    // value
    let txt = value || "—";
    const maxW = VAL_W - 14;
    while (txt.length > 1 && bold.widthOfTextAtSize(txt, 9.5) > maxW) txt = txt.slice(0, -1);
    page.drawText(txt, {
      x: ML + LBL_W + 8, y: yBot + (ROW_H / 2 - 4),
      font: value ? bold : font,
      size: value ? 9.5 : 8.5,
      color: value ? DARK : MUTED,
    });
  });

  // ── signature block ────────────────────────────────────────────────────────
  const lastBot = FIRST_Y - 11 * STEP - ROW_H;   // bottom of last row (i=11)
  const sigY    = lastBot - 36;
  page.drawLine({ start: { x: ML,       y: sigY }, end: { x: ML + 235, y: sigY }, thickness: 0.5, color: BORDER });
  page.drawLine({ start: { x: ML + 275, y: sigY }, end: { x: ML + CW,  y: sigY }, thickness: 0.5, color: BORDER });
  page.drawText("Assinatura / Carimbo do Profissional", { x: ML, y: sigY - 10, font, size: 7, color: MUTED });
  page.drawText("Data / Hora", { x: ML + 275, y: sigY - 10, font, size: 7, color: MUTED });

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
    download: `Identificacao_${patient.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}

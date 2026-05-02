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
    dengue:      "pdf-templates/dengue.pdf",
    covid19:     "pdf-templates/covid19.pdf",
    tuberculose: "pdf-templates/tuberculose.pdf",
    meningite:   "pdf-templates/meningite.pdf",
    violencia:   "pdf-templates/notificacao-individual.pdf",
    outros:      "pdf-templates/notificacao-individual.pdf",
  };
  return MAP[type] ?? "pdf-templates/notificacao-individual.pdf";
}

// ── coordinate maps ───────────────────────────────────────────────────────────
// Derived from exact PDF text extraction (pdf-lib bottom-left origin, A4 595×842).
// Fill positions = label_y − 14 (8 pt Helvetica sits inside each cell row).

const COORDS_DENGUE: FormCoords = {
  nome_completo:   { x: 62,  y: 563, maxWidth: 380 },
  data_nascimento: { x: 459, y: 563, maxWidth: 110 },
  idade:           { x: 65,  y: 533, maxWidth: 88  },
  sexo:            { x: 162, y: 533, maxWidth: 88  },
  cns:             { x: 68,  y: 472, maxWidth: 168 },
  nome_mae:        { x: 247, y: 472, maxWidth: 290 },
  municipio:       { x: 97,  y: 441, maxWidth: 320 },
  bairro:          { x: 68,  y: 415, maxWidth: 130 },
  logradouro:      { x: 208, y: 415, maxWidth: 200 },
  numero_end:      { x: 68,  y: 391, maxWidth: 100 },
  cep:             { x: 470, y: 363, maxWidth: 100 },
  telefone:        { x: 68,  y: 341, maxWidth: 140 },
};

const COORDS_TUBERCULOSE: FormCoords = {
  nome_completo:   { x: 67,  y: 617, maxWidth: 375 },
  data_nascimento: { x: 455, y: 617, maxWidth: 110 },
  idade:           { x: 66,  y: 587, maxWidth: 88  },
  sexo:            { x: 165, y: 587, maxWidth: 88  },
  cns:             { x: 69,  y: 525, maxWidth: 162 },
  nome_mae:        { x: 243, y: 525, maxWidth: 295 },
  municipio:       { x: 98,  y: 495, maxWidth: 315 },
  bairro:          { x: 68,  y: 471, maxWidth: 130 },
  logradouro:      { x: 209, y: 471, maxWidth: 200 },
  numero_end:      { x: 68,  y: 446, maxWidth: 100 },
  cep:             { x: 467, y: 418, maxWidth: 100 },
  telefone:        { x: 69,  y: 396, maxWidth: 140 },
};

// Forms without extracted coordinates fall back to tuberculose layout
// (all SINAN forms share the same Notificação Individual section structure)
const COORDS: Record<string, FormCoords> = {
  dengue:      COORDS_DENGUE,
  tuberculose: COORDS_TUBERCULOSE,
  covid19:     COORDS_TUBERCULOSE,
  meningite:   COORDS_TUBERCULOSE,
  violencia:   COORDS_TUBERCULOSE,
  outros:      COORDS_TUBERCULOSE,
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s?: string | null): string {
  if (!s) return "";
  const parts = s.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

function sexLabel(sex?: string | null): string {
  if (sex === "M") return "M — Masculino";
  if (sex === "F") return "F — Feminino";
  return "I — Ignorado";
}

// ── core fill function ────────────────────────────────────────────────────────

async function fillTemplate(
  templateBytes: ArrayBuffer,
  patient: PdfPatient,
  type: string,
): Promise<Uint8Array> {
  const doc  = await PDFDocument.load(templateBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const INK  = rgb(0.04, 0.08, 0.22);   // dark navy, near-black
  const SIZE = 8;
  const coords = COORDS[type] ?? COORDS_TUBERCULOSE;
  const page   = doc.getPages()[0];

  function draw(key: string, value: string, useBold = false) {
    const pos = coords[key];
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

  draw("nome_completo",   patient.name,                   true);
  draw("data_nascimento", fmtDate(patient.birthDate));
  draw("idade",           patient.age ? `${patient.age} anos` : "");
  draw("sexo",            sexLabel(patient.sex));
  draw("cns",             patient.cns  ?? "");
  draw("nome_mae",        patient.motherName ?? "");
  draw("municipio",       patient.city ?? "");
  draw("bairro",          patient.neighborhood ?? "");
  draw("logradouro",      patient.street ?? "");
  draw("numero_end",      patient.addressNumber ?? "");
  draw("cep",             patient.zipCode ?? "");
  draw("telefone",        patient.phone ?? "");

  return doc.save();
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Generates a merged SINAN PDF for all notification types and triggers a browser download.
 * @param patient  Patient data
 * @param notif    Notification data
 * @param baseUrl  import.meta.env.BASE_URL (ensures correct path under proxy prefix)
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
    } catch {
      continue;
    }

    const filledBytes = await fillTemplate(templateBytes, patient, type);
    const filled = await PDFDocument.load(filledBytes);
    const copied = await merged.copyPages(filled, filled.getPageIndices());
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

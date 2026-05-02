/**
 * extract-formax-coords.ts
 * Extracts text Tm matrix positions from Formax-encoded SINAN PDFs
 * (those with "0.06000 0 0 -0.06000" CTM transform).
 * 
 * Formax → PDF coordinate transform:
 *   pdf_x = 1 + fx * 0.06
 *   pdf_y = 841 - fy * 0.06
 *
 * Run: pnpm --filter @workspace/scripts run extract-formax-coords [template]
 */
import * as fs   from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DIR = path.resolve(__dirname, "../../artifacts/upa-system/public/pdf-templates");

function extractStreams(buf: Buffer): string[] {
  const results: string[] = [];
  let off = 0;
  while (off < buf.length) {
    const si = buf.indexOf("stream", off);
    if (si === -1) break;
    let di = si + 6;
    if (buf[di] === 13 && buf[di + 1] === 10) di += 2;
    else if (buf[di] === 10) di += 1;
    const ei = buf.indexOf("endstream", di);
    if (ei === -1) break;
    const raw = buf.slice(di, ei);
    let text: string;
    try { text = zlib.inflateSync(raw).toString("latin1"); }
    catch { try { text = zlib.inflateRawSync(raw).toString("latin1"); } catch { text = raw.toString("latin1"); } }
    results.push(text);
    off = ei + 9;
  }
  return results;
}

// Detect Formax CTM and extract scale/origin
function detectFormax(content: string): { ox: number; oy: number; sx: number; sy: number } | null {
  // "q 1 0 0 1 <ox> <oy> cm <sx> 0 0 <sy> 0 0 cm"
  const m = content.match(/1\s+0\s+0\s+1\s+([\d.]+)\s+([\d.]+)\s+cm\s*([\d.]+)\s+0\s+0\s+([\d.\-]+)\s+0\s+0\s+cm/);
  if (!m) return null;
  return { ox: parseFloat(m[1]), oy: parseFloat(m[2]), sx: parseFloat(m[3]), sy: parseFloat(m[4]) };
}

interface TmPos { fx: number; fy: number; pdf_x: number; pdf_y: number; context: string }

function extractTmPositions(content: string, ctm: { ox: number; oy: number; sx: number; sy: number }): TmPos[] {
  const positions: TmPos[] = [];
  // Extract all BT...ET blocks
  const parts = content.split(/\bBT\b/);
  for (let i = 1; i < parts.length; i++) {
    const et = parts[i].indexOf("ET");
    const block = et !== -1 ? parts[i].slice(0, et) : parts[i];
    
    // Find all Tm matrices: a b c d e f Tm
    // Use a regex that matches 6 numbers followed by Tm
    const tmRx = /([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+Tm/g;
    let m: RegExpExecArray | null;
    while ((m = tmRx.exec(block)) !== null) {
      const [, a, b, c, d, e, f] = m;
      const fx = parseFloat(e);
      const fy = parseFloat(f);
      // Convert to PDF space
      const pdf_x = Math.round(ctm.ox + fx * ctm.sx);
      const pdf_y = Math.round(ctm.oy + fy * ctm.sy);
      // Grab context (next 60 chars after Tm, cleaned)
      const afterTm = block.slice(m.index + m[0].length, m.index + m[0].length + 80);
      const context = afterTm.replace(/[^\x20-\x7E]/g, "·").substring(0, 60);
      positions.push({ fx, fy, pdf_x, pdf_y, context });
    }

    // Also find Td operators
    const tdRx = /([\d.\-]+)\s+([\d.\-]+)\s+TD?\b/g;
    let curX = 0, curY = 0;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdRx.exec(block)) !== null) {
      const tx = parseFloat(tdm[1]);
      const ty = parseFloat(tdm[2]);
      curX += tx; curY += ty;
      const pdf_x = Math.round(ctm.ox + curX * ctm.sx);
      const pdf_y = Math.round(ctm.oy + curY * ctm.sy);
      if (Math.abs(tx) + Math.abs(ty) > 0) {
        const afterTd = block.slice(tdm.index + tdm[0].length, tdm.index + tdm[0].length + 80);
        const context = afterTd.replace(/[^\x20-\x7E]/g, "·").substring(0, 60);
        positions.push({ fx: curX, fy: curY, pdf_x, pdf_y, context: `[Td] ${context}` });
      }
    }
  }
  return positions;
}

function processFile(filePath: string) {
  const buf = fs.readFileSync(filePath);
  const streams = extractStreams(buf);
  
  const allPositions: TmPos[] = [];
  let ctm: { ox: number; oy: number; sx: number; sy: number } | null = null;
  
  for (const stream of streams) {
    if (!ctm) ctm = detectFormax(stream);
    if (!ctm) continue;
    if (!stream.includes("BT")) continue;
    allPositions.push(...extractTmPositions(stream, ctm));
  }

  // Deduplicate by (pdf_x, pdf_y)
  const seen = new Set<string>();
  const uniq = allPositions.filter(p => {
    const k = `${p.pdf_x}|${p.pdf_y}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // Sort top-to-bottom (higher y = higher on page)
  uniq.sort((a, b) => b.pdf_y - a.pdf_y || a.pdf_x - b.pdf_x);

  console.log(`\n${"=".repeat(72)}`);
  console.log(`FILE: ${path.basename(filePath)}  CTM: origin=(${ctm?.ox},${ctm?.oy}) scale=(${ctm?.sx},${ctm?.sy})`);
  console.log("=".repeat(72));
  console.log(`FORMAX_X  FORMAX_Y  PDF_X  PDF_Y  context`);
  console.log("-".repeat(72));
  for (const p of uniq) {
    console.log(`${String(p.fx).padStart(8)}  ${String(p.fy).padStart(8)}  ${String(p.pdf_x).padStart(5)}  ${String(p.pdf_y).padStart(5)}  ${p.context}`);
  }
  console.log(`(${uniq.length} text positions found)`);
}

const target = process.argv[2];
const files = target
  ? [path.join(DIR, `${target}.pdf`)]
  : fs.readdirSync(DIR).filter(f => f.endsWith(".pdf")).map(f => path.join(DIR, f));

for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); continue; }
  processFile(f);
}

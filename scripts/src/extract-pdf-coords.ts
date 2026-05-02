/**
 * extract-pdf-coords.ts  — simple regex-based SINAN PDF text extractor
 * Run: pnpm --filter @workspace/scripts run extract-pdf-coords [template]
 */
import * as fs   from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, "../../artifacts/upa-system/public/pdf-templates");

// ── stream extraction ──────────────────────────────────────────────────────────

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
    // try decompress, fall back to raw
    let text: string;
    try { text = zlib.inflateSync(raw).toString("latin1"); }
    catch {
      try { text = zlib.inflateRawSync(raw).toString("latin1"); }
      catch { text = raw.toString("latin1"); }
    }
    if (text.includes("BT")) results.push(text);
    off = ei + 9;
  }
  return results;
}

// ── PDF string decoder ─────────────────────────────────────────────────────────

function decodePdfString(s: string): string {
  if (s.startsWith("<") && s.endsWith(">")) {
    const hex = s.slice(1, -1).replace(/\s/g, "");
    let out = "";
    for (let i = 0; i < hex.length; i += 2)
      out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    return out;
  }
  if (s.startsWith("(") && s.endsWith(")")) {
    return s.slice(1, -1)
      .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
      .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  }
  return s;
}

// ── BT block parser ───────────────────────────────────────────────────────────

interface Item { x: number; y: number; text: string; }

function parseBTBlock(block: string): Item[] {
  const items: Item[] = [];
  let x = 0, y = 0;

  // Tokenize: numbers, operators, string literals
  // We process line by line to keep it simple and fast
  const lines = block.split(/\n|\r\n?/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Tm: a b c d e f Tm  → position is (e, f)
    const tm = line.match(/^([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+Tm$/);
    if (tm) { x = parseFloat(tm[5]); y = parseFloat(tm[6]); continue; }

    // Td / TD: tx ty Td
    const td = line.match(/^([\d.\-]+)\s+([\d.\-]+)\s+TD?$/);
    if (td) { x += parseFloat(td[1]); y += parseFloat(td[2]); continue; }

    // Tj: (string) Tj  or  <hex> Tj
    const tj = line.match(/^(\(.*\)|<[0-9a-fA-F]*>)\s+Tj$/);
    if (tj) {
      const text = decodePdfString(tj[1]).replace(/[^\x20-\x7E\u00C0-\u024F]/g, "").trim();
      if (text) items.push({ x: Math.round(x), y: Math.round(y), text });
      continue;
    }

    // TJ: [ ... ] TJ  — extract all strings inside array
    const tji = line.match(/^\[(.+)\]\s+TJ$/s);
    if (tji) {
      // pull out all (...) and <...> fragments
      const frags: string[] = [];
      const inner = tji[1];
      let i = 0;
      while (i < inner.length) {
        if (inner[i] === "(") {
          let s = "(", depth = 0; i++;
          while (i < inner.length) {
            const c = inner[i];
            if (c === "\\") { s += c + inner[i + 1]; i += 2; continue; }
            s += c; i++;
            if (c === "(") depth++;
            else if (c === ")") { if (depth-- <= 0) break; }
          }
          frags.push(decodePdfString(s + ")"));
        } else if (inner[i] === "<") {
          let s = "<"; i++;
          while (i < inner.length && inner[i] !== ">") { s += inner[i]; i++; }
          frags.push(decodePdfString(s + ">")); i++;
        } else { i++; }
      }
      const text = frags.join("").replace(/[^\x20-\x7E\u00C0-\u024F]/g, "").trim();
      if (text) items.push({ x: Math.round(x), y: Math.round(y), text });
      continue;
    }

    // ' operator: (string) '
    const apos = line.match(/^(\(.*\)|<[0-9a-fA-F]*>)\s+'$/);
    if (apos) {
      const text = decodePdfString(apos[1]).replace(/[^\x20-\x7E\u00C0-\u024F]/g, "").trim();
      if (text) items.push({ x: Math.round(x), y: Math.round(y), text });
      continue;
    }
  }
  return items;
}

// ── extract all BT…ET blocks ──────────────────────────────────────────────────

function extractItems(content: string): Item[] {
  const all: Item[] = [];
  // Split on BT/ET
  const parts = content.split(/\bBT\b/);
  for (let i = 1; i < parts.length; i++) {
    const et = parts[i].indexOf("ET");
    const block = et !== -1 ? parts[i].slice(0, et) : parts[i];
    all.push(...parseBTBlock(block));
  }
  return all;
}

// ── main ──────────────────────────────────────────────────────────────────────

function processFile(file: string) {
  const buf = fs.readFileSync(file);
  const streams = extractStreams(buf);
  const allItems: Item[] = [];
  for (const s of streams) allItems.push(...extractItems(s));

  // deduplicate by (x, y, text)
  const seen = new Set<string>();
  const uniq = allItems.filter(it => {
    const k = `${it.x}|${it.y}|${it.text}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  // sort top-to-bottom (higher y = higher on page in pdf-lib coords)
  uniq.sort((a, b) => b.y - a.y || a.x - b.x);

  console.log(`\n${"=".repeat(72)}`);
  console.log(`FILE: ${path.basename(file)}`);
  console.log("=".repeat(72));
  console.log(`   X      Y   TEXT`);
  console.log("-".repeat(72));
  for (const it of uniq) {
    const t = it.text.length > 56 ? it.text.slice(0, 53) + "..." : it.text;
    console.log(`${String(it.x).padStart(5)}  ${String(it.y).padStart(5)}  ${t}`);
  }
  console.log(`(${uniq.length} items)`);
}

const target = process.argv[2];
const files = target
  ? [path.join(TEMPLATES_DIR, `${target}.pdf`)]
  : fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".pdf")).map(f => path.join(TEMPLATES_DIR, f));

for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); continue; }
  processFile(f);
}

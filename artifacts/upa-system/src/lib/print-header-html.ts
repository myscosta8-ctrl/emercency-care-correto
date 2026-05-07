// ── Cabeçalho institucional padronizado para documentos internos ─────────────
// Gera uma string HTML completa com logos, nome da instituição e grade de dados
// do paciente. Use buildInstitutionalHeader() em qualquer document.write().
// NÃO aplicar a PDFs externos (APAC, Ficha de Referência, SINAN etc.).

export interface PrintPatientInfo {
  full_name: string;
  prontuarioNumber?: string | null;
  atendimentoNumber?: string | null;
  motherName?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  age?: number | null;
  rg?: string | null;
  cpf?: string | null;
  cns?: string | null;
  phone?: string | null;
  address?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressCep?: string | null;
  sector?: string | null;
  bed?: string | null;
  triageLevel?: string | null;
  careStatus?: string | null;
  responsibleProfessional?: string | null;
  createdAt?: string | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const SECTOR_LABEL: Record<string, string> = {
  triagem:                "Triagem",
  sala_vermelha:          "Sala Vermelha",
  observacao_adulto:      "Obs. Adulto",
  observacao_pediatrica:  "Obs. Pediátrica",
  observacao_pre_adulto:  "Obs. Pré-adulto",
};

const TRIAGE_LABEL: Record<string, string> = {
  red:    "Vermelho — Emergência",
  orange: "Laranja — Muito Urgente",
  yellow: "Amarelo — Urgente",
  green:  "Verde — Pouco Urgente",
  blue:   "Azul — Não Urgente",
};

const TRIAGE_COLOR: Record<string, string> = {
  red: "#dc2626", orange: "#ea580c", yellow: "#b45309", green: "#16a34a", blue: "#2563eb",
};

function esc(s: string | null | undefined): string {
  if (!s) return "—";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return String(iso); }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
}

function sexLabel(s: string | null | undefined): string {
  if (s === "M") return "Masculino";
  if (s === "F") return "Feminino";
  if (s === "O") return "Outro";
  return "—";
}

function compositeAddress(p: PrintPatientInfo): string {
  const parts: string[] = [];
  if (p.addressStreet) {
    let line = p.addressStreet;
    if (p.addressNumber) line += `, ${p.addressNumber}`;
    if (p.addressNeighborhood) line += ` — ${p.addressNeighborhood}`;
    parts.push(line);
  }
  if (p.addressCity) parts.push(p.addressCity);
  if (p.addressCep) parts.push(`CEP ${p.addressCep}`);
  if (parts.length > 0) return parts.join(" · ");
  return p.address ?? "—";
}

// ── shared CSS ───────────────────────────────────────────────────────────────

export function buildPrintDocStyles(sectionColor = "#1e3a8a"): string {
  return `
body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 20px 28px; margin: 0; }
.doc-meta { font-size: 9pt; color: #444; margin: 0 0 14px; border-bottom: 1px dashed #ccc; padding-bottom: 6px; }
.section { margin-bottom: 14px; }
.section-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: ${sectionColor}; border-bottom: 1.5px solid ${sectionColor}; padding-bottom: 2px; margin-bottom: 6px; }
.section-body { white-space: pre-wrap; line-height: 1.6; min-height: 20px; }
.inline-row { display: flex; gap: 32px; }
.inline-row .section { flex: 1; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.proc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.proc-item { font-size: 10pt; padding: 3px 0; }
.metrics { display: flex; gap: 24px; padding: 8px 12px; background: #f0fdf4; border-radius: 4px; border: 1px solid #bbf7d0; margin-bottom: 14px; }
.metric { text-align: center; }
.metric-val { font-size: 18pt; font-weight: 700; color: ${sectionColor}; }
.metric-label { font-size: 8pt; color: #6b7280; text-transform: uppercase; }
.sig-area { margin-top: 48px; text-align: center; }
.sig-line { border-top: 1.5px solid #111; width: 60%; margin: 0 auto 4px; padding-top: 4px; font-size: 10pt; }
.sig-sub { font-size: 9pt; color: #555; }
@media print { @page { size: A4; margin: 12mm; } }
  `.trim();
}

// ── main export ──────────────────────────────────────────────────────────────

/**
 * Gera o HTML do cabeçalho institucional padronizado.
 *
 * @param patient  - dados do paciente (null/undefined = sem grade de paciente)
 * @param title    - título do documento (ex: "EVOLUÇÃO MÉDICA")
 * @param baseUrl  - prefixo de URL para logos (padrão: "/")
 */
export function buildInstitutionalHeader(
  patient: PrintPatientInfo | null | undefined,
  title: string,
  baseUrl = "/",
): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const logoUpa  = `${base}logos/upa24h.jpg`;
  const logoPref = `${base}logos/prefeitura-breves.jpeg`;
  const logoSemsa = `${base}logos/semsa.jpeg`;

  const now = new Date();
  const emittedStr = now.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const triageLabel = patient?.triageLevel ? (TRIAGE_LABEL[patient.triageLevel] ?? "—") : "—";
  const triageColor = patient?.triageLevel ? (TRIAGE_COLOR[patient.triageLevel] ?? "#6b7280") : "#6b7280";
  const sectorLabel = patient?.sector ? (SECTOR_LABEL[patient.sector] ?? patient.sector) : "—";
  const fullAddress = patient ? esc(compositeAddress(patient)) : "—";

  const C = "border:1px solid #aaa; padding:2px 6px; font-size:7.5pt; vertical-align:top;";
  const L = "font-weight:700; font-size:6pt; color:#444; text-transform:uppercase; letter-spacing:0.04em; display:block; margin-bottom:1px;";
  const V = "font-size:8pt; color:#000; font-weight:600;";

  const cell = (label: string, value: string, extra = "") =>
    `<td style="${C}${extra}"><span style="${L}">${label}</span><span style="${V}">${value}</span></td>`;

  const patientGrid = patient ? `
<table style="width:100%; border-collapse:collapse; margin-top:4pt;">
  <tbody>
    <tr>
      ${cell("Prontuário", esc(patient.prontuarioNumber), "width:10%")}
      ${cell("Nº Atendimento", esc(patient.atendimentoNumber), "width:10%")}
      ${cell("Nome completo do paciente", `<span style="font-size:9pt;font-weight:800;">${esc(patient.full_name)}</span>`, "width:44%")}
      ${cell("Nome da Mãe", esc(patient.motherName), "width:36%")}
    </tr>
    <tr>
      ${cell("Data de Nascimento", fmtDate(patient.birthDate))}
      ${cell("Sexo", sexLabel(patient.sex))}
      ${cell("Idade", patient.age != null ? `${patient.age} anos` : "—")}
      ${cell("Data de Internação", fmtDateTime(patient.createdAt))}
      ${cell("Data da Ficha", fmtDate(now.toISOString()))}
    </tr>
    <tr>
      ${cell("R.G.", esc(patient.rg))}
      ${cell("C.P.F.", esc(patient.cpf))}
      ${cell("C.N.S. / SUS", esc(patient.cns))}
      ${cell("Telefone", esc(patient.phone))}
      ${cell("Convênio / Plano", "SUS")}
    </tr>
    <tr>
      ${cell("Setor / Quarto", sectorLabel)}
      ${cell("Leito", esc(patient.bed))}
      ${cell("Caráter do Atendimento", "Urgência / Emergência")}
      ${cell("Recepção", "UPA Breves")}
      ${cell("Unidade", "UPA 24H — Breves")}
    </tr>
    <tr>
      <td colspan="2" style="${C}">
        <span style="${L}">Classificação de Risco (Manchester)</span>
        <span style="${V} color:${triageColor}; font-weight:800;">${triageLabel}</span>
      </td>
      ${cell("Situação Atual", esc(patient.careStatus))}
      <td colspan="2" style="${C}">
        <span style="${L}">Profissional Responsável</span>
        <span style="${V}">${esc(patient.responsibleProfessional)}</span>
      </td>
    </tr>
    <tr>
      <td colspan="5" style="${C}">
        <span style="${L}">Endereço completo</span>
        <span style="${V}">${fullAddress}</span>
      </td>
    </tr>
  </tbody>
</table>` : "";

  return `
<div style="font-family:Arial,Helvetica,sans-serif; margin-bottom:10pt;">

  <!-- Logos + título -->
  <table style="width:100%; border-collapse:collapse; margin-bottom:4pt;">
    <tbody>
      <tr>
        <td style="width:16%; text-align:center; vertical-align:middle; padding:0 4px;">
          <img src="${logoPref}" alt="Prefeitura de Breves" style="height:44px; object-fit:contain;" />
        </td>
        <td style="text-align:center; vertical-align:middle; padding:2px 8px;">
          <div style="font-size:12pt; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:#000;">UPA 24H — BREVES</div>
          <div style="font-size:8pt; color:#444; margin-top:1pt;">Unidade de Pronto Atendimento · Breves/PA</div>
          <div style="font-size:8pt; color:#444;">Secretaria Municipal de Saúde — SEMSA</div>
          <div style="font-size:10pt; font-weight:700; margin-top:3pt; text-transform:uppercase; letter-spacing:0.05em; color:#000;">${esc(title)}</div>
        </td>
        <td style="width:16%; text-align:center; vertical-align:middle; padding:0 4px;">
          <img src="${logoUpa}" alt="UPA 24h" style="height:44px; object-fit:contain;" />
        </td>
        <td style="width:13%; text-align:center; vertical-align:middle; padding:0 4px;">
          <img src="${logoSemsa}" alt="SEMSA" style="height:44px; object-fit:contain;" />
        </td>
      </tr>
    </tbody>
  </table>

  <div style="border-top:2px solid #222; border-bottom:1px solid #999; margin-bottom:4pt;"></div>

  ${patientGrid}

  <div style="border-bottom:1.5px solid #444; margin-top:${patient ? "4pt" : "0"};"></div>

  <div style="text-align:right; font-size:7pt; color:#888; margin-top:2pt;">Emitido em: ${emittedStr}</div>
</div>`.trim();
}

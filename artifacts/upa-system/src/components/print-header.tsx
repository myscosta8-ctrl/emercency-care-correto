import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PrintPatientData {
  full_name: string;
  prontuarioNumber?: string;
  atendimentoNumber?: string;
  motherName?: string;
  birthDate?: string;
  age?: number;
  sex?: string;
  cpf?: string;
  cns?: string;
  rg?: string;
  phone?: string;
  address?: string;
  bed?: string;
  sector?: string;
  attendanceDate?: string;
  attendanceTime?: string;
  careStatus?: string;
}

interface PrintHeaderProps {
  baseUrl?: string;
  title?: string;
  patient?: PrintPatientData;
  emittedAt?: Date;
}

const SECTOR_LABEL: Record<string, string> = {
  sala_vermelha:          "Sala Vermelha",
  observacao_adulto:      "Obs. Adulto",
  observacao_pediatrica:  "Obs. Pediátrica",
  observacao_pre_adulto:  "Obs. Pré-adulto",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}

function sexLabel(s?: string) {
  if (!s) return "—";
  if (s === "M") return "Masculino";
  if (s === "F") return "Feminino";
  return s;
}

const cell: React.CSSProperties = {
  border: "1px solid #555",
  padding: "2px 5px",
  fontSize: "7.5pt",
  lineHeight: "1.3",
  verticalAlign: "top",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "6.5pt",
  color: "#333",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  display: "block",
  marginBottom: "1px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "8pt",
  color: "#000",
  fontWeight: 600,
};

function Cell({ label, value, style }: { label: string; value?: string | null; style?: React.CSSProperties }) {
  return (
    <td style={{ ...cell, ...style }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value || "—"}</span>
    </td>
  );
}

export function PrintHeader({ baseUrl = "/", title, patient, emittedAt }: PrintHeaderProps) {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const logoUpa    = `${base}logos/upa24h.jpg`;
  const logoPref   = `${base}logos/prefeitura-breves.jpeg`;
  const logoSemsa  = `${base}logos/semsa.jpeg`;

  const emitted = emittedAt ?? new Date();

  const internacao = [patient?.attendanceDate ? fmtDate(patient.attendanceDate) : "", patient?.attendanceTime || ""]
    .filter(Boolean).join(" ");

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", marginBottom: "10pt" }}>

      {/* ── Row 1: logos + title ─────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4pt" }}>
        <tbody>
          <tr>
            {/* Prefeitura de Breves */}
            <td style={{ width: "16%", textAlign: "center", verticalAlign: "middle", padding: "0 4px" }}>
              <img
                src={logoPref}
                alt="Prefeitura de Breves"
                style={{ height: "44px", objectFit: "contain" }}
              />
            </td>

            {/* Institution name (center) */}
            <td style={{ textAlign: "center", verticalAlign: "middle", padding: "2px 8px" }}>
              <div style={{ fontSize: "12pt", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#000" }}>
                UPA 24H — BREVES
              </div>
              <div style={{ fontSize: "8pt", color: "#444", marginTop: "1pt" }}>
                Unidade de Pronto Atendimento · Breves/PA
              </div>
              <div style={{ fontSize: "8pt", color: "#444" }}>
                Secretaria Municipal de Saúde — SEMSA
              </div>
              {title && (
                <div style={{ fontSize: "10pt", fontWeight: 700, marginTop: "3pt", textTransform: "uppercase", letterSpacing: "0.05em", color: "#000" }}>
                  {title}
                </div>
              )}
            </td>

            {/* UPA 24h logo */}
            <td style={{ width: "16%", textAlign: "center", verticalAlign: "middle", padding: "0 4px" }}>
              <img
                src={logoUpa}
                alt="UPA 24h"
                style={{ height: "44px", objectFit: "contain" }}
              />
            </td>

            {/* SEMSA */}
            <td style={{ width: "13%", textAlign: "center", verticalAlign: "middle", padding: "0 4px" }}>
              <img
                src={logoSemsa}
                alt="SEMSA"
                style={{ height: "44px", objectFit: "contain" }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: "2px solid #222", borderBottom: "1px solid #999", marginBottom: "4pt" }} />

      {/* ── Row 2: patient data grid (only when patient is provided) ─── */}
      {patient && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {/* Row A */}
            <tr>
              <Cell label="Prontuário" value={patient.prontuarioNumber} style={{ width: "13%" }} />
              <Cell label="Atendimento" value={patient.atendimentoNumber} style={{ width: "13%" }} />
              <Cell label="Paciente" value={patient.full_name} style={{ width: "42%", fontWeight: 700 }} />
              <Cell label="Nome da Mãe" value={patient.motherName} style={{ width: "32%" }} />
            </tr>

            {/* Row B */}
            <tr>
              <Cell label="Data Nasc." value={fmtDate(patient.birthDate)} />
              <Cell label="Sexo" value={sexLabel(patient.sex)} />
              <Cell label="Idade" value={patient.age ? `${patient.age} ano${patient.age !== 1 ? "s" : ""}` : undefined} />
              <Cell label="Data Internação" value={internacao || undefined} />
            </tr>

            {/* Row C */}
            <tr>
              <Cell label="C.P.F." value={patient.cpf} />
              <Cell label="C.N.S." value={patient.cns} />
              <Cell label="R.G." value={patient.rg} />
              <Cell label="Telefone" value={patient.phone} />
            </tr>

            {/* Row D */}
            <tr>
              <Cell label="Leito" value={patient.bed} />
              <Cell label="Setor / Quarto" value={SECTOR_LABEL[patient.sector ?? ""] || patient.sector} />
              <Cell label="Situação" value={patient.careStatus} />
              <Cell
                label="Emitido em"
                value={format(emitted, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              />
            </tr>

            {/* Row E: full-width address */}
            <tr>
              <td colSpan={4} style={{ ...cell }}>
                <span style={labelStyle}>Endereço</span>
                <span style={valueStyle}>{patient.address || "—"}</span>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* bottom rule */}
      <div style={{ borderBottom: "1.5px solid #444", marginTop: patient ? "4pt" : "0" }} />
    </div>
  );
}

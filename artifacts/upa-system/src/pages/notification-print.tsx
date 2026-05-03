import { useRoute } from "wouter";
import {
  useGetPatient,
  useGetPatientNotifications,
  getGetPatientQueryKey,
  getGetPatientNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Patient, PatientNotification } from "@workspace/api-client-react";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { downloadSinanPdf } from "@/lib/pdf-fill";

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = s.slice(0, 10).split("-");
  if (d.length < 3) return s;
  return `${d[2]}/${d[1]}/${d[0]}`;
}
function fmtDatetime(s?: string | null): string {
  if (!s) return "";
  const [date, time] = s.split("T");
  return `${fmtDate(date)}${time ? "  " + time.slice(0, 5) : ""}`;
}
function parseTypes(types: string): string[] {
  try { return JSON.parse(types) as string[]; } catch { return []; }
}

// ── constants ─────────────────────────────────────────────────────────────────

interface FormMeta {
  title: string;
  subtitle?: string;
  cid: string;
  definition: string;
}

const FORM_META: Record<string, FormMeta> = {
  dengue: {
    title: "FICHA DE INVESTIGAÇÃO  DENGUE E FEBRE DE CHIKUNGUNYA",
    cid: "A90 / A92",
    definition:
      "Caso suspeito de dengue: pessoa que viva ou tenha viajado nos últimos 14 dias para área onde esteja ocorrendo transmissão de dengue ou tenha presença de Ae.aegypti, que apresente febre, usualmente entre 2 e 7 dias, e apresente duas ou mais das seguintes manifestações: náuseas, vômitos, exantema, mialgias, cefaléia, dor retroorbital, petéquias ou prova do laço positiva e leucopenia.",
  },
  covid19: {
    title: "FICHA DE NOTIFICAÇÃO — SG SUSPEITO DE DOENÇA PELO CORONAVÍRUS 2019 – COVID-19",
    cid: "B34.2",
    definition:
      "Definição de caso: Indivíduo com quadro respiratório agudo, caracterizado por pelo menos dois (2) dos seguintes sinais e sintomas: febre (mesmo que referida), calafrios, dor de garganta, dor de cabeça, tosse, coriza, distúrbios olfativos ou distúrbios gustativos.",
  },
  tuberculose: {
    title: "FICHA DE NOTIFICAÇÃO / INVESTIGAÇÃO — TUBERCULOSE",
    cid: "A16.9",
    definition:
      "Critério Clínico-Epidemiológico: é todo caso que não preenche o critério de confirmação laboratorial, mas que recebeu o diagnóstico de tuberculose ativa.",
  },
  violencia: {
    title: "FICHA DE NOTIFICAÇÃO / INVESTIGAÇÃO — VIOLÊNCIA DOMÉSTICA, SEXUAL E/OU OUTRAS VIOLÊNCIAS",
    cid: "T74 / Z04.8",
    definition:
      "Notificação compulsória de violências domésticas, sexuais e/ou outras violências interpessoais, conforme Portaria MS/GM nº 204/2016.",
  },
  outros: {
    title: "FICHA DE NOTIFICAÇÃO INDIVIDUAL",
    cid: "",
    definition:
      "Notificação individual de agravo de interesse à saúde pública, conforme legislação vigente (Lei nº 6.259/1975 e Decreto nº 78.321/1976).",
  },
};

const DENGUE_SINAIS = [
  "Febre", "Cefaleia", "Vômito", "Dor nas costas", "Artrite", "Petéquias", "Prova do laço positiva",
  "Mialgia", "Exantema", "Náuseas", "Conjuntivite", "Artralgia intensa", "Leucopenia", "Dor retroorbital",
];
const DENGUE_DOENCAS = [
  "Diabetes", "Hepatopatias", "Hipertensão arterial", "Doenças auto-imunes",
  "Doenças hematológicas", "Doença renal crônica", "Doença ácido-péptica",
];
const COVID_SINTOMAS = [
  "Assintomático", "Febre", "Dor de Garganta", "Dispneia", "Tosse", "Coriza",
  "Dor de Cabeça", "Distúrbios gustativos", "Distúrbios olfativos",
];
const COVID_CONDICOES = [
  "Doenças respiratórias crônicas descompensadas", "Doenças renais crônicas em estágio avançado (graus 3, 4 e 5)",
  "Portador de doenças cromossômicas ou estado de fragilidade imunológica", "Doenças cardíacas crônicas",
  "Diabetes", "Imunossupressão", "Obesidade", "Gestante", "Puérpera (até 45 dias do parto)",
];
const TB_FORMAS = ["1 - Pulmonar", "2 - Extrapulmonar", "3 - Pulmonar + Extrapulmonar"];
const TB_AGRAVOS = ["Aids", "Alcoolismo", "Diabetes", "Doença Mental", "Uso de Drogas Ilícitas", "Tabagismo"];

// ── print-only inline style ───────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "9pt",
    color: "#000",
    background: "#fff",
    lineHeight: "1.25",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #000",
    paddingBottom: "4pt",
    marginBottom: "4pt",
  } as React.CSSProperties,
  formTitle: {
    textAlign: "center" as const,
    fontWeight: 700,
    fontSize: "10pt",
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
    padding: "4pt 0",
    borderBottom: "1px solid #000",
    marginBottom: "4pt",
  } as React.CSSProperties,
  definition: {
    fontSize: "7.5pt",
    padding: "4pt 6pt",
    border: "1px solid #888",
    marginBottom: "4pt",
    background: "#f9f9f9",
  } as React.CSSProperties,
  sectionLabel: {
    writingMode: "vertical-rl" as const,
    transform: "rotate(180deg)",
    fontWeight: 700,
    fontSize: "7pt",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    background: "#ddd",
    padding: "4pt 2pt",
    textAlign: "center" as const,
  } as React.CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "4pt",
  } as React.CSSProperties,
  td: {
    border: "1px solid #000",
    padding: "2pt 4pt",
    verticalAlign: "top" as const,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: "7pt",
    color: "#444",
    display: "block",
    marginBottom: "1pt",
    fontWeight: 600,
  } as React.CSSProperties,
  fieldValue: {
    fontWeight: 700,
    fontSize: "9pt",
    minHeight: "12pt",
    display: "block",
    borderBottom: "1px solid #888",
  } as React.CSSProperties,
  fieldEmpty: {
    fontWeight: 400,
    fontSize: "9pt",
    minHeight: "12pt",
    display: "block",
    borderBottom: "1px solid #888",
    color: "#bbb",
  } as React.CSSProperties,
  checkRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "4pt 12pt",
    padding: "2pt 4pt",
  } as React.CSSProperties,
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: "3pt",
    fontSize: "8pt",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  checkBox: (checked: boolean): React.CSSProperties => ({
    display: "inline-block",
    width: "10pt",
    height: "10pt",
    border: "1pt solid #000",
    background: checked ? "#000" : "#fff",
    flexShrink: 0,
  }),
  noprint: {
    display: "flex",
    gap: "8px",
    padding: "16px",
    background: "#1a1a1a",
    borderBottom: "1px solid #333",
    alignItems: "center",
  } as React.CSSProperties,
};

// ── sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, colSpan = 1, width }: { label: string; value?: string | null; colSpan?: number; width?: string }) {
  return (
    <td style={{ ...S.td, ...(width ? { width } : {}), ...(colSpan > 1 ? { colSpan } : {}) }} colSpan={colSpan}>
      <span style={S.fieldLabel}>{label}</span>
      {value
        ? <span style={S.fieldValue}>{value}</span>
        : <span style={S.fieldEmpty}>___</span>
      }
    </td>
  );
}

function CheckItem({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <span style={S.checkItem}>
      <span style={S.checkBox(checked)} />
      {label}
    </span>
  );
}

function SectionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ ...S.td, padding: 0, width: "20pt", background: "#e8e8e8" }}>
        <div style={S.sectionLabel}>{label}</div>
      </td>
      <td style={{ ...S.td, padding: 0 }}>
        {children}
      </td>
    </tr>
  );
}

// ── common sections ───────────────────────────────────────────────────────────

function HeaderSINAN({ meta, notifDate }: { meta: FormMeta; notifDate: string }) {
  return (
    <>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: "7.5pt", fontWeight: 700 }}>República Federativa do Brasil</div>
          <div style={{ fontSize: "7.5pt", fontWeight: 700 }}>Ministério da Saúde</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: "12pt", letterSpacing: "0.1em" }}>SINAN</div>
          <div style={{ fontSize: "7pt", fontWeight: 700, letterSpacing: "0.05em" }}>
            SISTEMA DE INFORMAÇÃO DE AGRAVOS DE NOTIFICAÇÃO
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: "8pt" }}>
          <span style={{ fontWeight: 700 }}>Nº </span>
          <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "60pt" }} />
        </div>
      </div>
      <div style={S.formTitle}>{meta.title}</div>
      {meta.definition && (
        <div style={S.definition}>{meta.definition}</div>
      )}
    </>
  );
}

function DadosGerais({ meta, notifDate, symptomDate }: {
  meta: FormMeta; notifDate: string; symptomDate: string;
}) {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={{ ...S.sectionLabel, writingMode: "vertical-rl", transform: "rotate(180deg)", padding: "6pt 2pt" }}>
              Dados Gerais
            </div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={{ ...S.td, width: "30%" }}>
                    <span style={S.fieldLabel}>1 Tipo de Notificação</span>
                    <span style={{ fontWeight: 700, fontSize: "8pt" }}>&#x2611; 2 — Individual</span>
                  </td>
                  <td style={{ ...S.td, width: "30%" }}>
                    <span style={S.fieldLabel}>2 Agravo/doença</span>
                    <span style={{ fontWeight: 700 }}>{
                      meta.title.includes("DENGUE") ? "1 — DENGUE"
                      : meta.title.includes("COVID") ? "COVID-19"
                      : meta.title.includes("TUBERCULOSE") ? "TUBERCULOSE"
                      : meta.title.includes("VIOLÊN") ? "VIOLÊNCIA"
                      : "NOTIFICAÇÃO INDIVIDUAL"
                    }</span>
                  </td>
                  <td style={{ ...S.td, width: "20%" }}>
                    <span style={S.fieldLabel}>Código (CID10)</span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{meta.cid}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>3 Data da Notificação</span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{notifDate || "  /  /    "}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...S.td, width: "8%" }}>
                    <span style={S.fieldLabel}>4 UF</span>
                    <span style={{ fontWeight: 700 }}>PA</span>
                  </td>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>5 Município de Notificação</span>
                    <span style={{ fontWeight: 700 }}>Breves</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>Código IBGE</span>
                    <span style={S.fieldEmpty}>___________</span>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={3}>
                    <span style={S.fieldLabel}>6 Unidade de Saúde (ou outra fonte notificadora)</span>
                    <span style={{ fontWeight: 700 }}>UPA Breves</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>7 Data dos Primeiros Sintomas</span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{symptomDate || "  /  /    "}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function NotificacaoIndividual({ patient }: { patient: Patient }) {
  const sexLabel = patient.sex === "M" ? "M — Masculino" : patient.sex === "F" ? "F — Feminino" : "I — Ignorado";
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Notificação Individual</div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={S.td} colSpan={3}>
                    <span style={S.fieldLabel}>8 Nome do Paciente</span>
                    <span style={S.fieldValue}>{patient.full_name}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>9 Data de Nascimento</span>
                    <span style={{ ...(patient.birthDate ? S.fieldValue : S.fieldEmpty), fontFamily: "monospace" }}>
                      {patient.birthDate ? fmtDate(patient.birthDate) : "__/__/____"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...S.td, width: "20%" }}>
                    <span style={S.fieldLabel}>10 Idade</span>
                    <span style={{ fontWeight: 700 }}>{patient.age ?? "—"} anos</span>
                  </td>
                  <td style={{ ...S.td, width: "25%" }}>
                    <span style={S.fieldLabel}>11 Sexo</span>
                    <span style={{ fontWeight: 700 }}>{sexLabel}</span>
                  </td>
                  <td style={{ ...S.td, width: "25%" }}>
                    <span style={S.fieldLabel}>12 Gestante</span>
                    <span style={S.fieldEmpty}>5 — Não / Ignorado</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>13 Raça/Cor</span>
                    <span style={S.fieldEmpty}>9 — Ignorado</span>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={4}>
                    <span style={S.fieldLabel}>14 Escolaridade</span>
                    <span style={S.fieldEmpty}>9 — Ignorado</span>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>15 Número do Cartão SUS (CNS)</span>
                    <span style={{ ...(patient.cns ? S.fieldValue : S.fieldEmpty), fontFamily: "monospace" }}>
                      {patient.cns || "_ _ _ _ _ _ _ _ _ _ _ _ _ _"}
                    </span>
                  </td>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>16 Nome da mãe</span>
                    <span style={patient.motherName ? S.fieldValue : S.fieldEmpty}>
                      {patient.motherName || "___"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function DadosResidencia({ patient }: { patient: Patient }) {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Dados de Residência</div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={{ ...S.td, width: "8%" }}>
                    <span style={S.fieldLabel}>17 UF</span>
                    <span style={S.fieldEmpty}>__</span>
                  </td>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>18 Município de Residência</span>
                    <span style={patient.municipioNotificacao ? S.fieldValue : S.fieldEmpty}>
                      {patient.municipioNotificacao || "___"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>19 Distrito</span>
                    <span style={S.fieldEmpty}>___</span>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>20 Bairro</span>
                    <span style={S.fieldEmpty}>___</span>
                  </td>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>21 Logradouro (endereço)</span>
                    <span style={patient.address ? S.fieldValue : S.fieldEmpty}>
                      {patient.address || "___"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...S.td, width: "15%" }}>
                    <span style={S.fieldLabel}>22 Número</span>
                    <span style={S.fieldEmpty}>___</span>
                  </td>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>23 Complemento (apto., casa,...)</span>
                    <span style={S.fieldEmpty}>___</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>27 CEP</span>
                    <span style={{ ...S.fieldEmpty, fontFamily: "monospace" }}>_ _ _ _ _-_ _ _</span>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>28 (DDD) Telefone</span>
                    <span style={{ ...(patient.phone ? S.fieldValue : S.fieldEmpty), fontFamily: "monospace" }}>
                      {patient.phone || "(___)_________"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>29 Zona</span>
                    <span style={S.fieldEmpty}>&#x25A1; 1-Urbana  &#x25A1; 2-Rural  &#x25A1; 3-Periurbana</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>30 País (se fora do Brasil)</span>
                    <span style={S.fieldEmpty}>___</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── disease-specific sections ─────────────────────────────────────────────────

function SectionDengue({ diagnosis }: { diagnosis?: string | null }) {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Dados Clínicos</div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={S.fieldLabel}>32 Ocupação</span>
                    <span style={S.fieldEmpty}>___</span>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={{ ...S.fieldLabel, fontSize: "8pt", fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      33 Sinais clínicos (1-Sim / 2-Não)
                    </span>
                    <div style={S.checkRow}>
                      {DENGUE_SINAIS.map(s => <CheckItem key={s} label={s} />)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={{ ...S.fieldLabel, fontSize: "8pt", fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      34 Doenças pré-existentes (1-Sim / 2-Não)
                    </span>
                    <div style={S.checkRow}>
                      {DENGUE_DOENCAS.map(s => <CheckItem key={s} label={s} />)}
                    </div>
                  </td>
                </tr>
                {diagnosis && (
                  <tr>
                    <td style={S.td} colSpan={2}>
                      <span style={S.fieldLabel}>Hipótese/Diagnóstico (da UPA)</span>
                      <span style={S.fieldValue}>{diagnosis}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SectionCovid({ diagnosis }: { diagnosis?: string | null }) {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Dados Clínicos</div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={{ ...S.fieldLabel, fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      Sintomas (Marcar X)
                    </span>
                    <div style={S.checkRow}>
                      {COVID_SINTOMAS.map(s => <CheckItem key={s} label={s} />)}
                      <CheckItem label="Outros___________" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={S.td} colSpan={2}>
                    <span style={{ ...S.fieldLabel, fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      Condições (Marcar X)
                    </span>
                    <div style={S.checkRow}>
                      {COVID_CONDICOES.map(s => <CheckItem key={s} label={s} />)}
                    </div>
                  </td>
                </tr>
                {diagnosis && (
                  <tr>
                    <td style={S.td} colSpan={2}>
                      <span style={S.fieldLabel}>Hipótese/Diagnóstico (da UPA)</span>
                      <span style={S.fieldValue}>{diagnosis}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SectionTuberculose({ diagnosis }: { diagnosis?: string | null }) {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Dados Clínicos</div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={S.td}>
                    <span style={S.fieldLabel}>32 Tipo de Entrada</span>
                    <div style={S.checkRow}>
                      {["1 - Caso Novo", "2 - Recidiva", "3 - Reingresso Após Abandono", "4 - Não Sabe", "5 - Transferência"].map(s => (
                        <CheckItem key={s} label={s} />
                      ))}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={S.td}>
                    <span style={{ ...S.fieldLabel, fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      35 Forma
                    </span>
                    <div style={S.checkRow}>
                      {TB_FORMAS.map(s => <CheckItem key={s} label={s} />)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={S.td}>
                    <span style={{ ...S.fieldLabel, fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      37 Doenças e Agravos Associados (1-Sim / 2-Não / 9-Ignorado)
                    </span>
                    <div style={S.checkRow}>
                      {TB_AGRAVOS.map(s => <CheckItem key={s} label={s} />)}
                    </div>
                  </td>
                </tr>
                {diagnosis && (
                  <tr>
                    <td style={S.td}>
                      <span style={S.fieldLabel}>Hipótese/Diagnóstico (da UPA)</span>
                      <span style={S.fieldValue}>{diagnosis}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SectionGeneric({ diagnosis }: { diagnosis?: string | null }) {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Dados Clínicos</div>
          </td>
          <td style={S.td}>
            <span style={S.fieldLabel}>Hipótese Diagnóstica (CID10)</span>
            <span style={diagnosis ? S.fieldValue : S.fieldEmpty}>{diagnosis || "___"}</span>
          </td>
        </tr>
        <tr>
          <td colSpan={2} style={{ ...S.td, height: "50pt" }}>
            <span style={S.fieldLabel}>Informações complementares e observações</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Encerramento() {
  return (
    <table style={S.table}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "24pt", background: "#ddd", padding: 0 }}>
            <div style={S.sectionLabel}>Encerramento</div>
          </td>
          <td style={{ ...S.td, padding: 0 }}>
            <table style={{ ...S.table, marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td style={S.td}>
                    <span style={{ ...S.fieldLabel, fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      Evolução do caso (Marcar X)
                    </span>
                    <div style={S.checkRow}>
                      {["Cancelado", "Em tratamento domiciliar", "Internado", "Internado em UTI", "Óbito", "Cura", "Ignorado"].map(s => (
                        <CheckItem key={s} label={s} />
                      ))}
                    </div>
                  </td>
                  <td style={S.td}>
                    <span style={{ ...S.fieldLabel, fontWeight: 700, marginBottom: "4pt", display: "block" }}>
                      Classificação final (Marcar X)
                    </span>
                    <div style={S.checkRow}>
                      {["Descartado", "Confirmado Laboratorial", "Confirmado Clínico-Epidemiológico", "Confirmado Clínico-Imagem"].map(s => (
                        <CheckItem key={s} label={s} />
                      ))}
                    </div>
                  </td>
                  <td style={{ ...S.td, width: "22%" }}>
                    <span style={S.fieldLabel}>Data de encerramento</span>
                    <span style={S.fieldEmpty}>__/__/____</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Assinatura({ responsible }: { responsible?: string | null }) {
  return (
    <table style={{ ...S.table, marginTop: "12pt" }}>
      <tbody>
        <tr>
          <td style={{ ...S.td, width: "40%", paddingTop: "20pt", textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4pt", fontSize: "8pt" }}>
              Assinatura do Profissional Notificante
            </div>
          </td>
          <td style={{ ...S.td, paddingTop: "20pt", textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4pt", fontSize: "8pt" }}>
              {responsible ? <span style={{ fontWeight: 700 }}>{responsible}</span> : "Nome/Função"}
            </div>
          </td>
          <td style={{ ...S.td, width: "30%", paddingTop: "20pt", textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4pt", fontSize: "8pt" }}>
              Data de Preenchimento
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function UpaDataBox({ patient, notif, types }: { patient: Patient; notif: PatientNotification; types: string[] }) {
  const TYPE_LABELS: Record<string, string> = {
    dengue: "Dengue", covid19: "COVID-19", tuberculose: "Tuberculose",
    violencia: "Violência", outros: notif.otherType || "Outros",
  };
  return (
    <div style={{ border: "2px dashed #666", padding: "6pt", marginTop: "10pt", background: "#fafafa", pageBreakInside: "avoid" }}>
      <div style={{ fontWeight: 700, fontSize: "9pt", marginBottom: "4pt", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        ▶ Dados do Atendimento — UPA Breves
      </div>
      <table style={{ ...S.table, marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={S.td}>
              <span style={S.fieldLabel}>Tipo(s) de Notificação</span>
              <span style={{ fontWeight: 700 }}>{types.map(t => TYPE_LABELS[t] ?? t).join(" / ")}</span>
            </td>
            <td style={S.td}>
              <span style={S.fieldLabel}>Situação</span>
              <span style={{ fontWeight: 700 }}>{notif.situation === "notificado" ? "Notificado" : "Pendente"}</span>
            </td>
            <td style={S.td}>
              <span style={S.fieldLabel}>Data/Hora da Notificação (UPA)</span>
              <span style={{ fontWeight: 700 }}>{notif.notifiedAt ? fmtDatetime(notif.notifiedAt) : "—"}</span>
            </td>
          </tr>
          <tr>
            <td style={S.td}>
              <span style={S.fieldLabel}>Hipótese Diagnóstica (da UPA)</span>
              <span style={{ fontWeight: 700 }}>{notif.diagnosis || patient.diagnosis || "—"}</span>
            </td>
            <td style={S.td}>
              <span style={S.fieldLabel}>Data Início dos Sintomas</span>
              <span style={{ fontWeight: 700 }}>{notif.symptomOnsetDate ? fmtDate(notif.symptomOnsetDate) : "—"}</span>
            </td>
            <td style={S.td}>
              <span style={S.fieldLabel}>Profissional Responsável</span>
              <span style={{ fontWeight: 700 }}>{notif.responsible || "—"}</span>
            </td>
          </tr>
          {patient.cpf && (
            <tr>
              <td style={S.td}>
                <span style={S.fieldLabel}>CPF do Paciente</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{patient.cpf}</span>
              </td>
              <td style={S.td}>
                <span style={S.fieldLabel}>Leito / Setor</span>
                <span style={{ fontWeight: 700 }}>{patient.bed} — {patient.sector}</span>
              </td>
              <td style={S.td}>
                <span style={S.fieldLabel}>Triagem Manchester</span>
                <span style={{ fontWeight: 700 }}>{
                  { red: "Vermelho (Emergência)", orange: "Laranja (Muito Urgente)", yellow: "Amarelo (Urgente)", green: "Verde (Pouco Urgente)", blue: "Azul (Não Urgente)" }[patient.triage_level] ?? patient.triage_level
                }</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function NotificationPrintPage() {
  const [, params] = useRoute("/patients/:id/notifications/:notificationId/print");
  const patientId      = params?.id           ? parseInt(params.id, 10)            : 0;
  const notificationId = params?.notificationId ? parseInt(params.notificationId, 10) : 0;

  const { data: patient, isLoading: loadingPatient } = useGetPatient(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientQueryKey(patientId) },
  });
  const { data: allNotifications, isLoading: loadingNotifications } = useGetPatientNotifications(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientNotificationsQueryKey(patientId) },
  });

  if (loadingPatient || loadingNotifications) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient || !allNotifications) {
    return <div className="p-8 text-center text-muted-foreground">Paciente ou notificação não encontrado.</div>;
  }

  const notif = allNotifications.find(n => n.id === notificationId);
  if (!notif) {
    return <div className="p-8 text-center text-muted-foreground">Notificação não encontrada.</div>;
  }

  const [downloading, setDownloading] = useState(false);

  const types        = parseTypes(notif.types);
  const primaryType  = types[0] ?? "outros";
  const meta         = FORM_META[primaryType] ?? FORM_META.outros;
  const notifDate    = notif.notifiedAt ? fmtDate(notif.notifiedAt) : fmtDate(notif.createdAt);
  const symptomDate  = notif.symptomOnsetDate ? fmtDate(notif.symptomOnsetDate) : "";

  return (
    <>
      {/* ── screen nav bar (hidden in print) ── */}
      <div className="noprint" style={S.noprint}>
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </Button>
        <Button
          size="sm" variant="outline"
          className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            try { await downloadSinanPdf(patient, notif, import.meta.env.BASE_URL); }
            catch (e) { alert(String(e)); }
            finally { setDownloading(false); }
          }}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Gerando…" : "Baixar PDF Preenchido"}
        </Button>
        <span className="text-xs text-gray-400 ml-2">
          Dica: use Ctrl+P → "Salvar como PDF" para exportar o formulário preenchido.
        </span>
      </div>

      {/* ── print-optimized form ── */}
      <div className="print-area" style={{ ...S.page, padding: "12mm 14mm" }}>

        {/* Each type gets its own sheet if multiple are selected */}
        {types.map((type, idx) => {
          const m       = FORM_META[type] ?? FORM_META.outros;
          const isFirst = idx === 0;
          return (
            <div key={type} style={{ pageBreakBefore: isFirst ? "auto" : "always" }}>
              <HeaderSINAN meta={m} notifDate={notifDate} />
              <DadosGerais meta={m} notifDate={notifDate} symptomDate={symptomDate} />
              <NotificacaoIndividual patient={patient} />
              <DadosResidencia patient={patient} />

              {/* disease-specific clinical data */}
              {type === "dengue"      && <SectionDengue      diagnosis={notif.diagnosis ?? patient.diagnosis} />}
              {type === "covid19"     && <SectionCovid       diagnosis={notif.diagnosis ?? patient.diagnosis} />}
              {type === "tuberculose" && <SectionTuberculose diagnosis={notif.diagnosis ?? patient.diagnosis} />}
              {(type === "violencia" || type === "outros") && <SectionGeneric diagnosis={notif.diagnosis ?? patient.diagnosis} />}

              <Encerramento />
              <Assinatura responsible={notif.responsible} />

              {/* UPA data box only on last sheet */}
              {idx === types.length - 1 && (
                <UpaDataBox patient={patient} notif={notif} types={types} />
              )}

              <div style={{ fontSize: "7pt", color: "#888", textAlign: "right", marginTop: "6pt", borderTop: "1px solid #ddd", paddingTop: "3pt" }}>
                UPA Breves — Gestão de Pacientes  ·  Emitido em {new Date().toLocaleString("pt-BR")}  ·  Ficha {idx + 1}/{types.length}
              </div>
            </div>
          );
        })}

      </div>

      <style>{`
        @media print {
          .noprint { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-area { padding: 8mm 10mm !important; }
          @page { margin: 8mm; size: A4 portrait; }
        }
      `}</style>
    </>
  );
}

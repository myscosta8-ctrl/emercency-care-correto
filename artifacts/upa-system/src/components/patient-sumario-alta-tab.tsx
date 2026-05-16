import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EvolutionEntry {
  id: number;
  soapText: string;
  createdAt: string;
  invalidado?: boolean;
  professionalCategory?: string | null;
}

interface PrescriptionEntry {
  id: number;
  medications: string;
  invalidado?: boolean;
  status?: string;
}

interface PatientData {
  id: number;
  full_name: string;
  birthDate?: string | null;
  cpf?: string | null;
  prontuarioNumber?: string | null;
  atendimentoNumber?: string | null;
  triage_level?: string | null;
  diagnosis?: string | null;
  careStatus?: string | null;
  sector?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  patient: PatientData;
  history: EvolutionEntry[] | undefined;
  prescriptions: PrescriptionEntry[] | undefined;
  staffMap: Record<string, unknown>;
  canEdit: boolean;
}

function calcTempoInternacao(createdAt: string, updatedAt: string) {
  const entrada = new Date(createdAt);
  const saida = new Date(updatedAt);
  const diffMs = saida.getTime() - entrada.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
  if (diffH >= 24) {
    const dias = Math.floor(diffH / 24);
    const horas = diffH % 24;
    return `${dias} dia(s)${horas > 0 ? ` e ${horas}h` : ""}`;
  }
  return `${diffH}h ${diffM}min`;
}

export function PatientSumarioAltaTab({ patient, history, prescriptions, canEdit: _canEdit }: Props) {
  const isAlta = patient.careStatus === "Alta";

  const ultimaEvolucaoMedica = history?.find(h =>
    h.professionalCategory === "medico" || (!h.professionalCategory && h.soapText?.startsWith("EVOLUÇÃO"))
  );

  const prescricoesAtivas = (prescriptions ?? []).filter(p => !p.invalidado && p.status !== "encerrada");

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    const entrada = format(new Date(patient.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const saida = isAlta ? format(new Date(patient.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Em atendimento";
    const tempo = isAlta ? calcTempoInternacao(patient.createdAt, patient.updatedAt) : "—";

    win.document.write(`<!DOCTYPE html><html><head><title>Sumário de Alta</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 30px; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
      .header h1 { font-size: 16px; margin: 0 0 4px; }
      .header p { font-size: 10px; color: #555; margin: 0; }
      h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; text-align: center; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th { background: #f0f0f0; text-align: left; width: 35%; padding: 4px 8px; border: 1px solid #ccc; font-size: 10px; text-transform: uppercase; }
      td { padding: 4px 8px; border: 1px solid #ccc; }
      h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin: 12px 0 4px; border-bottom: 1px solid #ccc; }
      .sig { display: flex; gap: 60px; margin-top: 40px; }
      .sig-box { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
    </style></head><body>
    <div class="header">
      <h1>UPA 24H de Breves</h1>
      <p>Prefeitura Municipal de Breves — Secretaria Municipal de Saúde</p>
    </div>
    <h2>Sumário de Alta</h2>
    <h3>Dados do Paciente</h3>
    <table>
      <tr><th>Nome</th><td>${patient.full_name}</td></tr>
      <tr><th>Data de nascimento</th><td>${patient.birthDate ? format(new Date(patient.birthDate + "T12:00:00"), "dd/MM/yyyy") : "—"}</td></tr>
      <tr><th>CPF</th><td>${patient.cpf || "—"}</td></tr>
      <tr><th>Prontuário</th><td>${patient.prontuarioNumber || "—"}</td></tr>
      <tr><th>Atendimento</th><td>${patient.atendimentoNumber || "—"}</td></tr>
      <tr><th>Classificação de risco</th><td>${patient.triage_level || "—"}</td></tr>
      <tr><th>Diagnóstico / CID</th><td>${patient.diagnosis || "—"}</td></tr>
    </table>
    <h3>Período de Atendimento</h3>
    <table>
      <tr><th>Entrada</th><td>${entrada}</td></tr>
      <tr><th>Alta</th><td>${saida}</td></tr>
      <tr><th>Tempo de permanência</th><td>${tempo}</td></tr>
    </table>
    ${prescricoesAtivas.length > 0 ? `
    <h3>Prescrições na Alta</h3>
    <table>
      <tr><th>Medicamentos</th></tr>
      ${prescricoesAtivas.map(p => `<tr><td>${p.medications}</td></tr>`).join("")}
    </table>` : ""}
    ${ultimaEvolucaoMedica ? `
    <h3>Resumo da Evolução Clínica</h3>
    <p>${ultimaEvolucaoMedica.soapText?.slice(0, 600) ?? "—"}</p>` : ""}
    <div class="sig">
      <div class="sig-box">Médico Responsável<br><br>&nbsp;</div>
      <div class="sig-box">Carimbo / CRM</div>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  const tempoTexto = isAlta
    ? calcTempoInternacao(patient.createdAt, patient.updatedAt)
    : formatDistanceToNow(new Date(patient.createdAt), { locale: ptBR, addSuffix: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold">Sumário de Alta</span>
          {isAlta && <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">Alta Registrada</Badge>}
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handlePrint}>
          <Printer className="h-3 w-3" /> Imprimir
        </Button>
      </div>

      {!isAlta && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-400">
            O sumário completo é gerado automaticamente quando o paciente recebe alta. Atualmente: <strong>{patient.careStatus}</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              ["Paciente", patient.full_name],
              ["Prontuário", patient.prontuarioNumber ?? "—"],
              ["Atendimento", patient.atendimentoNumber ?? "—"],
              ["Classificação de risco", patient.triage_level ?? "—"],
              ["Diagnóstico", patient.diagnosis ?? "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right max-w-[60%]">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              ["Entrada", format(new Date(patient.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })],
              ["Alta", isAlta ? format(new Date(patient.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Em atendimento"],
              ["Permanência", tempoTexto],
              ["Setor", patient.sector ?? "—"],
              ["Status final", patient.careStatus ?? "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {prescricoesAtivas.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prescrições na Alta ({prescricoesAtivas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {prescricoesAtivas.map(p => (
                <div key={p.id} className="text-xs py-1 border-b border-border/20 last:border-0">
                  <span className="font-medium">{p.medications}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ultimaEvolucaoMedica && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Última Evolução Médica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
              {ultimaEvolucaoMedica.soapText ?? "—"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

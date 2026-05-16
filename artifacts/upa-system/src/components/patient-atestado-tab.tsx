import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Printer, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Patient } from "@workspace/api-client-react";

const TIPOS_ATESTADO = [
  { value: "afastamento", label: "Atestado de Afastamento" },
  { value: "comparecimento", label: "Declaração de Comparecimento" },
  { value: "acompanhante", label: "Atestado de Acompanhante" },
];

interface Atestado {
  id: string;
  tipo: string;
  diasAfastamento: number;
  dataInicio: string;
  dataFim: string;
  cid: string;
  motivo: string;
  medico: string;
  crm: string;
  dataEmissao: string;
}

const STORAGE_KEY = (id: number) => `atestados_medicos_${id}`;

function load(patientId: number): Atestado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(patientId: number, items: Atestado[]) {
  localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(items));
}

interface Props {
  patientId: number;
  patient: Patient;
  canEdit: boolean;
}

export function PatientAtestadoTab({ patientId, patient, canEdit }: Props) {
  const [atestados, setAtestados] = useState<Atestado[]>(() => load(patientId));
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("afastamento");
  const [dias, setDias] = useState(1);
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cid, setCid] = useState("");
  const [motivo, setMotivo] = useState("");
  const [medico, setMedico] = useState("");
  const [crm, setCrm] = useState("");

  const dataFim = tipo === "afastamento"
    ? format(new Date(new Date(dataInicio).getTime() + (dias - 1) * 86400000), "yyyy-MM-dd")
    : dataInicio;

  function handleSave() {
    const at: Atestado = {
      id: crypto.randomUUID(),
      tipo,
      diasAfastamento: dias,
      dataInicio,
      dataFim,
      cid,
      motivo,
      medico,
      crm,
      dataEmissao: new Date().toISOString(),
    };
    const updated = [at, ...atestados];
    setAtestados(updated);
    save(patientId, updated);
    setShowForm(false);
    setTipo("afastamento"); setDias(1); setCid(""); setMotivo("");
    setMedico(""); setCrm("");
  }

  function handlePrint(at: Atestado) {
    const tipoLabel = TIPOS_ATESTADO.find(t => t.value === at.tipo)?.label ?? at.tipo;
    const win = window.open("", "_blank");
    if (!win) return;

    const dataInicioFmt = format(new Date(at.dataInicio + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const dataFimFmt = at.tipo === "afastamento"
      ? format(new Date(at.dataFim + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : null;
    const emissaoFmt = format(new Date(at.dataEmissao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const corpoAfastamento = `
      <p>Atesto para os devidos fins que o(a) paciente <strong>${patient.full_name}</strong>,
      portador(a) do RG/CPF <strong>${patient.cpf || "não informado"}</strong>,
      esteve sob meus cuidados médicos, necessitando de afastamento de suas atividades pelo período de
      <strong>${at.diasAfastamento} dia(s)</strong>, de <strong>${dataInicioFmt}</strong>
      a <strong>${dataFimFmt}</strong>.
      ${at.cid ? `CID-10: <strong>${at.cid}</strong>.` : ""}
      ${at.motivo ? `<br>Motivo: ${at.motivo}.` : ""}
      </p>`;

    const corpoComparecimento = `
      <p>Declaramos que o(a) paciente <strong>${patient.full_name}</strong>,
      portador(a) do RG/CPF <strong>${patient.cpf || "não informado"}</strong>,
      compareceu a esta Unidade de Pronto Atendimento em <strong>${dataInicioFmt}</strong>.
      ${at.motivo ? `<br>Motivo: ${at.motivo}.` : ""}
      </p>`;

    const corpoAcompanhante = `
      <p>Atesto que o(a) paciente <strong>${patient.full_name}</strong>
      necessitou de acompanhante em <strong>${dataInicioFmt}</strong>,
      permanecendo sob cuidados nesta Unidade.
      ${at.motivo ? `<br>Observações: ${at.motivo}.` : ""}
      </p>`;

    const corpo = at.tipo === "afastamento" ? corpoAfastamento
      : at.tipo === "comparecimento" ? corpoComparecimento
      : corpoAcompanhante;

    win.document.write(`<!DOCTYPE html><html><head><title>${tipoLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 40px; max-width: 600px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; }
      .header h1 { font-size: 16px; margin: 0 0 4px; }
      .header p { font-size: 10px; color: #555; margin: 0; }
      h2 { font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 24px; }
      p { line-height: 1.8; }
      .city-date { margin-top: 32px; text-align: right; }
      .sig { margin-top: 48px; text-align: center; }
      .sig-line { border-top: 1px solid #000; display: inline-block; width: 280px; padding-top: 4px; font-size: 11px; }
    </style></head><body>
    <div class="header">
      <h1>UPA 24H de Breves</h1>
      <p>Prefeitura Municipal de Breves — Secretaria Municipal de Saúde</p>
    </div>
    <h2>${tipoLabel}</h2>
    ${corpo}
    <div class="city-date">Breves – PA, ${emissaoFmt}.</div>
    <div class="sig">
      <div class="sig-line">${at.medico}${at.crm ? ` — CRM: ${at.crm}` : ""}</div>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  const canSave = tipo && medico.trim();

  return (
    <div className="space-y-4">
      {canEdit && !showForm && (
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> Emitir Atestado
        </Button>
      )}

      {showForm && (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo de documento *</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={tipo}
                onChange={e => setTipo(e.target.value)}
              >
                {TIPOS_ATESTADO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data início</label>
                <Input type="date" className="text-xs" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              {tipo === "afastamento" && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Dias de afastamento</label>
                  <Input type="number" min={1} className="text-xs" value={dias} onChange={e => setDias(Number(e.target.value))} />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CID-10</label>
                <Input className="text-xs" placeholder="Ex: J06.9" value={cid} onChange={e => setCid(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observações / motivo</label>
              <Textarea className="text-xs resize-none" rows={2} placeholder="Detalhes adicionais (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Médico responsável *</label>
                <Input className="text-xs" placeholder="Dr(a). Nome Completo" value={medico} onChange={e => setMedico(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CRM</label>
                <Input className="text-xs" placeholder="CRM/PA 00000" value={crm} onChange={e => setCrm(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={handleSave} disabled={!canSave}>Salvar</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {atestados.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <FileText className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum atestado emitido</p>
        </div>
      ) : (
        <div className="space-y-2">
          {atestados.map(at => {
            const tipoLabel = TIPOS_ATESTADO.find(t => t.value === at.tipo)?.label ?? at.tipo;
            return (
              <Card key={at.id} className="border-border/50">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{tipoLabel}</p>
                      {at.tipo === "afastamento" && (
                        <p className="text-xs text-muted-foreground">
                          {at.diasAfastamento} dia(s) — {format(new Date(at.dataInicio + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                          {at.dataFim !== at.dataInicio && ` a ${format(new Date(at.dataFim + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                      )}
                      {at.tipo !== "afastamento" && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(at.dataInicio + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{at.medico}{at.crm ? ` — CRM: ${at.crm}` : ""}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" onClick={() => handlePrint(at)}>
                      <Printer className="h-3 w-3" /> Imprimir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

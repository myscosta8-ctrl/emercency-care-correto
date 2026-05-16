import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Printer, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrientacoesData {
  medicoesEm: string;
  medicamentos: string;
  cuidadosFeridas: string;
  alimentacao: string;
  atividade: string;
  sinaisAlerta: string;
  retorno: string;
  outrasOrientacoes: string;
  responsavelMedico: string;
  responsavelEnfermagem: string;
  dataRegistro: string;
}

const STORAGE_KEY = (id: number) => `orientacoes_alta_${id}`;

function load(patientId: number): OrientacoesData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(patientId: number, data: OrientacoesData) {
  localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(data));
}

interface Props {
  patientId: number;
  patientName: string;
  canEdit: boolean;
}

export function PatientOrientacoesAltaTab({ patientId, patientName, canEdit }: Props) {
  const existing = load(patientId);
  const [data, setData] = useState<OrientacoesData>(existing ?? {
    medicoesEm: "",
    medicamentos: "",
    cuidadosFeridas: "",
    alimentacao: "",
    atividade: "",
    sinaisAlerta: "",
    retorno: "",
    outrasOrientacoes: "",
    responsavelMedico: "",
    responsavelEnfermagem: "",
    dataRegistro: "",
  });
  const [saved, setSaved] = useState(!!existing);

  function set(key: keyof OrientacoesData, value: string) {
    setData(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    const toSave = { ...data, dataRegistro: new Date().toISOString() };
    save(patientId, toSave);
    setData(toSave);
    setSaved(true);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    const dataFmt = data.dataRegistro
      ? format(new Date(data.dataRegistro), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const secao = (titulo: string, conteudo: string) => conteudo
      ? `<div style="margin-bottom:12px"><strong>${titulo}:</strong><br>${conteudo.replace(/\n/g, "<br>")}</div>`
      : "";

    win.document.write(`<!DOCTYPE html><html><head><title>Orientações de Alta</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 30px; max-width: 680px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
      .header h1 { font-size: 16px; margin: 0 0 4px; }
      .header p { font-size: 10px; color: #555; margin: 0; }
      h2 { font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 0.08em; margin: 12px 0 20px; }
      .paciente { background: #f5f5f5; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px; font-size: 11px; }
      .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px; }
      .alert strong { color: #856404; }
      .sig { display: flex; gap: 40px; margin-top: 32px; }
      .sig-box { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
    </style></head><body>
    <div class="header">
      <h1>UPA 24H de Breves</h1>
      <p>Prefeitura Municipal de Breves — Secretaria Municipal de Saúde</p>
    </div>
    <h2>Orientações de Alta</h2>
    <div class="paciente"><strong>Paciente:</strong> ${patientName} — <strong>Data:</strong> ${dataFmt}</div>
    ${secao("Medicamentos (como tomar)", data.medicamentos)}
    ${secao("Cuidados com feridas / curativos", data.cuidadosFeridas)}
    ${secao("Alimentação / Dieta", data.alimentacao)}
    ${secao("Atividade física / Restrições", data.atividade)}
    ${secao("Retorno / Consulta de seguimento", data.retorno)}
    ${data.sinaisAlerta ? `<div class="alert"><strong>⚠ Sinais de Alerta — Retorne imediatamente se:</strong><br>${data.sinaisAlerta.replace(/\n/g, "<br>")}</div>` : ""}
    ${secao("Outras orientações", data.outrasOrientacoes)}
    <div class="sig">
      <div class="sig-box">Médico(a) responsável<br><br>${data.responsavelMedico || "&nbsp;"}</div>
      <div class="sig-box">Enfermeiro(a) responsável<br><br>${data.responsavelEnfermagem || "&nbsp;"}</div>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  const fields: { key: keyof OrientacoesData; label: string; placeholder: string; rows?: number; highlight?: boolean }[] = [
    { key: "medicamentos", label: "Medicamentos (nome, dose, frequência e duração)", placeholder: "Ex: Amoxicilina 500mg — 1 comprimido a cada 8h por 7 dias…", rows: 3 },
    { key: "cuidadosFeridas", label: "Cuidados com feridas / curativos", placeholder: "Ex: Trocar curativo diariamente com SF 0,9%…", rows: 2 },
    { key: "alimentacao", label: "Alimentação / Dieta", placeholder: "Ex: Dieta leve por 48h, evitar alimentos gordurosos…", rows: 2 },
    { key: "atividade", label: "Atividade física / Restrições", placeholder: "Ex: Repouso relativo por 3 dias, evitar esforço físico…", rows: 2 },
    { key: "retorno", label: "Retorno / Consulta de seguimento", placeholder: "Ex: Retornar na UBS em 7 dias ou antes se necessário…", rows: 2 },
    { key: "sinaisAlerta", label: "⚠ Sinais de Alerta — Retornar imediatamente se:", placeholder: "Ex: Febre acima de 38°C, vômitos persistentes, dificuldade para respirar…", rows: 3, highlight: true },
    { key: "outrasOrientacoes", label: "Outras orientações", placeholder: "Informações adicionais relevantes…", rows: 2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {saved && data.dataRegistro
            ? `Salvo em ${format(new Date(data.dataRegistro), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
            : "Não salvo"}
        </p>
        <div className="flex gap-2">
          {canEdit && (
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSave}>
              <Save className="h-3 w-3" /> Salvar
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="h-3 w-3" /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-4">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <label className={`text-xs font-medium ${f.highlight ? "text-orange-400" : ""}`}>{f.label}</label>
              <Textarea
                className={`text-xs resize-none ${f.highlight ? "border-orange-500/30" : ""}`}
                rows={f.rows ?? 2}
                placeholder={f.placeholder}
                value={data[f.key]}
                onChange={e => set(f.key, e.target.value)}
                disabled={!canEdit}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assinaturas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Médico(a) responsável</label>
            <Input className="text-xs" placeholder="Nome e CRM" value={data.responsavelMedico}
              onChange={e => set("responsavelMedico", e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Enfermeiro(a) responsável</label>
            <Input className="text-xs" placeholder="Nome e COREN" value={data.responsavelEnfermagem}
              onChange={e => set("responsavelEnfermagem", e.target.value)} disabled={!canEdit} />
          </div>
        </CardContent>
      </Card>

      {!saved && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <BookOpen className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400">Há alterações não salvas. Clique em "Salvar" para guardar as orientações.</p>
        </div>
      )}
    </div>
  );
}

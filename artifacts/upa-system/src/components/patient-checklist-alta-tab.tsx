import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Square, Printer, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CheckItem {
  id: string;
  categoria: string;
  descricao: string;
}

const CHECKLIST_ITEMS: CheckItem[] = [
  // Médico
  { id: "sumario_alta", categoria: "Médico", descricao: "Sumário de alta preenchido e assinado" },
  { id: "prescricao_alta", categoria: "Médico", descricao: "Prescrição de alta (receita) emitida" },
  { id: "atestado", categoria: "Médico", descricao: "Atestado médico emitido (se necessário)" },
  { id: "diagnostico_cid", categoria: "Médico", descricao: "Diagnóstico final com CID registrado" },
  { id: "retorno_agendado", categoria: "Médico", descricao: "Retorno ambulatorial orientado / agendado" },
  // Enfermagem
  { id: "sinais_vitais_alta", categoria: "Enfermagem", descricao: "Sinais vitais registrados na alta" },
  { id: "orientacoes_dadas", categoria: "Enfermagem", descricao: "Orientações de alta fornecidas ao paciente/família" },
  { id: "medicacoes_explicadas", categoria: "Enfermagem", descricao: "Medicações da receita explicadas" },
  { id: "curativos_orientados", categoria: "Enfermagem", descricao: "Cuidados com curativos/feridas orientados (se aplicável)" },
  { id: "acesso_removido", categoria: "Enfermagem", descricao: "Acesso venoso / cateter removido" },
  // Administrativo
  { id: "pertences_devolvidos", categoria: "Administrativo", descricao: "Pertences do paciente conferidos e devolvidos" },
  { id: "prontuario_fechado", categoria: "Administrativo", descricao: "Prontuário físico/eletrônico encerrado" },
  { id: "leito_liberado", categoria: "Administrativo", descricao: "Leito liberado para limpeza e desinfecção" },
  { id: "protocolo_saida", categoria: "Administrativo", descricao: "Protocolo de saída registrado na recepção" },
  // Segurança
  { id: "paciente_entende_alta", categoria: "Segurança", descricao: "Paciente/responsável entende e concorda com a alta" },
  { id: "transporte_verificado", categoria: "Segurança", descricao: "Transporte do paciente verificado / acompanhante presente" },
];

type CheckedMap = Record<string, boolean>;

const STORAGE_KEY = (id: number) => `checklist_alta_${id}`;

function load(patientId: number): CheckedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveChecked(patientId: number, checked: CheckedMap) {
  localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(checked));
}

interface Props {
  patientId: number;
  patientName: string;
  canEdit: boolean;
}

export function PatientChecklistAltaTab({ patientId, patientName, canEdit }: Props) {
  const [checked, setChecked] = useState<CheckedMap>(() => load(patientId));
  const [assinaturaEnfermeiro, setAssinaturaEnfermeiro] = useState("");
  const [assinaturaMedico, setAssinaturaMedico] = useState("");

  const total = CHECKLIST_ITEMS.length;
  const done = CHECKLIST_ITEMS.filter(i => checked[i.id]).length;
  const allDone = done === total;

  function toggle(id: string) {
    if (!canEdit) return;
    const updated = { ...checked, [id]: !checked[id] };
    setChecked(updated);
    saveChecked(patientId, updated);
  }

  const categorias = [...new Set(CHECKLIST_ITEMS.map(i => i.categoria))];

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Checklist de Alta</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
      h2 { font-size: 14px; text-align: center; margin-bottom: 4px; }
      .sub { text-align: center; font-size: 10px; color: #555; margin-bottom: 16px; }
      h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin: 12px 0 4px; border-bottom: 1px solid #ccc; }
      .item { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; }
      .box { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; margin-top: 1px; text-align: center; font-size: 9px; line-height: 12px; }
      .sig { display: flex; gap: 40px; margin-top: 32px; }
      .sig-box { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
    </style></head><body>
    <h2>CHECKLIST DE ALTA</h2>
    <div class="sub">UPA 24H de Breves — Data: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} — Paciente: ${patientName}</div>
    ${categorias.map(cat => `
      <h3>${cat}</h3>
      ${CHECKLIST_ITEMS.filter(i => i.categoria === cat).map(i => `
        <div class="item">
          <span class="box">${checked[i.id] ? "✓" : ""}</span>
          <span>${i.descricao}</span>
        </div>`).join("")}
    `).join("")}
    <div class="sig">
      <div class="sig-box">Enfermeiro(a) Responsável<br><br>${assinaturaEnfermeiro || "&nbsp;"}</div>
      <div class="sig-box">Médico(a) Responsável<br><br>${assinaturaMedico || "&nbsp;"}</div>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {done}/{total} itens verificados
          </div>
          {allDone && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" /> Checklist completo
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handlePrint}>
          <Printer className="h-3 w-3" /> Imprimir
        </Button>
      </div>

      <div className="w-full bg-muted/30 rounded-full h-1.5">
        <div
          className="bg-emerald-500 h-1.5 rounded-full transition-all"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-5">
          {categorias.map(cat => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1">
                {CHECKLIST_ITEMS.filter(i => i.categoria === cat).map(item => (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-2.5 text-left py-1.5 px-2 rounded hover:bg-muted/30 transition-colors"
                    onClick={() => toggle(item.id)}
                  >
                    {checked[item.id]
                      ? <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className={`text-xs ${checked[item.id] ? "line-through text-muted-foreground" : ""}`}>
                      {item.descricao}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Enfermeiro(a) responsável</label>
          <input className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
            placeholder="Nome completo" value={assinaturaEnfermeiro}
            onChange={e => setAssinaturaEnfermeiro(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Médico(a) responsável</label>
          <input className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
            placeholder="Nome completo" value={assinaturaMedico}
            onChange={e => setAssinaturaMedico(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Printer, Package, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Pertence {
  id: string;
  descricao: string;
  quantidade: number;
  estado: "bom" | "danificado" | "nao_informado";
  conferidoPaciente: boolean;
  conferidoAcompanhante: boolean;
  observacao: string;
  criadoEm: string;
}

interface Props {
  patientId: number;
  patientName: string;
  canEdit: boolean;
}

const ESTADO_LABELS: Record<string, string> = {
  bom: "Bom estado",
  danificado: "Danificado",
  nao_informado: "Não informado",
};

const ITENS_COMUNS = [
  "Documento de Identidade (RG/CPF)", "Cartão SUS", "Carteira de Plano de Saúde",
  "Celular", "Chaves", "Carteira/Bolsa", "Dinheiro (em envelope)", "Óculos",
  "Prótese dentária", "Aparelho auditivo", "Medicamentos de uso contínuo",
  "Roupas", "Calçados", "Relógio", "Aliança/Joias",
];

const STORAGE_KEY = (id: number) => `inventario_pertences_${id}`;

function loadPertences(patientId: number): Pertence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePertences(patientId: number, items: Pertence[]) {
  localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(items));
}

export function PatientInventarioTab({ patientId, patientName, canEdit }: Props) {
  const [pertences, setPertences] = useState<Pertence[]>(() => loadPertences(patientId));
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [estado, setEstado] = useState<Pertence["estado"]>("bom");
  const [observacao, setObservacao] = useState("");
  const [assinaturaPaciente, setAssinaturaPaciente] = useState("");
  const [assinaturaFuncionario, setAssinaturaFuncionario] = useState("");
  const [dataRegistro] = useState(() => format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }));

  function addItem(desc: string) {
    const item: Pertence = {
      id: crypto.randomUUID(),
      descricao: desc,
      quantidade,
      estado,
      conferidoPaciente: false,
      conferidoAcompanhante: false,
      observacao,
      criadoEm: new Date().toISOString(),
    };
    const updated = [...pertences, item];
    setPertences(updated);
    savePertences(patientId, updated);
    setDescricao("");
    setQuantidade(1);
    setObservacao("");
  }

  function removeItem(id: string) {
    const updated = pertences.filter(p => p.id !== id);
    setPertences(updated);
    savePertences(patientId, updated);
  }

  function toggleConferido(id: string, campo: "conferidoPaciente" | "conferidoAcompanhante") {
    const updated = pertences.map(p => p.id === id ? { ...p, [campo]: !p[campo] } : p);
    setPertences(updated);
    savePertences(patientId, updated);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Inventário de Pertences</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #000; }
      h2 { font-size: 14px; text-align: center; margin-bottom: 4px; }
      .sub { text-align: center; font-size: 10px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; padding: 4px 6px; border: 1px solid #ccc; text-align: left; }
      td { padding: 4px 6px; border: 1px solid #ccc; vertical-align: middle; }
      .sig { display: flex; gap: 40px; margin-top: 32px; }
      .sig-box { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <h2>INVENTÁRIO DE PERTENCES DO PACIENTE</h2>
    <div class="sub">UPA 24H de Breves — Data: ${dataRegistro} — Paciente: ${patientName}</div>
    <table>
      <thead><tr><th>Item</th><th>Qtd</th><th>Estado</th><th>Conf. Pac.</th><th>Conf. Acomp.</th><th>Observações</th></tr></thead>
      <tbody>
        ${pertences.map(p => `<tr>
          <td>${p.descricao}</td>
          <td style="text-align:center">${p.quantidade}</td>
          <td>${ESTADO_LABELS[p.estado]}</td>
          <td style="text-align:center">${p.conferidoPaciente ? "✓" : "□"}</td>
          <td style="text-align:center">${p.conferidoAcompanhante ? "✓" : "□"}</td>
          <td>${p.observacao || "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="sig">
      <div class="sig-box">Assinatura do Paciente / Responsável<br><br>${assinaturaPaciente || "&nbsp;"}</div>
      <div class="sig-box">Assinatura do Funcionário Responsável<br><br>${assinaturaFuncionario || "&nbsp;"}</div>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adicionar Item</p>
            <div className="flex flex-wrap gap-1.5">
              {ITENS_COMUNS.map(item => (
                <Button key={item} size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => { setDescricao(item); }}>
                  {item}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                className="text-xs"
                placeholder="Descrição do item"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                onKeyDown={e => e.key === "Enter" && descricao.trim() && addItem(descricao.trim())}
              />
              <Input
                type="number" min={1} max={99}
                className="text-xs"
                placeholder="Qtd"
                value={quantidade}
                onChange={e => setQuantidade(Number(e.target.value))}
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={estado}
                onChange={e => setEstado(e.target.value as Pertence["estado"])}
              >
                <option value="bom">Bom estado</option>
                <option value="danificado">Danificado</option>
                <option value="nao_informado">Não informado</option>
              </select>
            </div>
            <Textarea
              className="text-xs resize-none"
              placeholder="Observações sobre o item (opcional)"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
            />
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => descricao.trim() && addItem(descricao.trim())}>
              <Plus className="h-3 w-3" /> Adicionar Item
            </Button>
          </CardContent>
        </Card>
      )}

      {pertences.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum pertence registrado</p>
          <p className="text-xs opacity-60">Adicione itens usando o formulário acima</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{pertences.length} item(ns) registrado(s)</p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handlePrint}>
              <Printer className="h-3 w-3" /> Imprimir
            </Button>
          </div>

          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Item</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Qtd</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Estado</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Pac.</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Acomp.</th>
                  {canEdit && <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {pertences.map(p => (
                  <tr key={p.id} className="border-t border-border/30">
                    <td className="px-3 py-2">
                      <p className="font-medium">{p.descricao}</p>
                      {p.observacao && <p className="text-muted-foreground mt-0.5">{p.observacao}</p>}
                    </td>
                    <td className="px-3 py-2 text-center">{p.quantidade}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={
                        p.estado === "bom" ? "border-green-500/40 text-green-400" :
                        p.estado === "danificado" ? "border-red-500/40 text-red-400" :
                        "border-muted text-muted-foreground"
                      }>
                        {ESTADO_LABELS[p.estado]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => canEdit && toggleConferido(p.id, "conferidoPaciente")}>
                        {p.conferidoPaciente
                          ? <CheckSquare className="h-4 w-4 text-green-400 mx-auto" />
                          : <Square className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => canEdit && toggleConferido(p.id, "conferidoAcompanhante")}>
                        {p.conferidoAcompanhante
                          ? <CheckSquare className="h-4 w-4 text-green-400 mx-auto" />
                          : <Square className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </button>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-center">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => removeItem(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Assinatura do Paciente / Responsável</label>
              <Input className="text-xs" placeholder="Nome completo" value={assinaturaPaciente} onChange={e => setAssinaturaPaciente(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Assinatura do Funcionário</label>
              <Input className="text-xs" placeholder="Nome e cargo" value={assinaturaFuncionario} onChange={e => setAssinaturaFuncionario(e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

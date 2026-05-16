import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Printer, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Escala de Braden (lesão por pressão) ─────────────────────────────────────
const BRADEN_ITEMS = [
  {
    key: "percepcao_sensorial",
    label: "Percepção Sensorial",
    options: [
      { value: 1, label: "1 - Completamente limitado" },
      { value: 2, label: "2 - Muito limitado" },
      { value: 3, label: "3 - Levemente limitado" },
      { value: 4, label: "4 - Sem limitação" },
    ],
  },
  {
    key: "umidade",
    label: "Umidade",
    options: [
      { value: 1, label: "1 - Constantemente úmido" },
      { value: 2, label: "2 - Muito úmido" },
      { value: 3, label: "3 - Ocasionalmente úmido" },
      { value: 4, label: "4 - Raramente úmido" },
    ],
  },
  {
    key: "atividade",
    label: "Atividade",
    options: [
      { value: 1, label: "1 - Acamado" },
      { value: 2, label: "2 - Restrito à cadeira" },
      { value: 3, label: "3 - Anda ocasionalmente" },
      { value: 4, label: "4 - Anda frequentemente" },
    ],
  },
  {
    key: "mobilidade",
    label: "Mobilidade",
    options: [
      { value: 1, label: "1 - Completamente imóvel" },
      { value: 2, label: "2 - Muito limitado" },
      { value: 3, label: "3 - Levemente limitado" },
      { value: 4, label: "4 - Sem limitação" },
    ],
  },
  {
    key: "nutricao",
    label: "Nutrição",
    options: [
      { value: 1, label: "1 - Muito pobre" },
      { value: 2, label: "2 - Inadequada" },
      { value: 3, label: "3 - Adequada" },
      { value: 4, label: "4 - Excelente" },
    ],
  },
  {
    key: "friccao_cisalhamento",
    label: "Fricção e Cisalhamento",
    options: [
      { value: 1, label: "1 - Problema" },
      { value: 2, label: "2 - Problema potencial" },
      { value: 3, label: "3 - Sem problema aparente" },
    ],
  },
];

// ── Escala de Morse (risco de queda) ─────────────────────────────────────────
const MORSE_ITEMS = [
  {
    key: "historico_queda",
    label: "Histórico de queda (≤ 3 meses)",
    options: [
      { value: 0, label: "0 - Não" },
      { value: 25, label: "25 - Sim" },
    ],
  },
  {
    key: "diagnostico_secundario",
    label: "Diagnóstico secundário",
    options: [
      { value: 0, label: "0 - Não" },
      { value: 15, label: "15 - Sim" },
    ],
  },
  {
    key: "apoio_deambulacao",
    label: "Apoio na deambulação",
    options: [
      { value: 0, label: "0 - Nenhum / repouso / cadeira de rodas" },
      { value: 15, label: "15 - Bengala / andador / muleta" },
      { value: 30, label: "30 - Apoia-se nos móveis" },
    ],
  },
  {
    key: "acesso_venoso",
    label: "Acesso venoso / terapia IV",
    options: [
      { value: 0, label: "0 - Não" },
      { value: 20, label: "20 - Sim" },
    ],
  },
  {
    key: "marcha",
    label: "Marcha",
    options: [
      { value: 0, label: "0 - Normal / repouso no leito" },
      { value: 10, label: "10 - Fraca" },
      { value: 20, label: "20 - Comprometida / instável" },
    ],
  },
  {
    key: "estado_mental",
    label: "Estado mental",
    options: [
      { value: 0, label: "0 - Orientado para sua capacidade" },
      { value: 15, label: "15 - Superestima capacidade / esquece limitações" },
    ],
  },
];

type BradenScores = Record<string, number>;
type MorseScores = Record<string, number>;

interface Avaliacao {
  id: string;
  data: string;
  bradenScores: BradenScores;
  morseScores: MorseScores;
  observacoes: string;
  registradoPor: string;
}

const STORAGE_KEY = (id: number) => `escalas_risco_${id}`;

function loadAvaliacoes(patientId: number): Avaliacao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAvaliacoes(patientId: number, items: Avaliacao[]) {
  localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(items));
}

function bradenTotal(scores: BradenScores) {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

function morseTotal(scores: MorseScores) {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

function bradenRisco(total: number) {
  if (total <= 9) return { label: "Risco muito alto", color: "text-red-400 border-red-500/40" };
  if (total <= 12) return { label: "Risco alto", color: "text-orange-400 border-orange-500/40" };
  if (total <= 14) return { label: "Risco moderado", color: "text-yellow-400 border-yellow-500/40" };
  return { label: "Sem risco significativo", color: "text-green-400 border-green-500/40" };
}

function morseRisco(total: number) {
  if (total < 25) return { label: "Sem risco", color: "text-green-400 border-green-500/40" };
  if (total <= 44) return { label: "Risco baixo", color: "text-yellow-400 border-yellow-500/40" };
  return { label: "Risco alto", color: "text-red-400 border-red-500/40" };
}

interface Props {
  patientId: number;
  canEdit: boolean;
}

export function PatientEscalasRiscoTab({ patientId, canEdit }: Props) {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>(() => loadAvaliacoes(patientId));
  const [showForm, setShowForm] = useState(false);
  const [bradenScores, setBradenScores] = useState<BradenScores>({});
  const [morseScores, setMorseScores] = useState<MorseScores>({});
  const [observacoes, setObservacoes] = useState("");
  const [registradoPor, setRegistradoPor] = useState("");

  function handleSave() {
    const av: Avaliacao = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      bradenScores,
      morseScores,
      observacoes,
      registradoPor,
    };
    const updated = [av, ...avaliacoes];
    setAvaliacoes(updated);
    saveAvaliacoes(patientId, updated);
    setShowForm(false);
    setBradenScores({});
    setMorseScores({});
    setObservacoes("");
    setRegistradoPor("");
  }

  function handlePrint(av: Avaliacao) {
    const bt = bradenTotal(av.bradenScores);
    const mt = morseTotal(av.morseScores);
    const br = bradenRisco(bt);
    const mr = morseRisco(mt);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Escalas de Risco</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
      h2 { font-size: 14px; text-align: center; }
      h3 { font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border: 1px solid #ccc; padding: 4px 8px; }
      th { background: #f0f0f0; text-align: left; }
      .total { font-weight: bold; font-size: 13px; }
      @media print { body { padding: 8px; } }
    </style></head><body>
    <h2>ESCALAS DE RISCO CLÍNICO</h2>
    <p style="text-align:center;font-size:10px">Data: ${format(new Date(av.data), "dd/MM/yyyy HH:mm", { locale: ptBR })} — Registrado por: ${av.registradoPor}</p>
    <h3>Escala de Braden — Risco de Lesão por Pressão</h3>
    <table>
      <tr><th>Item</th><th>Pontuação</th></tr>
      ${BRADEN_ITEMS.map(item => `<tr><td>${item.label}</td><td>${av.bradenScores[item.key] ?? "—"}</td></tr>`).join("")}
      <tr><td class="total">TOTAL</td><td class="total">${bt} — ${br.label}</td></tr>
    </table>
    <h3>Escala de Morse — Risco de Queda</h3>
    <table>
      <tr><th>Item</th><th>Pontuação</th></tr>
      ${MORSE_ITEMS.map(item => `<tr><td>${item.label}</td><td>${av.morseScores[item.key] ?? "—"}</td></tr>`).join("")}
      <tr><td class="total">TOTAL</td><td class="total">${mt} — ${mr.label}</td></tr>
    </table>
    ${av.observacoes ? `<p><strong>Observações:</strong> ${av.observacoes}</p>` : ""}
    </body></html>`);
    win.document.close();
    win.print();
  }

  const bt = bradenTotal(bradenScores);
  const mt = morseTotal(morseScores);
  const bradenComplete = BRADEN_ITEMS.every(i => bradenScores[i.key] !== undefined);
  const morseComplete = MORSE_ITEMS.every(i => morseScores[i.key] !== undefined);

  return (
    <div className="space-y-4">
      {canEdit && !showForm && (
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> Nova Avaliação
        </Button>
      )}

      {showForm && (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-5">
            {/* BRADEN */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Escala de Braden — Risco de Lesão por Pressão
              </p>
              <div className="space-y-2">
                {BRADEN_ITEMS.map(item => (
                  <div key={item.key} className="grid grid-cols-1 sm:grid-cols-3 gap-1 items-center">
                    <label className="text-xs font-medium col-span-1">{item.label}</label>
                    <select
                      className="col-span-2 h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={bradenScores[item.key] ?? ""}
                      onChange={e => setBradenScores({ ...bradenScores, [item.key]: Number(e.target.value) })}
                    >
                      <option value="">Selecione…</option>
                      {item.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {bradenComplete && (
                <div className="mt-2 p-2 rounded-md bg-muted/30 flex items-center gap-2">
                  <span className="text-xs font-semibold">Total Braden: {bt}</span>
                  <Badge variant="outline" className={`text-xs ${bradenRisco(bt).color}`}>{bradenRisco(bt).label}</Badge>
                </div>
              )}
            </div>

            {/* MORSE */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Escala de Morse — Risco de Queda
              </p>
              <div className="space-y-2">
                {MORSE_ITEMS.map(item => (
                  <div key={item.key} className="grid grid-cols-1 sm:grid-cols-3 gap-1 items-center">
                    <label className="text-xs font-medium col-span-1">{item.label}</label>
                    <select
                      className="col-span-2 h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={morseScores[item.key] ?? ""}
                      onChange={e => setMorseScores({ ...morseScores, [item.key]: Number(e.target.value) })}
                    >
                      <option value="">Selecione…</option>
                      {item.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {morseComplete && (
                <div className="mt-2 p-2 rounded-md bg-muted/30 flex items-center gap-2">
                  <span className="text-xs font-semibold">Total Morse: {mt}</span>
                  <Badge variant="outline" className={`text-xs ${morseRisco(mt).color}`}>{morseRisco(mt).label}</Badge>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                placeholder="Registrado por (nome e cargo)"
                value={registradoPor}
                onChange={e => setRegistradoPor(e.target.value)}
              />
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none"
                placeholder="Observações e condutas (opcional)"
                rows={2}
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={handleSave} disabled={!bradenComplete || !morseComplete || !registradoPor.trim()}>
                Salvar Avaliação
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {avaliacoes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <ShieldAlert className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma avaliação registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {avaliacoes.map(av => {
            const bt2 = bradenTotal(av.bradenScores);
            const mt2 = morseTotal(av.morseScores);
            return (
              <Card key={av.id} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(av.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      {av.registradoPor && <span className="text-xs text-muted-foreground">— {av.registradoPor}</span>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => handlePrint(av)}>
                      <Printer className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 rounded-md bg-muted/20 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Braden</p>
                      <p className="text-lg font-bold">{bt2}</p>
                      <Badge variant="outline" className={`text-[10px] ${bradenRisco(bt2).color}`}>{bradenRisco(bt2).label}</Badge>
                    </div>
                    <div className="p-2 rounded-md bg-muted/20 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Morse</p>
                      <p className="text-lg font-bold">{mt2}</p>
                      <Badge variant="outline" className={`text-[10px] ${morseRisco(mt2).color}`}>{morseRisco(mt2).label}</Badge>
                    </div>
                  </div>
                  {av.observacoes && <p className="text-xs text-muted-foreground mt-2">{av.observacoes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

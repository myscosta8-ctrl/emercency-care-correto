import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, X, Search, Pill, Bandage, Activity, Utensils, FileText, FlaskConical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MEDICAMENTOS, VIAS_ADMINISTRACAO, FREQUENCIAS,
  FREQ_CURATIVOS, FREQ_VITAIS, DIETAS, PRODUTOS_CURATIVO,
  EXAMES_LABORATORIAIS, EXAMES_IMAGEM, PRIORIDADES_EXAME,
} from "@/lib/medicamentos-brasil";
import type { ViaAdministracao } from "@/lib/medicamentos-brasil";

/* ── types ─────────────────────────────────────────────────────────── */
export interface ItemMedicamento {
  id: string; nome: string; dose: string; unidade: string;
  via: ViaAdministracao | string; frequencia: string; horario: string; obs: string;
}
export interface ItemCurativo {
  id: string; local: string; tecnica: string;
  produtos: string[]; frequencia: string; obs: string;
}
export interface MonitorizacaoVitais {
  ativo: boolean; frequencia: string; parametros: string[];
}
export interface SolicitacaoExames {
  laboratoriais: string[];
  imagem: string[];
  prioridade: "urgente" | "rotina" | "eletivo";
  justificativa: string;
}
export interface PrescricaoMedicaData {
  medicamentos: ItemMedicamento[];
  curativos: ItemCurativo[];
  monitorizacao: MonitorizacaoVitais;
  dieta: string;
  exames: SolicitacaoExames;
  outros: string;
}

const PARAM_VITAIS = ["PA", "FC", "FR", "SpO₂", "Temperatura", "Glicemia (HGT)", "Diurese", "Balanço Hídrico"];
const UNIDADES = ["mg", "g", "mcg", "mL", "UI", "mEq", "mg/kg", "mcg/kg/min", "gts/min", "cp", "amp"];

function uid() { return Math.random().toString(36).slice(2); }

/* ── Autocomplete medicamento ──────────────────────────────────────── */
function MedSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const hits = useMemo(() => {
    if (!q || q.length < 2) return [];
    const lq = q.toLowerCase();
    return MEDICAMENTOS.filter(m => m.nome.toLowerCase().includes(lq)).slice(0, 8);
  }, [q]);
  function pick(nome: string) { setQ(nome); onChange(nome); setOpen(false); }
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input value={q}
          onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar ou digitar medicamento…" className="pl-8 h-8 text-xs" />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
          {hits.map(m => (
            <button key={m.nome} type="button" onMouseDown={() => pick(m.nome)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between gap-2">
              <span className="font-medium">{m.nome}</span>
              <span className="text-muted-foreground shrink-0">{m.vias.join(", ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const VIA_RAPIDAS = ["EV", "IM", "VO"] as const;
const FREQ_RAPIDAS = ["SN", "SOS", "ACM"] as const;

/* ── Seção Medicamentos ────────────────────────────────────────────── */
function SecaoMedicamentos({ items, onChange }: { items: ItemMedicamento[]; onChange: (items: ItemMedicamento[]) => void }) {
  function add() { onChange([...items, { id: uid(), nome: "", dose: "", unidade: "mg", via: "EV", frequencia: "1x/dia", horario: "", obs: "" }]); }
  function remove(id: string) { onChange(items.filter(i => i.id !== id)); }
  function update(id: string, patch: Partial<ItemMedicamento>) { onChange(items.map(i => i.id === id ? { ...i, ...patch } : i)); }
  const getVias = (nome: string) => { const m = MEDICAMENTOS.find(m => m.nome === nome); return m ? m.vias : [...VIAS_ADMINISTRACAO]; };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border border-border/60 bg-card/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
            <button type="button" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>

          <MedSearch value={item.nome} onChange={v => update(item.id, { nome: v })} />

          {/* Dose + Unidade */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Dose</Label>
              <Input value={item.dose} onChange={e => update(item.id, { dose: e.target.value })}
                placeholder="Ex: 500" className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Unidade</Label>
              <select value={item.unidade} onChange={e => update(item.id, { unidade: e.target.value })}
                className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Via */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Via de administração</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Quick-pick EV / IM / VO */}
              {VIA_RAPIDAS.map(v => (
                <button key={v} type="button" onClick={() => update(item.id, { via: v })}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-semibold border transition-all",
                    item.via === v
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}>
                  {v}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground/40 select-none">|</span>
              {/* Full dropdown for other routes */}
              <select value={item.via} onChange={e => update(item.id, { via: e.target.value as ViaAdministracao })}
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-[110px]">
                {getVias(item.nome).map(v => <option key={v} value={v}>{v}</option>)}
                {!getVias(item.nome).includes(item.via as ViaAdministracao) && item.via && <option value={item.via}>{item.via}</option>}
                {VIAS_ADMINISTRACAO.filter(v => !getVias(item.nome).includes(v)).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Frequência */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Frequência</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Quick-pick SN / SOS / ACM */}
              {FREQ_RAPIDAS.map(f => (
                <button key={f} type="button" onClick={() => update(item.id, { frequencia: f })}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-semibold border transition-all",
                    item.frequencia === f
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                      : "border-border/60 text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                  )}>
                  {f}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground/40 select-none">|</span>
              {/* Full dropdown */}
              <select value={item.frequencia} onChange={e => update(item.id, { frequencia: e.target.value })}
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-[150px]">
                {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* Horário de aplicação */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Horário de aplicação</Label>
            <Input value={item.horario} onChange={e => update(item.id, { horario: e.target.value })}
              placeholder="Ex: 06h / 14h / 22h" className="h-7 text-xs" />
          </div>

          {/* Observação */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Observação / Diluição</Label>
            <Input value={item.obs} onChange={e => update(item.id, { obs: e.target.value })}
              placeholder="Ex: diluir em 100 mL SF 0,9%, infundir em 30 min…" className="h-7 text-xs" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 h-8 border-dashed text-xs" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Adicionar Medicamento
      </Button>
    </div>
  );
}

/* ── Seção Curativos ───────────────────────────────────────────────── */
function SecaoCurativos({ items, onChange }: { items: ItemCurativo[]; onChange: (items: ItemCurativo[]) => void }) {
  function add() { onChange([...items, { id: uid(), local: "", tecnica: "Curativo simples", produtos: [], frequencia: "1x/dia", obs: "" }]); }
  function remove(id: string) { onChange(items.filter(i => i.id !== id)); }
  function update(id: string, patch: Partial<ItemCurativo>) { onChange(items.map(i => i.id === id ? { ...i, ...patch } : i)); }
  function toggleProduto(id: string, prod: string) {
    const item = items.find(i => i.id === id); if (!item) return;
    update(id, { produtos: item.produtos.includes(prod) ? item.produtos.filter(p => p !== prod) : [...item.produtos, prod] });
  }
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border border-border/60 bg-card/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Curativo #{idx + 1}</span>
            <button type="button" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Local / Região</Label>
              <Input value={item.local} onChange={e => update(item.id, { local: e.target.value })} placeholder="Ex: tornozelo direito" className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Técnica</Label>
              <select value={item.tecnica} onChange={e => update(item.id, { tecnica: e.target.value })}
                className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                {["Curativo simples","Curativo complexo","Curativo com desbridamento","Curativo compressivo","Curativo oclusivo","Limpeza de ferida cirúrgica"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Produtos</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRODUTOS_CURATIVO.map(p => (
                <button key={p} type="button" onClick={() => toggleProduto(item.id, p)}
                  className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                    item.produtos.includes(p) ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>{p}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Frequência</Label>
              <select value={item.frequencia} onChange={e => update(item.id, { frequencia: e.target.value })}
                className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                {FREQ_CURATIVOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Observação</Label>
              <Input value={item.obs} onChange={e => update(item.id, { obs: e.target.value })} placeholder="Observações adicionais…" className="h-7 text-xs" />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 h-8 border-dashed text-xs" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Adicionar Curativo
      </Button>
    </div>
  );
}

/* ── Seção Monitorização ───────────────────────────────────────────── */
function SecaoMonitorizacao({ value, onChange }: { value: MonitorizacaoVitais; onChange: (v: MonitorizacaoVitais) => void }) {
  function toggleParam(p: string) {
    const next = value.parametros.includes(p) ? value.parametros.filter(x => x !== p) : [...value.parametros, p];
    onChange({ ...value, parametros: next });
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="checkbox" id="mon-ativo" checked={value.ativo}
          onChange={e => onChange({ ...value, ativo: e.target.checked })} className="h-4 w-4 rounded border-border" />
        <Label htmlFor="mon-ativo" className="text-xs cursor-pointer">Prescrever monitorização de sinais vitais</Label>
      </div>
      {value.ativo && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Frequência</Label>
            <select value={value.frequencia} onChange={e => onChange({ ...value, frequencia: e.target.value })}
              className="w-full h-8 rounded-md border border-input bg-transparent px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
              {FREQ_VITAIS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Parâmetros</Label>
            <div className="flex flex-wrap gap-1.5">
              {PARAM_VITAIS.map(p => (
                <button key={p} type="button" onClick={() => toggleParam(p)}
                  className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                    value.parametros.includes(p) ? "border-blue-500/60 bg-blue-500/10 text-blue-400" : "border-border/50 text-muted-foreground hover:border-border")}>{p}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Grupo de exames colapsável ────────────────────────────────────── */
function GrupoExame({ grupo, exames, selecionados, onToggle }: {
  grupo: string; exames: string[]; selecionados: string[]; onToggle: (e: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const countSel = exames.filter(e => selecionados.includes(e)).length;
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/30 transition-colors text-left gap-2">
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {grupo}
        </span>
        {countSel > 0 && (
          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{countSel}</span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border/30 bg-card/10">
          {exames.map(e => (
            <button key={e} type="button" onClick={() => onToggle(e)}
              className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                selecionados.includes(e) ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground")}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Seção Exames ──────────────────────────────────────────────────── */
function SecaoExames({ value, onChange }: { value: SolicitacaoExames; onChange: (v: SolicitacaoExames) => void }) {
  const [subtab, setSubtab] = useState<"lab" | "img">("lab");

  function toggleLab(e: string) {
    const next = value.laboratoriais.includes(e) ? value.laboratoriais.filter(x => x !== e) : [...value.laboratoriais, e];
    onChange({ ...value, laboratoriais: next });
  }
  function toggleImg(e: string) {
    const next = value.imagem.includes(e) ? value.imagem.filter(x => x !== e) : [...value.imagem, e];
    onChange({ ...value, imagem: next });
  }

  const totalLab = value.laboratoriais.length;
  const totalImg = value.imagem.length;
  const total = totalLab + totalImg;

  return (
    <div className="space-y-3">
      {/* Prioridade */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</Label>
        <div className="flex gap-2">
          {PRIORIDADES_EXAME.map(p => (
            <button key={p.value} type="button" onClick={() => onChange({ ...value, prioridade: p.value })}
              className={cn("flex-1 py-1.5 rounded-md border text-xs font-medium transition-all",
                value.prioridade === p.value ? p.color : "border-border/50 text-muted-foreground hover:border-border")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs lab / imagem */}
      <div className="flex border-b border-border/50">
        <button type="button" onClick={() => setSubtab("lab")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors",
            subtab === "lab" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Laboratoriais
          {totalLab > 0 && <span className={cn("text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center", subtab === "lab" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{totalLab}</span>}
        </button>
        <button type="button" onClick={() => setSubtab("img")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors",
            subtab === "img" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Imagem
          {totalImg > 0 && <span className={cn("text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center", subtab === "img" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{totalImg}</span>}
        </button>
      </div>

      {/* Listagem */}
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
        {subtab === "lab" && EXAMES_LABORATORIAIS.map(g => (
          <GrupoExame key={g.grupo} grupo={g.grupo} exames={g.exames}
            selecionados={value.laboratoriais} onToggle={toggleLab} />
        ))}
        {subtab === "img" && EXAMES_IMAGEM.map(g => (
          <GrupoExame key={g.grupo} grupo={g.grupo} exames={g.exames}
            selecionados={value.imagem} onToggle={toggleImg} />
        ))}
      </div>

      {/* Resumo selecionados */}
      {total > 0 && (
        <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{total} exame{total !== 1 ? "s" : ""} selecionado{total !== 1 ? "s" : ""}</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {[...value.laboratoriais, ...value.imagem].join(" · ")}
          </p>
        </div>
      )}

      {/* Justificativa clínica */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Justificativa clínica <span className="text-muted-foreground/50">(opcional)</span></Label>
        <Textarea value={value.justificativa} onChange={e => onChange({ ...value, justificativa: e.target.value })}
          placeholder="Ex: Investigação de síndrome inflamatória, suspeita de IAM, avaliação pré-operatória…"
          className="min-h-[60px] text-xs resize-none" />
      </div>
    </div>
  );
}

/* ── Tab button ────────────────────────────────────────────────────── */
function Tab({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; count?: number;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap",
        active ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn("text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center",
          active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{count}</span>
      )}
    </button>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
interface MedicalPrescriptionFormProps {
  patientName: string;
  onSerialize: (text: string, data: PrescricaoMedicaData) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function MedicalPrescriptionForm({ patientName, onSerialize, onCancel, isPending }: MedicalPrescriptionFormProps) {
  const [tab, setTab] = useState<"med" | "cur" | "mon" | "diet" | "exames" | "outros">("med");
  const [medicamentos, setMedicamentos] = useState<ItemMedicamento[]>([]);
  const [curativos, setCurativos] = useState<ItemCurativo[]>([]);
  const [monitorizacao, setMonitorizacao] = useState<MonitorizacaoVitais>({
    ativo: false, frequencia: "4/4h", parametros: ["PA", "FC", "SpO₂", "Temperatura"],
  });
  const [dieta, setDieta] = useState("Via oral livre");
  const [dietaObs, setDietaObs] = useState("");
  const [exames, setExames] = useState<SolicitacaoExames>({
    laboratoriais: [], imagem: [], prioridade: "rotina", justificativa: "",
  });
  const [outros, setOutros] = useState("");

  const now = new Date();

  function serialize() {
    const lines: string[] = [
      `PRESCRIÇÃO MÉDICA — ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      `Paciente: ${patientName}`,
      "",
    ];

    if (medicamentos.length > 0) {
      lines.push("MEDICAMENTOS:");
      medicamentos.forEach((m, i) => {
        // Format: nome dose+unidade — via — freq — horario (obs)
        let base = `${i + 1}. ${m.nome} ${m.dose}${m.unidade} — ${m.via} — ${m.frequencia}`;
        if (m.horario) base += ` — ${m.horario}`;
        lines.push(m.obs ? `${base} (${m.obs})` : base);
      });
      lines.push("");
    }

    if (curativos.length > 0) {
      lines.push("CURATIVOS:");
      curativos.forEach((c, i) => {
        const prods = c.produtos.length > 0 ? ` [${c.produtos.join(", ")}]` : "";
        const obs = c.obs ? ` — ${c.obs}` : "";
        lines.push(`${i + 1}. ${c.tecnica}${c.local ? ` em ${c.local}` : ""}${prods} — ${c.frequencia}${obs}`);
      });
      lines.push("");
    }

    if (monitorizacao.ativo) {
      const params = monitorizacao.parametros.length > 0 ? monitorizacao.parametros.join(", ") : "Sinais Vitais Completos";
      lines.push("MONITORIZAÇÃO:");
      lines.push(`- ${params} — ${monitorizacao.frequencia}`);
      lines.push("");
    }

    lines.push("DIETA:");
    lines.push(`- ${dieta}${dietaObs ? ` — ${dietaObs}` : ""}`);
    lines.push("");

    const totalExames = exames.laboratoriais.length + exames.imagem.length;
    if (totalExames > 0) {
      const prio = PRIORIDADES_EXAME.find(p => p.value === exames.prioridade)?.label ?? exames.prioridade;
      lines.push(`EXAMES SOLICITADOS [${prio.toUpperCase()}]:`);
      if (exames.laboratoriais.length > 0) {
        lines.push("  Laboratoriais:");
        exames.laboratoriais.forEach(e => lines.push(`  - ${e}`));
      }
      if (exames.imagem.length > 0) {
        lines.push("  Imagem:");
        exames.imagem.forEach(e => lines.push(`  - ${e}`));
      }
      if (exames.justificativa.trim()) {
        lines.push(`  Justificativa: ${exames.justificativa.trim()}`);
      }
      lines.push("");
    }

    if (outros.trim()) {
      lines.push("OUTROS:");
      lines.push(outros.trim());
    }

    onSerialize(lines.join("\n"), {
      medicamentos, curativos, monitorizacao,
      dieta: `${dieta}${dietaObs ? " — " + dietaObs : ""}`,
      exames, outros,
    });
  }

  const totalExames = exames.laboratoriais.length + exames.imagem.length;
  const hasContent = medicamentos.length > 0 || curativos.length > 0 || monitorizacao.ativo || totalExames > 0 || outros.trim();

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-muted/30 rounded-t-lg px-4 py-3 border border-border/50 border-b-0">
        <p className="text-[11px] text-muted-foreground">{patientName} · {format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
      </div>

      {/* Tabs */}
      <div className="border border-border/50 border-b-0 border-t-0 bg-card/20 px-3 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          <Tab active={tab === "med"}    onClick={() => setTab("med")}    icon={Pill}        label="Medicamentos"  count={medicamentos.length} />
          <Tab active={tab === "cur"}    onClick={() => setTab("cur")}    icon={Bandage}     label="Curativos"     count={curativos.length} />
          <Tab active={tab === "mon"}    onClick={() => setTab("mon")}    icon={Activity}    label="Monitorização" count={monitorizacao.ativo ? 1 : 0} />
          <Tab active={tab === "diet"}   onClick={() => setTab("diet")}   icon={Utensils}    label="Dieta" />
          <Tab active={tab === "exames"} onClick={() => setTab("exames")} icon={FlaskConical} label="Exames"       count={totalExames} />
          <Tab active={tab === "outros"} onClick={() => setTab("outros")} icon={FileText}    label="Outros" />
        </div>
      </div>

      {/* Tab content */}
      <div className="border border-border/50 rounded-b-lg p-4 bg-card/10 min-h-[200px]">
        {tab === "med"    && <SecaoMedicamentos items={medicamentos} onChange={setMedicamentos} />}
        {tab === "cur"    && <SecaoCurativos items={curativos} onChange={setCurativos} />}
        {tab === "mon"    && <SecaoMonitorizacao value={monitorizacao} onChange={setMonitorizacao} />}
        {tab === "exames" && <SecaoExames value={exames} onChange={setExames} />}
        {tab === "diet" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Dieta</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {DIETAS.map(d => (
                  <button key={d} type="button" onClick={() => setDieta(d)}
                    className={cn("text-left text-xs px-3 py-2 rounded-md border transition-colors",
                      dieta === d ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground")}>{d}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observação adicional</Label>
              <Input value={dietaObs} onChange={e => setDietaObs(e.target.value)}
                placeholder="Ex: baixo resíduo, sem lactose, consistência…" className="h-8 text-xs" />
            </div>
          </div>
        )}
        {tab === "outros" && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outros Itens Prescritos</Label>
            <p className="text-[11px] text-muted-foreground">O2-terapia, cateterismo, posição, restrição de movimento, etc.</p>
            <Textarea value={outros} onChange={e => setOutros(e.target.value)}
              placeholder={"Ex:\n- O2 por cateter nasal 3L/min\n- Cateter vesical de demora\n- Cabeceira elevada 30°\n- Acesso venoso periférico em MSD"}
              className="min-h-[120px] text-xs font-mono resize-y" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isPending}>Cancelar</Button>
        <Button type="button" onClick={serialize} className="flex-1" disabled={isPending || !hasContent}>
          {isPending ? "Salvando…" : "Salvar Prescrição Médica"}
        </Button>
      </div>
    </div>
  );
}

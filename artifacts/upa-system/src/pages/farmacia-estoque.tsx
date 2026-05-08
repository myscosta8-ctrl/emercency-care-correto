import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package, Plus, Search, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, Calendar, BarChart3, ScanLine, RefreshCw,
  Camera, CameraOff, Edit2, Check, X, Printer, FileDown,
  ChevronDown, ChevronUp, TrendingDown, Pill,
} from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

// ── types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  standard_qty: number;
  min_qty: number;
  barcode: string;
  location: string;
  active: boolean;
  notes: string;
  current_qty: number;
}

interface InventoryBatch {
  id: number;
  item_id: number;
  item_name: string;
  item_unit: string;
  lot_number: string;
  quantity: number;
  expiry_date: string | null;
  received_at: string;
  notes: string;
  days_until_expiry?: number;
}

interface InventoryTransaction {
  id: number;
  item_id: number;
  item_name: string;
  item_unit: string;
  type: string;
  quantity: number;
  patient_name: string;
  staff_name: string;
  notes: string;
  created_at: string;
}

// ── constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  medicamento:    { label: "Medicamento",    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  controlado:     { label: "Controlado",     color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  sala_vermelha:  { label: "Sala Vermelha",  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  antimicrobiano: { label: "Antimicrobiano", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  material:       { label: "Material",       color: "text-teal-400",   bg: "bg-teal-500/10 border-teal-500/20" },
  solucao:        { label: "Solução IV",     color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20" },
  rx:             { label: "Raio-X",         color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  equipamento:    { label: "Equipamento",    color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
};

const UNITS = ["Comprimidos","Ampolas","Frascos","Vidros","Unidades","Caixas","Rolos","Pares","Pacotes","Bisnagas","Garrafas"];

const TRANS_LABELS: Record<string, { label: string; color: string }> = {
  entrada:     { label: "Entrada",   color: "text-green-400" },
  saida:       { label: "Saída",     color: "text-red-400" },
  ajuste:      { label: "Ajuste",    color: "text-yellow-400" },
  descarte:    { label: "Descarte",  color: "text-orange-400" },
  dispensacao: { label: "Dispensação", color: "text-blue-400" },
};

function stockStatus(item: InventoryItem) {
  if (item.current_qty === 0) return { label: "Zerado",    color: "text-red-500",    bg: "bg-red-500/10" };
  if (item.current_qty <= item.min_qty) return { label: "Crítico", color: "text-orange-400", bg: "bg-orange-500/10" };
  if (item.current_qty <= item.min_qty * 1.5) return { label: "Baixo",  color: "text-yellow-400", bg: "bg-yellow-500/10" };
  return { label: "OK", color: "text-green-400", bg: "bg-green-500/10" };
}

function expiryStatus(days: number) {
  if (days < 0)  return { label: "Vencido",    color: "text-red-500",    bg: "bg-red-500/15 border-red-500/30" };
  if (days <= 30) return { label: `${days}d`,  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" };
  if (days <= 60) return { label: `${days}d`,  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
  return               { label: `${days}d`,    color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`/api/inventory${path}`, {
    headers: { "Content-Type": "application/json", ...((opts?.headers) ?? {}) },
    ...opts,
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Erro ${r.status}`);
  }
  return r.json() as Promise<T>;
}

// ── sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat: string }) {
  const c = CATEGORIES[cat] ?? { label: cat, color: "text-muted-foreground", bg: "bg-muted/30 border-border" };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border", c.bg, c.color)}>
      {c.label}
    </span>
  );
}

function StockBadge({ item }: { item: InventoryItem }) {
  const s = stockStatus(item);
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold", s.bg, s.color)}>
      {item.current_qty} {item.unit}
      {s.label !== "OK" && <AlertTriangle className="h-2.5 w-2.5" />}
    </span>
  );
}

// ── STOCK TAB ─────────────────────────────────────────────────────────────────

function StockTab() {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState("todos");
  const [lowstockOnly, setLowOnly]    = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const [editQty, setEditQty]         = useState("");
  const [editNotes, setEditNotes]     = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem]         = useState({ code:"", name:"", unit:"Unidades", category:"material", standard_qty:"0", min_qty:"0", barcode:"", location:"", notes:"" });

  const { data: items = [], isLoading, refetch } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items", category, search, lowstockOnly],
    queryFn: () => {
      const p = new URLSearchParams();
      if (category !== "todos") p.set("category", category);
      if (search) p.set("search", search);
      if (lowstockOnly) p.set("lowstock", "1");
      return apiFetch<InventoryItem[]>(`/items?${p}`);
    },
    refetchInterval: 30000,
  });

  const adjustMut = useMutation({
    mutationFn: ({ id, qty, notes }: { id: number; qty: number; notes: string }) =>
      apiFetch(`/stock/${id}`, { method: "PATCH", body: JSON.stringify({
        quantity: qty, notes, staff_id: activeUser?.id, staff_name: activeUser?.name,
      })}),
    onSuccess: () => {
      toast({ title: "Estoque ajustado com sucesso" });
      setEditId(null);
      void qc.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const addMut = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiFetch<InventoryItem>("/items", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Item cadastrado com sucesso" });
      setShowAddForm(false);
      setNewItem({ code:"", name:"", unit:"Unidades", category:"material", standard_qty:"0", min_qty:"0", barcode:"", location:"", notes:"" });
      void qc.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const grouped = (() => {
    const g: Record<string, InventoryItem[]> = {};
    for (const item of items) {
      (g[item.category] ??= []).push(item);
    }
    return g;
  })();

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar item, código ou código de barras…"
            className="pl-8 h-8 text-sm" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="todos">Todas categorias</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={() => setLowOnly(v => !v)}
          className={cn("h-8 px-3 rounded-md border text-xs font-medium transition-colors",
            lowstockOnly ? "bg-orange-500/15 border-orange-500/40 text-orange-400" : "border-border text-muted-foreground hover:bg-muted/40")}>
          <TrendingDown className="h-3.5 w-3.5 inline mr-1" />
          Baixo estoque
        </button>
        <Button size="sm" variant="outline" onClick={() => void refetch()} className="h-8 px-2">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)} className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo Item
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
          <p className="text-sm font-semibold text-foreground">Cadastrar novo item</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input className="h-8 text-sm mt-1" value={newItem.name}
                onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Código</Label>
              <Input className="h-8 text-sm mt-1" value={newItem.code}
                onChange={e => setNewItem(v => ({ ...v, code: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Código de barras</Label>
              <Input className="h-8 text-sm mt-1" value={newItem.barcode}
                onChange={e => setNewItem(v => ({ ...v, barcode: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <select value={newItem.unit} onChange={e => setNewItem(v => ({ ...v, unit: e.target.value }))}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <select value={newItem.category} onChange={e => setNewItem(v => ({ ...v, category: e.target.value }))}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Qtd. padrão pedido</Label>
              <Input type="number" className="h-8 text-sm mt-1" value={newItem.standard_qty}
                onChange={e => setNewItem(v => ({ ...v, standard_qty: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Qtd. mínima</Label>
              <Input type="number" className="h-8 text-sm mt-1" value={newItem.min_qty}
                onChange={e => setNewItem(v => ({ ...v, min_qty: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Localização</Label>
              <Input className="h-8 text-sm mt-1" value={newItem.location}
                onChange={e => setNewItem(v => ({ ...v, location: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMut.mutate(newItem)} disabled={!newItem.name || addMut.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de itens", value: items.length, color: "text-foreground" },
          { label: "Sem estoque",    value: items.filter(i => i.current_qty === 0).length, color: "text-red-400" },
          { label: "Estoque crítico",value: items.filter(i => i.current_qty > 0 && i.current_qty <= i.min_qty).length, color: "text-orange-400" },
          { label: "Categorias",     value: Object.keys(grouped).length, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="border border-border rounded-lg p-3 bg-card">
            <div className={cn("text-2xl font-black", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando estoque…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Nenhum item encontrado</div>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="border border-border rounded-lg overflow-hidden">
            <div className={cn("flex items-center gap-2 px-4 py-2 border-b border-border", CATEGORIES[cat]?.bg ?? "bg-muted/20")}>
              <span className={cn("text-xs font-black uppercase tracking-wider", CATEGORIES[cat]?.color ?? "")}>
                {CATEGORIES[cat]?.label ?? cat}
              </span>
              <span className="text-[10px] text-muted-foreground">({catItems.length} itens)</span>
            </div>
            <div className="divide-y divide-border/50">
              {catItems.map(item => {
                const s = stockStatus(item);
                const isEditing = editId === item.id;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    {/* code */}
                    {item.code && (
                      <span className="text-[10px] font-mono text-muted-foreground/60 w-10 shrink-0">{item.code}</span>
                    )}
                    {/* name */}
                    <span className="flex-1 text-sm text-foreground font-medium truncate">{item.name}</span>
                    {/* location */}
                    {item.location && (
                      <span className="text-[10px] text-muted-foreground hidden md:inline-block">{item.location}</span>
                    )}
                    {/* stock badge */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <Input type="number" className="h-7 w-24 text-xs" value={editQty}
                          onChange={e => setEditQty(e.target.value)} />
                        <Input placeholder="motivo" className="h-7 w-32 text-xs" value={editNotes}
                          onChange={e => setEditNotes(e.target.value)} />
                        <button className="text-green-400 hover:text-green-300"
                          onClick={() => adjustMut.mutate({ id: item.id, qty: Number(editQty), notes: editNotes })}>
                          <Check className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs font-bold", s.bg, s.color)}>
                          {item.current_qty} <span className="font-normal text-[10px] text-muted-foreground">{item.unit}</span>
                          {s.label !== "OK" && <AlertTriangle className="h-3 w-3 ml-0.5" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground hidden md:inline-block">
                          mín {item.min_qty} · padrão {item.standard_qty}
                        </span>
                        <button className="text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => { setEditId(item.id); setEditQty(String(item.current_qty)); setEditNotes(""); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── ENTRY TAB ─────────────────────────────────────────────────────────────────

function EntryTab() {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch]       = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [qty, setQty]             = useState("");
  const [lot, setLot]             = useState("");
  const [expiry, setExpiry]       = useState("");
  const [notes, setNotes]         = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items", "todos", search, false],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      return apiFetch<InventoryItem[]>(`/items?${p}`);
    },
    enabled: search.length > 0,
  });

  const { data: recent = [] } = useQuery<InventoryTransaction[]>({
    queryKey: ["inventory-transactions", "entrada"],
    queryFn: () => apiFetch<InventoryTransaction[]>("/transactions?type=entrada&limit=10"),
    refetchInterval: 15000,
  });

  const entryMut = useMutation({
    mutationFn: (body: Record<string, string | number>) =>
      apiFetch("/entry", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Entrada registrada com sucesso!" });
      setSelectedItem(null); setQty(""); setLot(""); setExpiry(""); setNotes(""); setSearch("");
      void qc.invalidateQueries({ queryKey: ["inventory-items"] });
      void qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const handleBarcodeSubmit = () => {
    if (!barcodeInput.trim()) return;
    setSearch(barcodeInput.trim());
    setBarcodeInput("");
  };

  const handleSave = () => {
    if (!selectedItem || !qty) return;
    entryMut.mutate({
      item_id: selectedItem.id, quantity: Number(qty),
      lot_number: lot, expiry_date: expiry, notes,
      staff_id: activeUser?.id ?? 0, staff_name: activeUser?.name ?? "",
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left — entry form */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-green-400" /> Registrar Entrada de Pedido
        </h3>

        {/* Barcode quick-find */}
        <div className="border border-border rounded-lg p-3 bg-muted/10 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Leitor de código (USB/teclado)
          </p>
          <div className="flex gap-2">
            <Input placeholder="Leia o código de barras aqui…"
              className="h-8 text-sm font-mono" value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleBarcodeSubmit(); }} />
            <Button size="sm" variant="outline" onClick={handleBarcodeSubmit} className="h-8">
              <ScanLine className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div>
          <Label className="text-xs">Buscar item por nome ou código</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Digite para buscar…"
              value={search} onChange={e => { setSearch(e.target.value); setSelectedItem(null); }} />
          </div>
          {search.length > 0 && items.length > 0 && !selectedItem && (
            <div className="border border-border rounded-md mt-1 bg-popover max-h-48 overflow-y-auto shadow-lg z-10">
              {items.slice(0, 10).map(item => (
                <button key={item.id} onClick={() => { setSelectedItem(item); setSearch(item.name); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left">
                  <CategoryBadge cat={item.category} />
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.current_qty} {item.unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected item */}
        {selectedItem && (
          <div className="border border-green-500/30 rounded-lg p-3 bg-green-500/5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{selectedItem.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estoque atual: <span className="font-semibold text-foreground">{selectedItem.current_qty} {selectedItem.unit}</span>
                </p>
              </div>
              <CategoryBadge cat={selectedItem.category} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade recebida *</Label>
                <Input type="number" min="1" className="h-8 text-sm mt-1" value={qty}
                  onChange={e => setQty(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Input className="h-8 text-sm mt-1" value={selectedItem.unit} disabled />
              </div>
              <div>
                <Label className="text-xs">Nº do lote</Label>
                <Input className="h-8 text-sm mt-1" value={lot} onChange={e => setLot(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Validade</Label>
                <Input type="date" className="h-8 text-sm mt-1" value={expiry}
                  onChange={e => setExpiry(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="text-sm mt-1 min-h-[60px]" value={notes}
                onChange={e => setNotes(e.target.value)} placeholder="Fornecedor, NF, etc." />
            </div>
            <Button onClick={handleSave} disabled={!qty || entryMut.isPending} className="w-full bg-green-600 hover:bg-green-700">
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Confirmar Entrada — {qty || 0} {selectedItem.unit}
            </Button>
          </div>
        )}
      </div>

      {/* Right — recent entries */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Entradas recentes</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma entrada registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(t => (
              <div key={t.id} className="border border-border rounded-lg p-3 bg-card text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground text-sm">{t.item_name}</span>
                  <span className="text-green-400 font-bold shrink-0">+{t.quantity} {t.item_unit}</span>
                </div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>{t.staff_name}</span>
                  <span>{format(parseISO(t.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                {t.notes && <p className="text-muted-foreground/70">{t.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EXIT TAB ──────────────────────────────────────────────────────────────────

function ExitTab() {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch]           = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [qty, setQty]                 = useState("");
  const [patientName, setPatientName] = useState("");
  const [notes, setNotes]             = useState("");

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items", "todos", search, false],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      return apiFetch<InventoryItem[]>(`/items?${p}`);
    },
    enabled: search.length > 0,
  });

  const { data: recent = [] } = useQuery<InventoryTransaction[]>({
    queryKey: ["inventory-transactions", "saida"],
    queryFn: () => apiFetch<InventoryTransaction[]>("/transactions?type=saida&limit=10"),
    refetchInterval: 15000,
  });

  const exitMut = useMutation({
    mutationFn: (body: Record<string, string | number>) =>
      apiFetch("/exit", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Saída registrada com sucesso!" });
      setSelectedItem(null); setQty(""); setPatientName(""); setNotes(""); setSearch("");
      void qc.invalidateQueries({ queryKey: ["inventory-items"] });
      void qc.invalidateQueries({ queryKey: ["inventory-transactions"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ArrowUpFromLine className="h-4 w-4 text-red-400" /> Registrar Saída / Dispensação
        </h3>

        <div>
          <Label className="text-xs">Buscar item</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Nome ou código…"
              value={search} onChange={e => { setSearch(e.target.value); setSelectedItem(null); }} />
          </div>
          {search.length > 0 && items.length > 0 && !selectedItem && (
            <div className="border border-border rounded-md mt-1 bg-popover max-h-48 overflow-y-auto shadow-lg">
              {items.slice(0, 10).map(item => (
                <button key={item.id} onClick={() => { setSelectedItem(item); setSearch(item.name); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left">
                  <CategoryBadge cat={item.category} />
                  <span className="flex-1 truncate">{item.name}</span>
                  <StockBadge item={item} />
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <div className="border border-red-500/30 rounded-lg p-3 bg-red-500/5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{selectedItem.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estoque atual: <span className={cn("font-semibold", stockStatus(selectedItem).color)}>
                    {selectedItem.current_qty} {selectedItem.unit}
                  </span>
                </p>
              </div>
              <CategoryBadge cat={selectedItem.category} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade *</Label>
                <Input type="number" min="1" max={selectedItem.current_qty} className="h-8 text-sm mt-1"
                  value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Paciente (opcional)</Label>
                <Input className="h-8 text-sm mt-1" value={patientName}
                  onChange={e => setPatientName(e.target.value)} placeholder="Nome do paciente" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="text-sm mt-1 min-h-[60px]" value={notes}
                onChange={e => setNotes(e.target.value)} />
            </div>
            {selectedItem.current_qty < Number(qty || 0) && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Quantidade maior que o estoque disponível ({selectedItem.current_qty})
              </p>
            )}
            <Button onClick={() => exitMut.mutate({
              item_id: selectedItem.id, quantity: Number(qty),
              patient_name: patientName, notes,
              staff_id: activeUser?.id ?? 0, staff_name: activeUser?.name ?? "",
            })}
              disabled={!qty || Number(qty) <= 0 || exitMut.isPending || Number(qty) > selectedItem.current_qty}
              className="w-full bg-red-700 hover:bg-red-800">
              <ArrowUpFromLine className="h-4 w-4 mr-2" />
              Confirmar Saída — {qty || 0} {selectedItem.unit}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Saídas recentes</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma saída registrada.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(t => (
              <div key={t.id} className="border border-border rounded-lg p-3 bg-card text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground text-sm">{t.item_name}</span>
                  <span className="text-red-400 font-bold shrink-0">-{t.quantity} {t.item_unit}</span>
                </div>
                <div className="flex gap-3 text-muted-foreground">
                  {t.patient_name && <span>Pac: {t.patient_name}</span>}
                  <span>{t.staff_name}</span>
                  <span>{format(parseISO(t.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                {t.notes && <p className="text-muted-foreground/70">{t.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EXPIRY TAB ────────────────────────────────────────────────────────────────

function ExpiryTab() {
  const [days, setDays] = useState(90);

  const { data: batches = [], isLoading } = useQuery<InventoryBatch[]>({
    queryKey: ["inventory-batches-expiring", days],
    queryFn: () => apiFetch<InventoryBatch[]>(`/reports/expiring?days=${days}`),
    refetchInterval: 60000,
  });

  const expired  = batches.filter(b => (b.days_until_expiry ?? 999) < 0);
  const critical = batches.filter(b => (b.days_until_expiry ?? 999) >= 0 && (b.days_until_expiry ?? 999) <= 30);
  const warning  = batches.filter(b => (b.days_until_expiry ?? 999) > 30);

  const renderBatch = (b: InventoryBatch) => {
    const d = b.days_until_expiry ?? 0;
    const s = expiryStatus(d);
    return (
      <div key={b.id} className={cn("flex items-center gap-3 px-4 py-2.5 border rounded-lg text-sm", s.bg)}>
        <span className={cn("text-[11px] font-black w-16 text-center shrink-0 px-2 py-1 rounded", s.color, "bg-background/60")}>
          {d < 0 ? "Vencido" : `${d}d`}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{b.item_name}</p>
          <p className="text-xs text-muted-foreground">
            Lote: {b.lot_number || "—"} · Qtd: {b.quantity} {b.item_unit}
            {b.expiry_date && ` · Vencimento: ${format(parseISO(b.expiry_date), "dd/MM/yyyy")}`}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-yellow-400" /> Controle de Validade
        </h3>
        <div className="flex items-center gap-2 ml-auto">
          <Label className="text-xs text-muted-foreground">Janela:</Label>
          {[30, 60, 90, 180].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors",
                days === d ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40")}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
      ) : batches.length === 0 ? (
        <div className="border border-green-500/20 rounded-lg p-6 bg-green-500/5 text-center">
          <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-400">Nenhum item vencendo nos próximos {days} dias</p>
        </div>
      ) : (
        <div className="space-y-4">
          {expired.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-red-500">
                Vencidos ({expired.length})
              </p>
              {expired.map(renderBatch)}
            </div>
          )}
          {critical.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-orange-400">
                Vencendo em até 30 dias ({critical.length})
              </p>
              {critical.map(renderBatch)}
            </div>
          )}
          {warning.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-yellow-400">
                Vencendo em 31–{days} dias ({warning.length})
              </p>
              {warning.map(renderBatch)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── REPORTS TAB ───────────────────────────────────────────────────────────────

function ReportsTab() {
  const { data: lowStock = [], isLoading: loadingLow } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-reports-low"],
    queryFn: () => apiFetch<InventoryItem[]>("/reports/low-stock"),
    refetchInterval: 60000,
  });

  const { data: full = [], isLoading: loadingFull } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-reports-full"],
    queryFn: () => apiFetch<InventoryItem[]>("/reports/full"),
  });

  const printLowStock = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = lowStock.map(i => `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 8px">${i.code || "—"}</td>
        <td style="padding:6px 8px;font-weight:600">${i.name}</td>
        <td style="padding:6px 8px">${CATEGORIES[i.category]?.label ?? i.category}</td>
        <td style="padding:6px 8px;color:${i.current_qty === 0 ? "#dc2626" : "#ea580c"};font-weight:700">
          ${i.current_qty} ${i.unit}
        </td>
        <td style="padding:6px 8px">${i.min_qty} ${i.unit}</td>
        <td style="padding:6px 8px">${i.standard_qty} ${i.unit}</td>
        <td style="padding:6px 8px">${i.location || "—"}</td>
      </tr>`).join("");
    win.document.write(`
      <html><head><title>Estoque Crítico — UPA Breves</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
      table{width:100%;border-collapse:collapse}
      th{background:#1e3a5f;color:#fff;padding:8px;text-align:left;font-size:11px}
      h2{color:#1e3a5f}p{color:#666;font-size:11px}</style></head>
      <body>
      <h2>UPA 24h — Breves/PA</h2>
      <h3>Relatório de Estoque Crítico / Baixo</h3>
      <p>Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      <table><thead><tr>
        <th>Código</th><th>Descrição</th><th>Categoria</th>
        <th>Estoque Atual</th><th>Qtd. Mínima</th><th>Qtd. Padrão</th><th>Localização</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  const printFullStock = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const byCategory = Object.entries(
      full.reduce<Record<string, InventoryItem[]>>((acc, i) => {
        (acc[i.category] ??= []).push(i); return acc;
      }, {})
    );
    const rows = byCategory.map(([cat, items]) => `
      <tr style="background:#e8f0fe"><td colspan="6" style="padding:8px;font-weight:800;text-transform:uppercase;font-size:11px;color:#1e3a5f">
        ${CATEGORIES[cat]?.label ?? cat} (${items.length} itens)
      </td></tr>
      ${items.map(i => `<tr style="border-bottom:1px solid #eee">
        <td style="padding:5px 8px;font-size:11px">${i.code || "—"}</td>
        <td style="padding:5px 8px;font-weight:600;font-size:11px">${i.name}</td>
        <td style="padding:5px 8px;font-size:11px">${i.current_qty} ${i.unit}</td>
        <td style="padding:5px 8px;font-size:11px">${i.min_qty}</td>
        <td style="padding:5px 8px;font-size:11px">${i.standard_qty}</td>
        <td style="padding:5px 8px;font-size:11px">${i.location || "—"}</td>
      </tr>`).join("")}`).join("");
    win.document.write(`
      <html><head><title>Estoque Completo — UPA Breves</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
      table{width:100%;border-collapse:collapse}
      th{background:#1e3a5f;color:#fff;padding:8px;text-align:left;font-size:11px}
      h2{color:#1e3a5f}p{color:#666;font-size:11px}</style></head>
      <body>
      <h2>UPA 24h — Breves/PA</h2>
      <h3>Relatório de Estoque Completo</h3>
      <p>Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")} · Total: ${full.length} itens</p>
      <table><thead><tr>
        <th>Código</th><th>Descrição</th><th>Estoque Atual</th>
        <th>Qtd. Mínima</th><th>Qtd. Padrão</th><th>Localização</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  const exportCSV = () => {
    const header = ["Código","Descrição","Categoria","Estoque Atual","Unidade","Qtd. Mínima","Qtd. Padrão","Localização","Status"];
    const csvRows = full.map(i => [
      i.code, i.name, CATEGORIES[i.category]?.label ?? i.category,
      i.current_qty, i.unit, i.min_qty, i.standard_qty, i.location,
      stockStatus(i).label,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `estoque-upa-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Low stock report */}
        <div className="border border-orange-500/30 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-orange-500/10 border-b border-orange-500/20">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-foreground">Estoque Crítico / Baixo</span>
              {!loadingLow && (
                <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                  {lowStock.length}
                </span>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={printLowStock} className="h-7 text-xs">
              <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loadingLow ? (
              <p className="text-xs text-muted-foreground p-4">Carregando…</p>
            ) : lowStock.length === 0 ? (
              <div className="p-4 text-center">
                <Check className="h-6 w-6 text-green-400 mx-auto mb-1" />
                <p className="text-xs text-green-400">Todos os itens com estoque OK</p>
              </div>
            ) : lowStock.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2 border-b border-border/50 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{CATEGORIES[item.category]?.label ?? item.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-bold", stockStatus(item).color)}>
                    {item.current_qty} {item.unit}
                  </p>
                  <p className="text-[10px] text-muted-foreground">mín: {item.min_qty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileDown className="h-4 w-4 text-blue-400" /> Exportar & Imprimir
          </h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start h-10" onClick={printFullStock} disabled={loadingFull}>
              <Printer className="h-4 w-4 mr-2 text-blue-400" />
              Imprimir estoque completo (PDF)
            </Button>
            <Button variant="outline" className="w-full justify-start h-10" onClick={printLowStock} disabled={loadingLow}>
              <Printer className="h-4 w-4 mr-2 text-orange-400" />
              Imprimir estoque crítico (PDF)
            </Button>
            <Button variant="outline" className="w-full justify-start h-10" onClick={exportCSV} disabled={loadingFull}>
              <FileDown className="h-4 w-4 mr-2 text-green-400" />
              Exportar CSV (Excel)
            </Button>
          </div>
          <div className="border border-border rounded-md p-3 bg-muted/10 space-y-1">
            <p className="text-xs font-semibold text-foreground">Resumo do estoque</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>Total de itens:</span><span className="font-semibold text-foreground">{full.length}</span>
              <span>Sem estoque:</span><span className="font-semibold text-red-400">{full.filter(i => i.current_qty === 0).length}</span>
              <span>Estoque crítico:</span><span className="font-semibold text-orange-400">{full.filter(i => i.current_qty > 0 && i.current_qty <= i.min_qty).length}</span>
              <span>Estoque baixo:</span><span className="font-semibold text-yellow-400">{full.filter(i => i.current_qty > i.min_qty && i.current_qty <= i.min_qty * 1.5).length}</span>
              <span>Estoque OK:</span><span className="font-semibold text-green-400">{full.filter(i => i.current_qty > i.min_qty * 1.5).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <TransactionHistory />
    </div>
  );
}

function TransactionHistory() {
  const [type, setType]   = useState("todos");
  const [expanded, setExpanded] = useState(false);

  const { data: transactions = [], isLoading } = useQuery<InventoryTransaction[]>({
    queryKey: ["inventory-transactions", type],
    queryFn: () => {
      const p = new URLSearchParams({ limit: expanded ? "100" : "20" });
      if (type !== "todos") p.set("type", type);
      return apiFetch<InventoryTransaction[]>(`/transactions?${p}`);
    },
    refetchInterval: 30000,
  });

  const qc = useQueryClient();

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Histórico de Movimentações</span>
        <div className="flex items-center gap-2">
          <select value={type} onChange={e => setType(e.target.value)}
            className="h-7 rounded border border-input bg-background px-2 text-xs">
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
            <option value="ajuste">Ajustes</option>
          </select>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void qc.invalidateQueries({ queryKey: ["inventory-transactions"] })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground p-4">Carregando…</p>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">Nenhuma movimentação encontrada.</p>
        ) : transactions.map(t => {
          const tl = TRANS_LABELS[t.type] ?? { label: t.type, color: "text-muted-foreground" };
          const sign = t.type === "entrada" ? "+" : t.type === "saida" ? "-" : "±";
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-muted/20">
              <span className={cn("font-black w-16 shrink-0 text-center", tl.color)}>{tl.label}</span>
              <span className="flex-1 truncate font-medium text-foreground">{t.item_name}</span>
              <span className={cn("font-bold shrink-0", tl.color)}>{sign}{Math.abs(t.quantity)} {t.item_unit}</span>
              <span className="text-muted-foreground shrink-0 hidden md:inline">{t.staff_name}</span>
              <span className="text-muted-foreground/60 shrink-0 hidden md:inline">
                {format(parseISO(t.created_at), "dd/MM HH:mm")}
              </span>
            </div>
          );
        })}
      </div>
      {!expanded && transactions.length >= 20 && (
        <button onClick={() => setExpanded(true)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors flex items-center justify-center gap-1">
          <ChevronDown className="h-3.5 w-3.5" /> Ver mais
        </button>
      )}
    </div>
  );
}

// ── SCANNER TAB ───────────────────────────────────────────────────────────────

function ScannerTab() {
  const { toast } = useToast();
  const { activeUser } = useAuth();
  const qc = useQueryClient();
  const [scannerMode, setScannerMode] = useState<"keyboard" | "camera">("keyboard");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [foundItem, setFoundItem]       = useState<InventoryItem | null>(null);
  const [action, setAction]             = useState<"entry" | "exit">("entry");
  const [qty, setQty]                   = useState("1");
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<{ stop: () => void } | null>(null);
  const qrDivRef   = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scannerMode === "keyboard") inputRef.current?.focus();
  }, [scannerMode]);

  // cleanup camera on unmount
  useEffect(() => () => { scannerRef.current?.stop(); }, []);

  const searchByBarcode = useCallback(async (code: string) => {
    if (!code.trim()) return;
    try {
      const items = await apiFetch<InventoryItem[]>(`/items?search=${encodeURIComponent(code)}`);
      const match = items.find(i => i.barcode === code || i.code === code) ?? items[0] ?? null;
      if (match) {
        setFoundItem(match);
        toast({ title: `Item encontrado: ${match.name}` });
      } else {
        toast({ variant: "destructive", title: "Item não encontrado", description: `Código: ${code}` });
      }
    } catch {
      toast({ variant: "destructive", title: "Erro ao buscar item" });
    }
  }, [toast]);

  const handleKeyboardScan = async () => {
    await searchByBarcode(barcodeInput.trim());
    setBarcodeInput("");
  };

  const startCamera = async () => {
    if (!qrDivRef.current) return;
    try {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(
        async (decodedText: string) => { await searchByBarcode(decodedText); },
        (error: unknown) => { void error; }
      );
      scannerRef.current = { stop: () => scanner.clear().catch(() => {}) };
      setCameraActive(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao abrir câmera", description: String(e) });
    }
  };

  const stopCamera = () => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setCameraActive(false);
  };

  const confirmAction = async () => {
    if (!foundItem) return;
    const endpoint = action === "entry" ? "/entry" : "/exit";
    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          item_id: foundItem.id, quantity: Number(qty),
          staff_id: activeUser?.id, staff_name: activeUser?.name,
          notes: `Via leitor de código — ${action === "entry" ? "Entrada" : "Saída"}`,
        }),
      });
      toast({ title: `${action === "entry" ? "Entrada" : "Saída"} confirmada: ${qty} ${foundItem.unit} de ${foundItem.name}` });
      setFoundItem(null); setQty("1");
      void qc.invalidateQueries({ queryKey: ["inventory-items"] });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-blue-400" /> Leitor de Código de Barras
      </h3>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setScannerMode("keyboard"); stopCamera(); }}
          className={cn("flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all",
            scannerMode === "keyboard" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
          <ScanLine className="h-4 w-4 inline mr-1.5" /> Leitor USB (Teclado)
        </button>
        <button onClick={() => setScannerMode("camera")}
          className={cn("flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all",
            scannerMode === "camera" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
          <Camera className="h-4 w-4 inline mr-1.5" /> Câmera
        </button>
      </div>

      {/* Keyboard mode */}
      {scannerMode === "keyboard" && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <p className="text-xs text-muted-foreground">
            Aponte o leitor de código (USB) para o item e pressione Enter, ou digite manualmente.
          </p>
          <div className="flex gap-2">
            <Input ref={inputRef}
              className="h-10 text-sm font-mono flex-1 border-primary/30 focus:border-primary"
              placeholder="Aguardando leitura do código…"
              value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void handleKeyboardScan(); }}
              autoFocus />
            <Button onClick={() => void handleKeyboardScan()} className="h-10">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Camera mode */}
      {scannerMode === "camera" && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Use a câmera do dispositivo para ler QR Codes e códigos de barras.</p>
            <Button size="sm" variant={cameraActive ? "destructive" : "default"}
              onClick={cameraActive ? stopCamera : () => void startCamera()}>
              {cameraActive ? <><CameraOff className="h-3.5 w-3.5 mr-1" /> Parar</> : <><Camera className="h-3.5 w-3.5 mr-1" /> Iniciar</>}
            </Button>
          </div>
          <div id="qr-reader" ref={qrDivRef} className="rounded-lg overflow-hidden" />
        </div>
      )}

      {/* Found item */}
      {foundItem && (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-foreground">{foundItem.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Estoque atual: <span className={cn("font-semibold", stockStatus(foundItem).color)}>
                  {foundItem.current_qty} {foundItem.unit}
                </span>
              </p>
            </div>
            <CategoryBadge cat={foundItem.category} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ação</Label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setAction("entry")}
                  className={cn("flex-1 py-1.5 rounded border text-xs font-semibold transition-all",
                    action === "entry" ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-border text-muted-foreground")}>
                  Entrada
                </button>
                <button onClick={() => setAction("exit")}
                  className={cn("flex-1 py-1.5 rounded border text-xs font-semibold transition-all",
                    action === "exit" ? "border-red-500/40 bg-red-500/15 text-red-400" : "border-border text-muted-foreground")}>
                  Saída
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min="1" className="h-8 text-sm mt-1" value={qty}
                onChange={e => setQty(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void confirmAction()}
              className={cn("flex-1", action === "entry" ? "bg-green-600 hover:bg-green-700" : "bg-red-700 hover:bg-red-800")}>
              {action === "entry" ? <ArrowDownToLine className="h-4 w-4 mr-1" /> : <ArrowUpFromLine className="h-4 w-4 mr-1" />}
              Confirmar {action === "entry" ? "Entrada" : "Saída"}
            </Button>
            <Button variant="ghost" onClick={() => setFoundItem(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

type Tab = "estoque" | "entrada" | "saida" | "validade" | "relatorios" | "scanner";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "estoque",    label: "Estoque",          icon: <Package className="h-3.5 w-3.5" /> },
  { id: "entrada",    label: "Entrada",           icon: <ArrowDownToLine className="h-3.5 w-3.5" /> },
  { id: "saida",      label: "Saída",             icon: <ArrowUpFromLine className="h-3.5 w-3.5" /> },
  { id: "validade",   label: "Validade",          icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: "relatorios", label: "Relatórios",        icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "scanner",    label: "Leitor de Código",  icon: <ScanLine className="h-3.5 w-3.5" /> },
];

export default function FarmaciaEstoquePage() {
  const [activeTab, setActiveTab] = useState<Tab>("estoque");

  return (
    <div className="min-h-screen bg-background">
      <RoleHeader
        title="Estoque de Farmácia"
        icon={<Package className="h-5 w-5" />}
      />
      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto pb-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[60vh]">
          {activeTab === "estoque"    && <StockTab />}
          {activeTab === "entrada"    && <EntryTab />}
          {activeTab === "saida"      && <ExitTab />}
          {activeTab === "validade"   && <ExpiryTab />}
          {activeTab === "relatorios" && <ReportsTab />}
          {activeTab === "scanner"    && <ScannerTab />}
        </div>
      </div>
    </div>
  );
}

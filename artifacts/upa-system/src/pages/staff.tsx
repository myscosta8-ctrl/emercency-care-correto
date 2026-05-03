import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Plus, Pencil, Trash2, Users, X, Check, ChevronDown, UserCircle, Mail, ToggleLeft, ToggleRight } from "lucide-react";
import { useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from "@workspace/api-client-react";
import type { StaffMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "recepcionista",    label: "Recepcionista" },
  { value: "enfermeiro",       label: "Enfermeiro" },
  { value: "tecnico_enfermagem", label: "Técnico de Enfermagem" },
  { value: "medico",           label: "Médico" },
  { value: "assistente_social", label: "Assistente Social" },
  { value: "nutricionista",    label: "Nutricionista" },
  { value: "farmaceutico",     label: "Farmacêutico" },
  { value: "administrador",    label: "Administrador" },
] as const;

const ACCESS_LEVELS = [
  { value: "admin",                   label: "Admin" },
  { value: "coordenacao_enfermagem",  label: "Coordenação de Enfermagem" },
  { value: "assistencial",            label: "Profissional Assistencial" },
] as const;

const EDITOR_ROLES = new Set(["admin", "coordenacao_enfermagem"]);

const SECTOR_LABEL: Record<string, string> = {
  sala_vermelha:         "Sala Vermelha",
  observacao_adulto:     "Observação Adulto",
  observacao_pediatrica: "Observação Pediátrica",
  observacao_pre_adulto: "Observação Pré-Adulto",
  todos_os_setores:      "Todos os Setores",
};

const SECTORS = [
  { value: "sala_vermelha",         label: "Sala Vermelha"         },
  { value: "observacao_adulto",     label: "Observação Adulto"     },
  { value: "observacao_pediatrica", label: "Observação Pediátrica" },
  { value: "observacao_pre_adulto", label: "Observação Pré-Adulto" },
  { value: "todos_os_setores",      label: "Todos os Setores"      },
];

const CATEGORY_LABEL: Record<string, string> = {
  recepcionista:     "Recepcionista",
  enfermeiro:        "Enfermeiro",
  tecnico_enfermagem: "Técnico de Enfermagem",
  medico:            "Médico",
  assistente_social: "Assistente Social",
  nutricionista:     "Nutricionista",
  farmaceutico:      "Farmacêutico",
  administrador:     "Administrador",
};
const CATEGORY_COLOR: Record<string, string> = {
  recepcionista:     "text-pink-400   bg-pink-500/10   border-pink-500/30",
  enfermeiro:        "text-cyan-400   bg-cyan-500/10   border-cyan-500/30",
  tecnico_enfermagem:"text-blue-400   bg-blue-500/10   border-blue-500/30",
  medico:            "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  assistente_social: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  nutricionista:     "text-lime-400   bg-lime-500/10   border-lime-500/30",
  farmaceutico:      "text-amber-400  bg-amber-500/10  border-amber-500/30",
  administrador:     "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};
const COREN_LABEL: Record<string, string> = {
  enfermeiro:        "COREN",
  tecnico_enfermagem:"COREN",
  medico:            "CRM",
};

// ── signature pad ─────────────────────────────────────────────────────────────

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value && value.startsWith("data:")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    lastPos.current = getPos(e);
    e.preventDefault();
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !lastPos.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, []);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="relative border border-border/40 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/50 pointer-events-none">
          Assine acima
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 text-xs text-muted-foreground">
        <X className="h-3 w-3 mr-1" /> Limpar assinatura
      </Button>
    </div>
  );
}

// ── staff form ─────────────────────────────────────────────────────────────────

interface FormData {
  nome: string;
  perfil: "recepcionista" | "enfermeiro" | "tecnico_enfermagem" | "medico" | "assistente_social" | "nutricionista" | "farmaceutico" | "administrador";
  email: string;
  ativo: boolean;
  corenCrm: string;
  sector: string;
  login: string;
  password: string;
  accessLevels: string[];
  signature: string;
  stamp: string;
}

const defaultForm = (): FormData => ({
  nome: "",
  perfil: "recepcionista",
  email: "",
  ativo: true,
  corenCrm: "",
  sector: "",
  login: "",
  password: "",
  accessLevels: [],
  signature: "",
  stamp: "",
});

function buildStamp(f: FormData): string {
  const catLabel = CATEGORIES.find(c => c.value === f.perfil)?.label ?? "";
  const corenLabel = COREN_LABEL[f.perfil] ?? "Reg.";
  return [
    f.nome,
    catLabel,
    f.corenCrm ? `${corenLabel}: ${f.corenCrm}` : "",
    f.sector,
  ].filter(Boolean).join("\n");
}

interface StaffFormProps {
  initial?: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}

function StaffForm({ initial, onClose, onSaved }: StaffFormProps) {
  const { toast } = useToast();
  const createMut = useCreateStaff();
  const updateMut = useUpdateStaff();

  const [form, setForm] = useState<FormData>(() => {
    if (!initial) return defaultForm();
    return {
      nome: initial.nome,
      perfil: initial.perfil as FormData["perfil"],
      email: initial.email,
      ativo: initial.ativo,
      corenCrm: initial.corenCrm,
      sector: initial.sector,
      login: initial.login,
      password: "",
      accessLevels: initial.accessLevels ? initial.accessLevels.split(",").filter(Boolean) : [],
      signature: initial.signature,
      stamp: initial.stamp,
    };
  });

  const set = (patch: Partial<FormData>) => setForm(prev => ({ ...prev, ...patch }));

  const toggleAccess = (v: string) => {
    set({ accessLevels: form.accessLevels.includes(v)
      ? form.accessLevels.filter(x => x !== v)
      : [...form.accessLevels, v] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.login || (!initial && !form.password)) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const payload = {
      nome: form.nome,
      perfil: form.perfil,
      email: form.email,
      ativo: form.ativo,
      corenCrm: form.corenCrm,
      sector: form.sector,
      login: form.login,
      ...(form.password ? { password: form.password } : {}),
      accessLevels: form.accessLevels.join(","),
      signature: form.signature,
      stamp: form.stamp || buildStamp(form),
    };

    try {
      if (initial) {
        await updateMut.mutateAsync({ id: initial.id, data: payload });
        toast({ title: "Funcionário atualizado" });
      } else {
        await createMut.mutateAsync({ data: { ...payload, password: form.password } });
        toast({ title: "Funcionário cadastrado" });
      }
      onSaved();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold">{initial ? "Editar Funcionário" : "Novo Funcionário"}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* nome + ativo */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Nome completo <span className="text-red-400">*</span></Label>
              <Input
                value={form.nome}
                onChange={e => set({ nome: e.target.value })}
                placeholder="Nome completo do funcionário"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => set({ ativo: !form.ativo })}
              className={cn(
                "flex items-center gap-1.5 h-10 px-3 rounded-md border text-sm font-medium transition-colors shrink-0",
                form.ativo
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "border-border/50 text-muted-foreground bg-muted/20 hover:bg-muted/40"
              )}
            >
              {form.ativo
                ? <ToggleRight className="h-4 w-4" />
                : <ToggleLeft className="h-4 w-4" />}
              {form.ativo ? "Ativo" : "Inativo"}
            </button>
          </div>

          {/* e-mail */}
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                value={form.email}
                onChange={e => set({ email: e.target.value })}
                placeholder="funcionario@upa.gov.br"
                className="pl-9"
              />
            </div>
          </div>

          {/* categoria + coren/crm */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoria <span className="text-red-400">*</span></Label>
              <div className="relative">
                <select
                  value={form.perfil}
                  onChange={e => set({ perfil: e.target.value as FormData["perfil"] })}
                  className="w-full h-10 bg-background border border-input rounded-md px-3 pr-8 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{COREN_LABEL[form.perfil] ?? "Registro"}</Label>
              <Input
                value={form.corenCrm}
                onChange={e => set({ corenCrm: e.target.value })}
                placeholder={`Nº do ${COREN_LABEL[form.perfil]}`}
              />
            </div>
          </div>

          {/* setor */}
          <div className="space-y-1.5">
            <Label>Setor</Label>
            <div className="relative">
              <select
                value={form.sector}
                onChange={e => set({ sector: e.target.value })}
                className="w-full h-10 bg-background border border-input rounded-md px-3 pr-8 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecione o setor</option>
                {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* login + senha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Login (e-mail ou usuário) <span className="text-red-400">*</span></Label>
              <Input
                value={form.login}
                onChange={e => set({ login: e.target.value })}
                placeholder="email@upa.gov.br"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Senha {!initial && <span className="text-red-400">*</span>}
                {initial && <span className="text-xs text-muted-foreground ml-1">(deixe em branco para manter)</span>}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => set({ password: e.target.value })}
                placeholder={initial ? "Nova senha (opcional)" : "Senha individual"}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* nível de acesso */}
          <div className="space-y-2">
            <Label>Nível de acesso</Label>
            <div className="flex flex-wrap gap-2">
              {ACCESS_LEVELS.map(a => {
                const active = form.accessLevels.includes(a.value);
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => toggleAccess(a.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/20 border-primary/60 text-primary"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      active ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )}>
                      {active && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* assinatura digital */}
          <div className="space-y-1.5">
            <Label>Assinatura digital</Label>
            <SignaturePad
              value={form.signature}
              onChange={sig => set({ signature: sig })}
            />
          </div>

          {/* carimbo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Carimbo (para impressão)</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => set({ stamp: buildStamp(form) })}
              >
                Gerar automaticamente
              </button>
            </div>
            <textarea
              value={form.stamp}
              onChange={e => set({ stamp: e.target.value })}
              placeholder={buildStamp(form) || "Nome\nCargo / Registro\nSetor"}
              rows={3}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
            {form.stamp && (
              <div className="mt-1 p-3 border border-dashed border-border/60 rounded-lg bg-white/5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Prévia do carimbo</p>
                <pre className="text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap">{form.stamp}</pre>
              </div>
            )}
          </div>

          {/* actions */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? "Salvando..." : initial ? "Salvar alterações" : "Cadastrar funcionário"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── staff card ─────────────────────────────────────────────────────────────────

interface StaffCardProps {
  member: StaffMember;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

function StaffCard({ member, onEdit, onDelete, canEdit }: StaffCardProps) {
  const levels = member.accessLevels ? member.accessLevels.split(",").filter(Boolean) : [];
  const [showStamp, setShowStamp] = useState(false);
  const [showSig, setShowSig] = useState(false);

  return (
    <div className="bg-card border border-border/40 rounded-xl p-4 hover:border-border/70 transition-colors">
      <div className="flex items-start justify-between gap-3">
        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-sm text-foreground truncate">{member.nome}</h3>
            {!member.ativo && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground bg-muted/20 shrink-0">
                Inativo
              </span>
            )}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0",
              CATEGORY_COLOR[member.perfil]
            )}>
              {CATEGORY_LABEL[member.perfil]}
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {member.corenCrm && (
              <p>{COREN_LABEL[member.perfil]}: <span className="text-foreground font-mono">{member.corenCrm}</span></p>
            )}
            {member.sector && <p>Setor: <span className="text-foreground">{SECTOR_LABEL[member.sector] ?? member.sector}</span></p>}
            {member.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" /><span className="text-foreground">{member.email}</span></p>}
            <p>Login: <span className="text-foreground font-mono">{member.login}</span></p>
          </div>
          {levels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {levels.map(l => (
                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted/50 text-muted-foreground border border-border/40 uppercase tracking-wide">
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex gap-1 shrink-0">
          {canEdit ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 px-1">🔒</span>
          )}
        </div>
      </div>

      {/* signature / stamp toggles */}
      {(member.signature || member.stamp) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
          {member.signature && (
            <button
              onClick={() => setShowSig(p => !p)}
              className="text-[11px] text-primary hover:underline"
            >
              {showSig ? "Ocultar" : "Ver"} assinatura
            </button>
          )}
          {member.stamp && (
            <button
              onClick={() => setShowStamp(p => !p)}
              className="text-[11px] text-primary hover:underline"
            >
              {showStamp ? "Ocultar" : "Ver"} carimbo
            </button>
          )}
        </div>
      )}
      {showSig && member.signature && (
        <div className="mt-2 border border-border/30 rounded-lg overflow-hidden bg-slate-900">
          <img src={member.signature} alt="Assinatura" className="w-full max-h-24 object-contain" />
        </div>
      )}
      {showStamp && member.stamp && (
        <div className="mt-2 p-3 border border-dashed border-border/50 rounded-lg bg-white/5">
          <pre className="text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap">{member.stamp}</pre>
        </div>
      )}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: staff, isLoading } = useListStaff();
  const deleteMut = useDeleteStaff();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("todos");
  const { activeUser, setActiveLogin } = useAuth();
  const activeRoles = activeUser?.accessLevels?.split(",").filter(Boolean) ?? [];
  const canEdit = activeRoles.some(r => EDITOR_ROLES.has(r));

  const handleSetActive = (login: string) => setActiveLogin(login);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/staff"] });

  const handleDelete = async (m: StaffMember) => {
    if (!confirm(`Remover ${m.nome}?`)) return;
    await deleteMut.mutateAsync({ id: m.id });
    toast({ title: "Funcionário removido" });
    invalidate();
  };

  const filtered = (staff ?? []).filter(m => {
    const matchSearch = m.nome.toLowerCase().includes(search.toLowerCase()) ||
      m.login.toLowerCase().includes(search.toLowerCase()) ||
      m.corenCrm.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "todos" || m.perfil === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Users className="h-4 w-4 text-primary" />
            <h1 className="text-base font-bold tracking-tight">Funcionários</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:flex items-center gap-1.5">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <select
                value={activeUser?.login ?? ""}
                onChange={e => handleSetActive(e.target.value)}
                className="h-8 text-xs bg-background border border-input rounded-md px-2 pr-6 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-ring max-w-[140px]"
              >
                <option value="">Selecionar acesso</option>
                {(staff ?? []).map(m => (
                  <option key={m.id} value={m.login}>{m.nome}</option>
                ))}
              </select>
              {activeUser && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide",
                  canEdit ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/30 border-border/40 text-muted-foreground"
                )}>
                  {canEdit ? "✓ Editor" : "🔒 Leitura"}
                </span>
              )}
            </div>
            {(canEdit || !staff?.length) && (
              <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
                <Plus className="h-3.5 w-3.5" />
                Novo Funcionário
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-4xl">
        {/* filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <Input
            placeholder="Buscar por nome, login ou registro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            {[
              { value: "todos", label: "Todos" },
              ...CATEGORIES.map(c => ({ value: c.value, label: CATEGORY_LABEL[c.value] })),
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilterCat(f.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap",
                  filterCat === f.value
                    ? "bg-primary/20 border-primary/60 text-primary"
                    : "border-border/50 text-muted-foreground hover:bg-muted/30"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* counts */}
        <div className="flex flex-wrap gap-4 mb-5">
          {[
            { label: "Total", count: staff?.length ?? 0, cls: "text-foreground" },
            { label: "Recep.", count: staff?.filter(m => m.perfil === "recepcionista").length ?? 0, cls: "text-pink-400" },
            { label: "Enferm.", count: staff?.filter(m => m.perfil === "enfermeiro").length ?? 0, cls: "text-cyan-400" },
            { label: "Técnicos", count: staff?.filter(m => m.perfil === "tecnico_enfermagem").length ?? 0, cls: "text-blue-400" },
            { label: "Médicos", count: staff?.filter(m => m.perfil === "medico").length ?? 0, cls: "text-emerald-400" },
            { label: "Assist.", count: staff?.filter(m => m.perfil === "assistente_social").length ?? 0, cls: "text-purple-400" },
            { label: "Nutri.", count: staff?.filter(m => m.perfil === "nutricionista").length ?? 0, cls: "text-lime-400" },
            { label: "Farmac.", count: staff?.filter(m => m.perfil === "farmaceutico").length ?? 0, cls: "text-amber-400" },
            { label: "Admin.", count: staff?.filter(m => m.perfil === "administrador").length ?? 0, cls: "text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/30 rounded-xl px-4 py-2.5 min-w-[80px]">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("text-2xl font-bold", s.cls)}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* list */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">
              {staff?.length === 0 ? "Nenhum funcionário cadastrado." : "Nenhum resultado para a busca."}
            </p>
            {staff?.length === 0 && (
              <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
                <Plus className="h-3.5 w-3.5 mr-2" /> Cadastrar primeiro funcionário
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(m => (
              <StaffCard
                key={m.id}
                member={m}
                canEdit={canEdit}
                onEdit={() => { setEditing(m); setShowForm(true); }}
                onDelete={() => handleDelete(m)}
              />
            ))}
          </div>
        )}
      </main>

      {/* form modal */}
      {showForm && (
        <StaffForm
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); invalidate(); }}
        />
      )}
    </div>
  );
}

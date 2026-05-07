import { useState, useCallback } from "react";
import { AdminLayout } from "./layout";
import {
  useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, getListStaffQueryKey,
} from "@workspace/api-client-react";
import type { StaffMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, UserCircle, Check, Minus, ToggleLeft, ToggleRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PERFIL_LABELS, PERFIS, PERMISSOES, ACOES, ACAO_LABELS } from "@/lib/permissions";
import type { Perfil } from "@/lib/permissions";

const PERFIL_COLOR: Record<Perfil, string> = {
  recepcionista:           "text-pink-400   bg-pink-500/10   border-pink-500/30",
  enfermeiro:              "text-cyan-400   bg-cyan-500/10   border-cyan-500/30",
  tecnico_enfermagem:      "text-blue-400   bg-blue-500/10   border-blue-500/30",
  medico:                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  assistente_social:       "text-purple-400 bg-purple-500/10 border-purple-500/30",
  nutricionista:           "text-lime-400   bg-lime-500/10   border-lime-500/30",
  farmaceutico:            "text-amber-400  bg-amber-500/10  border-amber-500/30",
  administrador:           "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  auxiliar_administrativo: "text-slate-400  bg-slate-500/10  border-slate-500/30",
  diretoria_geral:         "text-rose-400   bg-rose-500/10   border-rose-500/30",
};

const SECTOR_OPTIONS = [
  { value: "todos_os_setores",      label: "Todos os Setores"      },
  { value: "triagem",               label: "Triagem"               },
  { value: "sala_vermelha",         label: "Sala Vermelha"         },
  { value: "observacao_adulto",     label: "Observação Adulto"     },
  { value: "observacao_pediatrica", label: "Observação Pediátrica" },
  { value: "observacao_pre_adulto", label: "Observação Pré-Adulto" },
];

interface FormState {
  name: string;
  login: string;
  role: Perfil;
  email: string;
  sector: string;
  corenCrm: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "", login: "", role: "recepcionista",
  email: "", sector: "todos_os_setores", corenCrm: "", active: true,
};

function PermissoesPreview({ perfil }: { perfil: Perfil }) {
  const perms = PERMISSOES[perfil] ?? [];
  const isAdmin = perms.includes("*");

  return (
    <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Permissões deste perfil
      </div>
      {isAdmin ? (
        <p className="text-xs text-yellow-400 font-semibold">Acesso total a todas as funções do sistema.</p>
      ) : (
        <div className="grid grid-cols-1 gap-1">
          {ACOES.map(acao => {
            const tem = perms.includes(acao);
            return (
              <div key={acao} className={cn("flex items-center gap-2 text-[11px]", tem ? "text-foreground" : "text-muted-foreground/40")}>
                {tem
                  ? <Check className="h-3 w-3 text-green-400 shrink-0" />
                  : <Minus className="h-3 w-3 shrink-0" />}
                {ACAO_LABELS[acao]}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StaffForm({
  initial,
  isEditing,
  onSave,
  onCancel,
  isPending,
}: {
  initial: FormState;
  isEditing: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Nome completo *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Maria Silva" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Login *</Label>
          {isEditing ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border/50 bg-muted/30 text-sm text-muted-foreground">
              <span className="font-mono">{form.login}</span>
              <span className="text-[10px] ml-auto opacity-60">não editável</span>
            </div>
          ) : (
            <Input value={form.login} onChange={e => set("login", e.target.value)} placeholder="Ex: maria.silva" />
          )}
        </div>
        {!isEditing && (
          <div className="col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            A senha inicial será <span className="font-bold">1234</span>. O usuário será solicitado a alterá-la no primeiro acesso.
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Perfil *</Label>
          <select
            value={form.role}
            onChange={e => set("role", e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PERFIS.map(p => (
              <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Setor</Label>
          <select
            value={form.sector}
            onChange={e => set("sector", e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SECTOR_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">E-mail</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@upa.gov.br" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">COREN / CRM</Label>
          <Input value={form.corenCrm} onChange={e => set("corenCrm", e.target.value)} placeholder="Ex: COREN-PA 123456" />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <input
            type="checkbox"
            id="ativo-check"
            checked={form.active}
            onChange={e => set("active", e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="ativo-check" className="text-xs cursor-pointer">
            Usuário ativo (pode fazer login)
          </Label>
        </div>
        <div className="col-span-2">
          <PermissoesPreview perfil={form.role as Perfil} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || !form.name || !form.login}>
          {isPending ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar funcionário"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminUsuariosPage() {
  const { data: staff, isLoading } = useListStaff();
  const createStaff  = useCreateStaff();
  const updateStaff  = useUpdateStaff();
  const deleteStaff  = useDeleteStaff();
  const queryClient  = useQueryClient();
  const { toast }    = useToast();

  const [search,        setSearch]        = useState("");
  const [perfilFilter,  setPerfilFilter]  = useState<Perfil | "all">("all");
  const [isFormOpen,    setIsFormOpen]    = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [deletingId,    setDeletingId]    = useState<number | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
  }, [queryClient]);

  const filtered = (staff ?? []).filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.login.toLowerCase().includes(q);
    const matchPerfil = perfilFilter === "all" || m.role === perfilFilter;
    return matchSearch && matchPerfil;
  });

  function openCreate() { setEditingMember(null); setIsFormOpen(true); }
  function openEdit(m: StaffMember) { setEditingMember(m); setIsFormOpen(true); }

  function handleSave(form: FormState) {
    if (editingMember) {
      const body: Record<string, unknown> = {
        name: form.name, login: form.login, role: form.role,
        email: form.email, sector: form.sector, corenCrm: form.corenCrm, active: form.active,
      };
      updateStaff.mutate({ id: editingMember.id, data: body as Parameters<typeof updateStaff.mutate>[0]["data"] }, {
        onSuccess: () => {
          toast({ title: "Funcionário atualizado" });
          setIsFormOpen(false);
          invalidate();
        },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
      });
    } else {
      createStaff.mutate({
        data: {
          name: form.name, login: form.login,
          role: form.role as Parameters<typeof createStaff.mutate>[0]["data"]["role"],
          email: form.email, sector: form.sector, corenCrm: form.corenCrm, active: form.active,
        },
      }, {
        onSuccess: () => {
          toast({ title: "Funcionário criado. Senha inicial: 1234" });
          setIsFormOpen(false);
          invalidate();
        },
        onError: () => toast({ title: "Erro ao criar funcionário", variant: "destructive" }),
      });
    }
  }

  function handleToggleAtivo(m: StaffMember) {
    updateStaff.mutate({ id: m.id, data: { active: !m.active } as Parameters<typeof updateStaff.mutate>[0]["data"] }, {
      onSuccess: () => {
        toast({ title: m.active ? "Usuário desativado" : "Usuário ativado" });
        invalidate();
      },
      onError: () => toast({ title: "Erro ao alterar status", variant: "destructive" }),
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    deleteStaff.mutate({ id: deletingId }, {
      onSuccess: () => {
        toast({ title: "Funcionário removido" });
        setDeletingId(null);
        invalidate();
      },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    });
  }

  const isPending = createStaff.isPending || updateStaff.isPending;

  return (
    <AdminLayout title="Usuários">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Usuários do Sistema</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {staff?.length ?? 0} funcionários cadastrados
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Funcionário
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Buscar nome ou login…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={perfilFilter}
            onChange={e => setPerfilFilter(e.target.value as Perfil | "all")}
            className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todos os perfis</option>
            {PERFIS.map(p => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({length: 5}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum funcionário encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Funcionário</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Perfil</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Login</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <UserCircle className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-xs font-medium truncate", !m.active && "text-muted-foreground line-through")}>{m.name}</p>
                          {m.email && <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded border",
                        PERFIL_COLOR[m.role as Perfil] ?? "text-muted-foreground"
                      )}>
                        {PERFIL_LABELS[m.role as Perfil] ?? m.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <code className="text-[11px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{m.login}</code>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleAtivo(m)}
                        title={m.active ? "Desativar" : "Ativar"}
                        className="inline-flex items-center justify-center transition-colors"
                      >
                        {m.active
                          ? <ToggleRight className="h-5 w-5 text-green-400 hover:text-green-300" />
                          : <ToggleLeft  className="h-5 w-5 text-muted-foreground hover:text-foreground" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => openEdit(m)}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(m.id)}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={open => { if (!open) setIsFormOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            <DialogDescription>
              {editingMember ? `Editando ${editingMember.name}.` : "Preencha os dados do novo funcionário."}
            </DialogDescription>
          </DialogHeader>
          <StaffForm
            key={editingMember?.id ?? "new"}
            initial={editingMember ? {
              name: editingMember.name,
              login: editingMember.login,
              role: (editingMember.role as Perfil) ?? "enfermeiro",
              email: editingMember.email ?? "",
              sector: editingMember.sector ?? "todos_os_setores",
              corenCrm: editingMember.corenCrm ?? "",
              active: editingMember.active,
            } : EMPTY_FORM}
            isEditing={!!editingMember}
            onSave={handleSave}
            onCancel={() => setIsFormOpen(false)}
            isPending={isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={open => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita. O funcionário perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStaff.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteStaff.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStaff.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

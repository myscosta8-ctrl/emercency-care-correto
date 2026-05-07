import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, CheckCircle2, Circle } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface CarePlan {
  id: number; patientId: number; goal: string; interventions: string;
  responsibleTeam: string; targetDate: string; status: string;
  createdByName: string; resolvedByName: string;
  resolvedAt: string | null; createdAt: string;
}

interface Props { patientId: number; canEdit?: boolean; }

export function PatientCarePlanTab({ patientId, canEdit = false }: Props) {
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ goal: "", interventions: "", responsibleTeam: "", targetDate: "" });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/care-plans`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setPlans(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.goal.trim()) { toast({ title: "Objetivo é obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/care-plans`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Plano de cuidados criado" });
      setShowForm(false);
      setForm({ goal: "", interventions: "", responsibleTeam: "", targetDate: "" });
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleResolve = async (id: number) => {
    if (!confirm("Marcar este plano como resolvido?")) return;
    try {
      await fetch(`/api/patients/${patientId}/care-plans/${id}/resolve`, { method: "PATCH", headers: hdrs() });
      toast({ title: "Plano marcado como resolvido" });
      await load();
    } catch { toast({ title: "Erro ao resolver plano", variant: "destructive" }); }
  };

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  const active = plans.filter(p => p.status === "ativo");
  const resolved = plans.filter(p => p.status !== "ativo");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-emerald-400" /> Plano de Cuidados
          {active.length > 0 && (
            <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{active.length} ativo(s)</Badge>
          )}
        </h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3 w-3" /> Novo Plano
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Criar Plano de Cuidados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Objetivo / Meta *</Label>
              <Input className="h-8 text-xs mt-1" placeholder="Ex: Controle pressórico, Mobilização precoce..."
                value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} /></div>
            <div><Label className="text-xs">Intervenções Planejadas</Label>
              <Textarea className="text-xs mt-1 min-h-[80px]"
                placeholder="Liste as intervenções e condutas planejadas pela equipe..."
                value={form.interventions} onChange={e => setForm(f => ({ ...f, interventions: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Equipe Responsável</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: Médica + Enfermagem"
                  value={form.responsibleTeam} onChange={e => setForm(f => ({ ...f, responsibleTeam: e.target.value }))} /></div>
              <div><Label className="text-xs">Prazo / Data Meta</Label>
                <Input type="date" className="h-8 text-xs mt-1"
                  value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Salvando..." : "Criar Plano"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {plans.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum plano de cuidados registrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {[...active, ...resolved].map(plan => (
            <Card key={plan.id} className={`border ${plan.status === "ativo" ? "border-emerald-500/30" : "border-border/50 opacity-70"}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {plan.status === "ativo"
                        ? <Circle className="h-3.5 w-3.5 text-emerald-400" />
                        : <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={`font-semibold text-sm ${plan.status !== "ativo" ? "line-through text-muted-foreground" : ""}`}>{plan.goal}</span>
                      {plan.status !== "ativo" && <Badge className="text-xs bg-muted/50 text-muted-foreground">Resolvido</Badge>}
                    </div>
                    {plan.interventions && <p className="text-xs text-muted-foreground mt-1 ml-5">{plan.interventions}</p>}
                    <div className="flex gap-3 mt-1 ml-5">
                      {plan.responsibleTeam && <span className="text-xs text-muted-foreground">Equipe: {plan.responsibleTeam}</span>}
                      {plan.targetDate && <span className="text-xs text-muted-foreground">Meta: {new Date(plan.targetDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                      Criado por {plan.createdByName} • {new Date(plan.createdAt).toLocaleDateString("pt-BR")}
                      {plan.resolvedByName && ` • Resolvido por ${plan.resolvedByName}`}
                    </p>
                  </div>
                  {canEdit && plan.status === "ativo" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                      onClick={() => handleResolve(plan.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolver
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

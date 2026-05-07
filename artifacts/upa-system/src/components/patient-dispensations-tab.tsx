import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill, Plus, RotateCcw } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface Dispensation {
  id: number; patientId: number; prescriptionId: number | null;
  medicationName: string; quantity: string; unit: string;
  batchNumber: string; expiryDate: string;
  dispensedByName: string; notes: string; returned: boolean;
  returnedAt: string | null; createdAt: string;
}

interface Props { patientId: number; canEdit?: boolean; }

export function PatientDispensationsTab({ patientId, canEdit = false }: Props) {
  const [items, setItems] = useState<Dispensation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    medicationName: "", quantity: "", unit: "unidade(s)",
    batchNumber: "", expiryDate: "", notes: "",
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/dispensations`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setItems(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.medicationName.trim()) { toast({ title: "Medicamento é obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/dispensations`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Dispensação registrada" });
      setShowForm(false);
      setForm({ medicationName: "", quantity: "", unit: "unidade(s)", batchNumber: "", expiryDate: "", notes: "" });
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleReturn = async (id: number) => {
    if (!confirm("Registrar devolução deste medicamento?")) return;
    try {
      await fetch(`/api/patients/${patientId}/dispensations/${id}/return`, { method: "PATCH", headers: hdrs() });
      toast({ title: "Devolução registrada" });
      await load();
    } catch { toast({ title: "Erro ao registrar devolução", variant: "destructive" }); }
  };

  const field = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  const active = items.filter(i => !i.returned);
  const returned = items.filter(i => i.returned);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Pill className="h-4 w-4 text-teal-400" /> Dispensação de Medicamentos
          {active.length > 0 && (
            <Badge className="text-xs bg-teal-500/20 text-teal-400 border-teal-500/30">{active.length} ativo(s)</Badge>
          )}
        </h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3 w-3" /> Registrar Dispensação
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card className="border-teal-500/30 bg-teal-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Nova Dispensação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Medicamento *</Label>
              <Input className="h-8 text-xs mt-1" placeholder="Nome do medicamento dispensado"
                value={form.medicationName} onChange={field("medicationName")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Quantidade</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: 30" value={form.quantity} onChange={field("quantity")} /></div>
              <div><Label className="text-xs">Unidade</Label>
                <Input className="h-8 text-xs mt-1" value={form.unit} onChange={field("unit")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Lote</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Número do lote" value={form.batchNumber} onChange={field("batchNumber")} /></div>
              <div><Label className="text-xs">Validade</Label>
                <Input className="h-8 text-xs mt-1" placeholder="MM/AAAA" value={form.expiryDate} onChange={field("expiryDate")} /></div>
            </div>
            <div><Label className="text-xs">Observações</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Observações sobre a dispensação..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Salvando..." : "Registrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma dispensação registrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {[...active, ...returned].map(item => (
            <Card key={item.id} className={`border ${item.returned ? "border-border/50 opacity-60" : "border-teal-500/20"}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.medicationName}</span>
                      <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                      {item.returned
                        ? <Badge className="text-xs bg-muted/50 text-muted-foreground"><RotateCcw className="h-3 w-3 mr-1" />Devolvido</Badge>
                        : <Badge className="text-xs bg-teal-500/20 text-teal-400 border-teal-500/30">Dispensado</Badge>}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {item.batchNumber && <span className="text-xs text-muted-foreground">Lote: {item.batchNumber}</span>}
                      {item.expiryDate && <span className="text-xs text-muted-foreground">Val: {item.expiryDate}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.dispensedByName} • {new Date(item.createdAt).toLocaleDateString("pt-BR")} {new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                  </div>
                  {canEdit && !item.returned && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => handleReturn(item.id)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Devolução
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

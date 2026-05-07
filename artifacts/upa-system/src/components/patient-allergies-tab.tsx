import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Trash2, ShieldAlert } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface Allergy {
  id: number; patientId: number; allergen: string; reactionType: string;
  severity: "leve" | "moderada" | "grave"; notes: string;
  recordedByName: string; createdAt: string;
}

const SEV_COLOR: Record<string, string> = {
  leve: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  moderada: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  grave: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface Props { patientId: number; canEdit?: boolean; }

export function PatientAllergiesTab({ patientId, canEdit = false }: Props) {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ allergen: "", reactionType: "", severity: "moderada", notes: "" });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/allergies`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setAllergies(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.allergen.trim()) { toast({ title: "Informe o alérgeno", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/allergies`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Alergia registrada com sucesso" });
      setForm({ allergen: "", reactionType: "", severity: "moderada", notes: "" });
      setShowForm(false);
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este registro de alergia?")) return;
    await fetch(`/api/patients/${patientId}/allergies/${id}`, { method: "DELETE", headers: hdrs() });
    await load();
    toast({ title: "Registro removido" });
  };

  const printAllergies = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Alergias</title><style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h2{font-size:16px;margin-bottom:8px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:6px;text-align:left}
      th{background:#f0f0f0;font-weight:bold}
      .grave{color:#c00;font-weight:bold}.moderada{color:#c60}.leve{color:#660}
      @media print{@page{margin:10mm}}
    </style></head><body>
    <h2>Alergias do Paciente — Prontuário ${patientId}</h2>
    <table><thead><tr><th>Alérgeno</th><th>Tipo de Reação</th><th>Gravidade</th><th>Observações</th><th>Registrado por</th></tr></thead>
    <tbody>${allergies.map(a => `<tr>
      <td>${a.allergen}</td><td>${a.reactionType || "—"}</td>
      <td class="${a.severity}">${a.severity.toUpperCase()}</td>
      <td>${a.notes || "—"}</td><td>${a.recordedByName}</td>
    </tr>`).join("")}</tbody></table>
    </body></html>`);
    w.document.close(); w.print();
  };

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      {allergies.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 font-medium">
            Este paciente possui {allergies.length} alergia(s) registrada(s)
          </p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-400" /> Alergias Registradas
        </h3>
        <div className="flex gap-2">
          {allergies.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={printAllergies}>Imprimir</Button>
          )}
          {canEdit && (
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
              <Plus className="h-3 w-3" /> Nova Alergia
            </Button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Registrar Alergia</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Alérgeno *</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: Dipirona, Penicilina, Látex..."
                  value={form.allergen} onChange={e => setForm(f => ({ ...f, allergen: e.target.value }))} />
              </div>
              <div><Label className="text-xs">Tipo de Reação</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: Urticária, Anafilaxia, Edema..."
                  value={form.reactionType} onChange={e => setForm(f => ({ ...f, reactionType: e.target.value }))} />
              </div>
            </div>
            <div><Label className="text-xs">Gravidade</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderada">Moderada</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Observações</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Observações adicionais..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Salvando..." : "Registrar Alergia"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {allergies.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma alergia registrada para este paciente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {allergies.map(a => (
            <Card key={a.id} className={`border ${a.severity === "grave" ? "border-red-500/40 bg-red-500/5" : "border-border/50"}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{a.allergen}</span>
                      <Badge className={`text-xs border ${SEV_COLOR[a.severity]}`}>{a.severity.toUpperCase()}</Badge>
                    </div>
                    {a.reactionType && <p className="text-xs text-muted-foreground mt-0.5">Reação: {a.reactionType}</p>}
                    {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Registrado por {a.recordedByName} • {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
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

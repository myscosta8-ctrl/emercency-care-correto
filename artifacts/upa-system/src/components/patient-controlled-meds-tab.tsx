import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Plus, Printer, Package } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface ControlledSubstance {
  id: number; patientId: number; medicationName: string; portariaClass: string;
  dose: string; route: string; quantity: string; unit: string; instructions: string;
  prescriberName: string; prescriberCrm: string; status: string;
  dispensedByName: string; dispensedAt: string | null; createdAt: string;
}

const PORTARIA_CLASSES = [
  { value: "A1", label: "A1 — Entorpecentes" },
  { value: "A2", label: "A2 — Psicotrópicos de uso médico-hospitalar" },
  { value: "A3", label: "A3 — Anorexígenos" },
  { value: "B1", label: "B1 — Psicotrópicos" },
  { value: "B2", label: "B2 — Anorexígenos/Anfepramona" },
  { value: "C1", label: "C1 — Outras substâncias sujeitas a controle especial" },
  { value: "C2", label: "C2 — Retinoides" },
  { value: "C3", label: "C3 — Imunossupressores" },
];

interface Props { patientId: number; patientName?: string; canEdit?: boolean; canDispense?: boolean; }

export function PatientControlledMedsTab({ patientId, patientName = "", canEdit = false, canDispense = false }: Props) {
  const [items, setItems] = useState<ControlledSubstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    medicationName: "", portariaClass: "B1", dose: "", route: "oral",
    quantity: "", unit: "comprimido(s)", instructions: "", prescriberCrm: "",
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/controlled-substances`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setItems(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.medicationName.trim()) { toast({ title: "Nome do medicamento é obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/controlled-substances`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Receita de controle especial registrada" });
      setShowForm(false);
      setForm({ medicationName: "", portariaClass: "B1", dose: "", route: "oral", quantity: "", unit: "comprimido(s)", instructions: "", prescriberCrm: "" });
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDispense = async (id: number) => {
    if (!confirm("Confirmar dispensação desta medicação controlada?")) return;
    try {
      await fetch(`/api/patients/${patientId}/controlled-substances/${id}/dispense`, { method: "PATCH", headers: hdrs() });
      toast({ title: "Medicação dispensada com sucesso" });
      await load();
    } catch { toast({ title: "Erro ao dispensar", variant: "destructive" }); }
  };

  const printRCE = (item: ControlledSubstance) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Receita Controle Especial</title><style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:11px;max-width:700px;margin:0 auto}
      h1{font-size:14px;text-align:center;margin-bottom:4px}
      h2{font-size:11px;text-align:center;margin-bottom:20px;font-weight:normal}
      .box{border:2px solid #000;padding:16px;margin:12px 0}
      .field{margin:4px 0;display:flex;gap:8px}
      .field label{font-weight:bold;min-width:180px}
      .med{background:#f5f5f5;padding:10px;border:1px solid #ccc;margin:8px 0;font-size:12px}
      .sig{display:flex;gap:40px;margin-top:50px}
      .sig-line{flex:1;border-top:1px solid #000;padding-top:4px;font-size:10px}
      .nota{font-size:9px;color:#666;margin-top:8px}
      @media print{@page{margin:10mm}}
    </style></head><body>
    <h1>RECEITA DE CONTROLE ESPECIAL</h1>
    <h2>Portaria SVS/MS N° 344/98 — ${item.portariaClass}</h2>
    <div class="box">
      <div class="field"><label>Paciente:</label><span>${patientName || `Prontuário ${patientId}`}</span></div>
      <div class="field"><label>Data:</label><span>${new Date(item.createdAt).toLocaleDateString("pt-BR")}</span></div>
    </div>
    <div class="med">
      <p><strong>${item.medicationName}</strong></p>
      <p>Dose: ${item.dose} | Via: ${item.route} | Qtd: ${item.quantity} ${item.unit}</p>
      ${item.instructions ? `<p>Instruções: ${item.instructions}</p>` : ""}
    </div>
    <div class="sig">
      <div class="sig-line">Assinatura e Carimbo do Médico<br>${item.prescriberName}<br>CRM: ${item.prescriberCrm || "—"}</div>
      <div class="sig-line">Via do Paciente / Via da Farmácia<br>_______________________</div>
    </div>
    <p class="nota">Válida por 30 dias. Uso exclusivo em UPA Breves — Breves/PA.</p>
    </body></html>`);
    w.document.close(); w.print();
  };

  const field = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-400" /> Medicamentos Controlados
        </h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3 w-3" /> Nova Receita Controlada
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Receita de Controle Especial (Portaria 344/98)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Medicamento *</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: Diazepam, Morfina..."
                  value={form.medicationName} onChange={field("medicationName")} /></div>
              <div><Label className="text-xs">Portaria / Classe</Label>
                <Select value={form.portariaClass} onValueChange={v => setForm(f => ({ ...f, portariaClass: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PORTARIA_CLASSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Dose</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: 5mg" value={form.dose} onChange={field("dose")} /></div>
              <div><Label className="text-xs">Via</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: oral, IM" value={form.route} onChange={field("route")} /></div>
              <div><Label className="text-xs">Quantidade</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: 10" value={form.quantity} onChange={field("quantity")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Unidade</Label>
                <Input className="h-8 text-xs mt-1" value={form.unit} onChange={field("unit")} /></div>
              <div><Label className="text-xs">CRM do Prescritor</Label>
                <Input className="h-8 text-xs mt-1" placeholder="CRM/UF 000000" value={form.prescriberCrm} onChange={field("prescriberCrm")} /></div>
            </div>
            <div><Label className="text-xs">Instruções de Uso</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Posologia e instruções..."
                value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Salvando..." : "Registrar Receita"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma receita de controle especial registrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Package className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-semibold text-sm">{item.medicationName}</span>
                      <Badge className="text-xs border">{item.portariaClass}</Badge>
                      {item.status === "dispensado"
                        ? <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">Dispensado</Badge>
                        : <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.dose} {item.route && `• Via ${item.route}`} • Qtd: {item.quantity} {item.unit}
                    </p>
                    {item.instructions && <p className="text-xs text-muted-foreground mt-0.5">{item.instructions}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prescrito por {item.prescriberName} {item.prescriberCrm && `(CRM ${item.prescriberCrm})`} • {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    {item.dispensedByName && <p className="text-xs text-green-400 mt-0.5">Dispensado por {item.dispensedByName} • {item.dispensedAt ? new Date(item.dispensedAt).toLocaleDateString("pt-BR") : ""}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => printRCE(item)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {canDispense && item.status === "pendente" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDispense(item.id)}>
                        Dispensar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

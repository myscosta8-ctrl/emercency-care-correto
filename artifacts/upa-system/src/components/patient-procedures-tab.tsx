import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Plus, Printer, ChevronDown, ChevronUp } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface Procedure {
  id: number; patientId: number; procedureName: string; procedureType: string;
  description: string; materialsUsed: string; complications: string; outcome: string;
  performedByName: string; performedAt: string; createdAt: string;
}

const PROC_TYPES = ["Diagnóstico", "Terapêutico", "Cirúrgico", "Invasivo", "Não-invasivo", "Outro"];

interface Props { patientId: number; canEdit?: boolean; patientName?: string; }

export function PatientProceduresTab({ patientId, canEdit = false, patientName = "" }: Props) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState({
    procedureName: "", procedureType: "Terapêutico", description: "",
    materialsUsed: "", complications: "Sem intercorrências", outcome: "", performedAt: "",
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/procedures`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setProcedures(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.procedureName.trim()) { toast({ title: "Nome do procedimento é obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/procedures`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Procedimento registrado" });
      setShowForm(false);
      setForm({ procedureName: "", procedureType: "Terapêutico", description: "", materialsUsed: "", complications: "Sem intercorrências", outcome: "", performedAt: "" });
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const printProc = (p: Procedure) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Procedimento</title><style>
      body{font-family:Arial,sans-serif;padding:25px;font-size:11px}
      h1{font-size:14px;text-align:center;margin-bottom:16px}
      .field{margin:4px 0} .field label{font-weight:bold}
      .section{border:1px solid #ccc;padding:8px;margin:8px 0}
      .section h2{font-size:11px;font-weight:bold;margin:0 0 6px}
      .sig{margin-top:40px;border-top:1px solid #000;padding-top:4px;text-align:center}
      @media print{@page{margin:10mm}}
    </style></head><body>
    <h1>FORMULÁRIO DE PROCEDIMENTO</h1>
    <div class="section">
      <div class="field"><label>Paciente:</label> ${patientName || `Prontuário ${patientId}`}</div>
      <div class="field"><label>Procedimento:</label> ${p.procedureName}</div>
      <div class="field"><label>Tipo:</label> ${p.procedureType}</div>
      <div class="field"><label>Data/Hora:</label> ${p.performedAt || new Date(p.createdAt).toLocaleString("pt-BR")}</div>
    </div>
    ${p.description ? `<div class="section"><h2>Descrição</h2><p>${p.description}</p></div>` : ""}
    ${p.materialsUsed ? `<div class="section"><h2>Materiais Utilizados</h2><p>${p.materialsUsed}</p></div>` : ""}
    ${p.complications ? `<div class="section"><h2>Intercorrências</h2><p>${p.complications}</p></div>` : ""}
    ${p.outcome ? `<div class="section"><h2>Desfecho</h2><p>${p.outcome}</p></div>` : ""}
    <div class="sig">${p.performedByName}</div>
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
          <Stethoscope className="h-4 w-4 text-purple-400" /> Procedimentos Realizados
        </h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3 w-3" /> Novo Procedimento
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Registrar Procedimento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome do Procedimento *</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: Sondagem vesical, Punção venosa..."
                  value={form.procedureName} onChange={field("procedureName")} /></div>
              <div><Label className="text-xs">Tipo</Label>
                <Select value={form.procedureType} onValueChange={v => setForm(f => ({ ...f, procedureType: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label className="text-xs">Data/Hora de Realização</Label>
              <Input className="h-8 text-xs mt-1" placeholder="Ex: 07/05/2026 14:30"
                value={form.performedAt} onChange={field("performedAt")} /></div>
            <div><Label className="text-xs">Descrição do Procedimento</Label>
              <Textarea className="text-xs mt-1 min-h-[80px]" placeholder="Descreva o procedimento realizado..."
                value={form.description} onChange={field("description")} /></div>
            <div><Label className="text-xs">Materiais Utilizados</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Liste os materiais e medicamentos usados..."
                value={form.materialsUsed} onChange={field("materialsUsed")} /></div>
            <div><Label className="text-xs">Intercorrências</Label>
              <Input className="h-8 text-xs mt-1" value={form.complications} onChange={field("complications")} /></div>
            <div><Label className="text-xs">Desfecho / Resultado</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Resultado do procedimento..."
                value={form.outcome} onChange={field("outcome")} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Salvando..." : "Registrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {procedures.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum procedimento registrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {procedures.map(p => (
            <Card key={p.id} className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{p.procedureName}</span>
                      <span className="text-xs text-muted-foreground">({p.procedureType})</span>
                      {expanded === p.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.performedByName} • {p.performedAt || new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => printProc(p)}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {expanded === p.id && (
                  <div className="mt-3 space-y-2 text-xs border-t border-border/50 pt-3">
                    {p.description && <div><span className="font-medium text-muted-foreground">Descrição: </span>{p.description}</div>}
                    {p.materialsUsed && <div><span className="font-medium text-muted-foreground">Materiais: </span>{p.materialsUsed}</div>}
                    {p.complications && <div><span className="font-medium text-muted-foreground">Intercorrências: </span>{p.complications}</div>}
                    {p.outcome && <div><span className="font-medium text-muted-foreground">Desfecho: </span>{p.outcome}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

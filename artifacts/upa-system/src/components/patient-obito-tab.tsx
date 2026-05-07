import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Cross, AlertOctagon } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface DeathRecord {
  id: number; patientId: number; deathDate: string; deathTime: string;
  cause1a: string; cause1b: string; cause1c: string; cause2: string;
  icd: string; typeOfDeath: string; physicianName: string; physicianCrm: string;
  witnessName: string; notes: string; createdAt: string;
}

const DEATH_TYPES: Record<string, string> = {
  natural: "Natural", acidental: "Acidental", homicidio: "Homicídio",
  suicidio: "Suicídio", outro: "Outro",
};

interface Props { patientId: number; patientName?: string; canEdit?: boolean; }

export function PatientObitoTab({ patientId, patientName = "", canEdit = false }: Props) {
  const [record, setRecord] = useState<DeathRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    deathDate: new Date().toISOString().slice(0, 10),
    deathTime: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    cause1a: "", cause1b: "", cause1c: "", cause2: "", icd: "",
    typeOfDeath: "natural", physicianCrm: "", witnessName: "", notes: "",
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/deaths`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) {
        const rows = await r.json() as DeathRecord[];
        setRecord(rows[0] ?? null);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!form.deathDate || !form.cause1a.trim()) {
      toast({ title: "Data e causa imediata do óbito são obrigatórias", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/deaths`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Declaração de Óbito registrada" });
      setShowForm(false);
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const printDO = (d: DeathRecord) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Declaração de Óbito</title><style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:11px;max-width:700px;margin:0 auto}
      h1{font-size:15px;text-align:center;margin-bottom:20px;font-weight:bold}
      .field{margin:6px 0;display:flex;gap:8px}
      .field label{font-weight:bold;min-width:200px;flex-shrink:0}
      .section{border:1px solid #000;padding:10px;margin:10px 0}
      .section h2{font-size:12px;font-weight:bold;margin:0 0 8px 0;text-decoration:underline}
      .sig{display:flex;gap:40px;margin-top:40px}
      .sig-line{flex:1;border-top:1px solid #000;padding-top:4px;font-size:10px}
      @media print{@page{margin:10mm}}
    </style></head><body>
    <h1>DECLARAÇÃO DE ÓBITO</h1>
    <div class="section">
      <h2>Dados do Paciente</h2>
      <div class="field"><label>Paciente:</label><span>${patientName}</span></div>
      <div class="field"><label>Prontuário:</label><span>${patientId}</span></div>
      <div class="field"><label>Data do Óbito:</label><span>${d.deathDate}</span></div>
      <div class="field"><label>Hora do Óbito:</label><span>${d.deathTime}</span></div>
      <div class="field"><label>Tipo de Óbito:</label><span>${DEATH_TYPES[d.typeOfDeath] ?? d.typeOfDeath}</span></div>
    </div>
    <div class="section">
      <h2>Causa do Óbito (CID)</h2>
      <div class="field"><label>Causa Imediata (I-a):</label><span>${d.cause1a}</span></div>
      <div class="field"><label>Causa Intermediária (I-b):</label><span>${d.cause1b || "—"}</span></div>
      <div class="field"><label>Causa Básica (I-c):</label><span>${d.cause1c || "—"}</span></div>
      <div class="field"><label>Outras condições (II):</label><span>${d.cause2 || "—"}</span></div>
      <div class="field"><label>CID-10:</label><span>${d.icd || "—"}</span></div>
    </div>
    ${d.notes ? `<div class="section"><h2>Observações</h2><p>${d.notes}</p></div>` : ""}
    <div class="sig">
      <div class="sig-line">Médico Declarante<br>${d.physicianName}<br>CRM: ${d.physicianCrm || "—"}</div>
      <div class="sig-line">Testemunha<br>${d.witnessName || "—"}</div>
    </div>
    </body></html>`);
    w.document.close(); w.print();
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Cross className="h-4 w-4 text-gray-400" /> Declaração de Óbito
        </h3>
        {canEdit && !record && (
          <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setShowForm(v => !v)}>
            Registrar Óbito
          </Button>
        )}
        {record && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => printDO(record)}>
            <Printer className="h-3.5 w-3.5" /> Imprimir DO
          </Button>
        )}
      </div>

      {!record && !showForm && (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-muted-foreground text-sm space-y-2">
            <AlertOctagon className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p>Nenhuma declaração de óbito registrada.</p>
          </CardContent>
        </Card>
      )}

      {showForm && canEdit && !record && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-300">⚠️ Registrar Óbito — Esta ação é irreversível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data do Óbito *</Label>
                <Input type="date" className="h-8 text-xs mt-1" value={form.deathDate} onChange={f("deathDate")} /></div>
              <div><Label className="text-xs">Hora do Óbito *</Label>
                <Input className="h-8 text-xs mt-1" value={form.deathTime} onChange={f("deathTime")} /></div>
            </div>
            <div><Label className="text-xs">Tipo de Óbito</Label>
              <Select value={form.typeOfDeath} onValueChange={v => setForm(p => ({ ...p, typeOfDeath: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DEATH_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border border-border/50 rounded-md p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Causas do Óbito (CID)</p>
              <div><Label className="text-xs">I-a: Causa Imediata *</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Causa imediata da morte" value={form.cause1a} onChange={f("cause1a")} /></div>
              <div><Label className="text-xs">I-b: Causa Intermediária</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Causada por..." value={form.cause1b} onChange={f("cause1b")} /></div>
              <div><Label className="text-xs">I-c: Causa Básica</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Causada por..." value={form.cause1c} onChange={f("cause1c")} /></div>
              <div><Label className="text-xs">II: Outras condições contribuintes</Label>
                <Input className="h-8 text-xs mt-1" value={form.cause2} onChange={f("cause2")} /></div>
              <div><Label className="text-xs">CID-10</Label>
                <Input className="h-8 text-xs mt-1" placeholder="Ex: J18.9" value={form.icd} onChange={f("icd")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">CRM do Médico Declarante</Label>
                <Input className="h-8 text-xs mt-1" placeholder="CRM/UF 000000" value={form.physicianCrm} onChange={f("physicianCrm")} /></div>
              <div><Label className="text-xs">Nome da Testemunha</Label>
                <Input className="h-8 text-xs mt-1" value={form.witnessName} onChange={f("witnessName")} /></div>
            </div>
            <div><Label className="text-xs">Observações</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
                {saving ? "Registrando..." : "Confirmar Registro de Óbito"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {record && (
        <Card className="border-gray-500/40 bg-gray-500/5">
          <CardContent className="py-4 px-4">
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-xs text-muted-foreground">Data do Óbito</span><p className="font-medium">{record.deathDate} {record.deathTime}</p></div>
                <div><span className="text-xs text-muted-foreground">Tipo</span><p className="font-medium">{DEATH_TYPES[record.typeOfDeath]}</p></div>
              </div>
              <div><span className="text-xs text-muted-foreground">Causa Imediata (I-a)</span><p className="font-medium">{record.cause1a}</p></div>
              {record.cause1b && <div><span className="text-xs text-muted-foreground">Causa Intermediária (I-b)</span><p>{record.cause1b}</p></div>}
              {record.cause1c && <div><span className="text-xs text-muted-foreground">Causa Básica (I-c)</span><p>{record.cause1c}</p></div>}
              {record.cause2 && <div><span className="text-xs text-muted-foreground">Outras condições (II)</span><p>{record.cause2}</p></div>}
              {record.icd && <div><span className="text-xs text-muted-foreground">CID-10</span><p>{record.icd}</p></div>}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <div><span className="text-xs text-muted-foreground">Médico Declarante</span><p>{record.physicianName} {record.physicianCrm && `— CRM ${record.physicianCrm}`}</p></div>
                {record.witnessName && <div><span className="text-xs text-muted-foreground">Testemunha</span><p>{record.witnessName}</p></div>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

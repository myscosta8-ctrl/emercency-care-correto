import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, MessageSquare, Clock, CheckCircle2 } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface Interconsult {
  id: number; patientId: number; requestingSpecialty: string; requestedSpecialty: string;
  reason: string; urgency: string; status: string; response: string;
  requestedByName: string; respondedByName: string;
  requestedAt: string; respondedAt: string | null; createdAt: string;
}

const SPECIALTIES = ["Clínica Médica", "Cirurgia Geral", "Ortopedia", "Pediatria", "Ginecologia/Obstetrícia",
  "Cardiologia", "Neurologia", "Psiquiatria", "Dermatologia", "Oftalmologia",
  "Otorrinolaringologia", "Urologia", "Nefrologia", "Pneumologia", "Endocrinologia",
  "Reumatologia", "Infectologia", "Oncologia", "Enfermagem", "Nutrição", "Serviço Social", "Outra"];

interface Props { patientId: number; canEdit?: boolean; }

export function PatientInterconsultsTab({ patientId, canEdit = false }: Props) {
  const [items, setItems] = useState<Interconsult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [respondId, setRespondId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ requestingSpecialty: "", requestedSpecialty: "", reason: "", urgency: "eletivo" });
  const [responseText, setResponseText] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/interconsults`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setItems(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.requestedSpecialty.trim()) { toast({ title: "Especialidade solicitada é obrigatória", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/interconsults`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Interconsulta solicitada" });
      setShowForm(false);
      setForm({ requestingSpecialty: "", requestedSpecialty: "", reason: "", urgency: "eletivo" });
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleRespond = async (id: number) => {
    if (!responseText.trim()) { toast({ title: "Resposta é obrigatória", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/interconsults/${id}/respond`, {
        method: "PATCH", headers: hdrs(), body: JSON.stringify({ response: responseText }),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "Interconsulta respondida" });
      setRespondId(null); setResponseText("");
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const statusBadge = (s: string, u: string) => {
    if (s === "respondido") return <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Respondida</Badge>;
    if (u === "urgente") return <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30"><Clock className="h-3 w-3 mr-1" />Urgente</Badge>;
    return <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
  };

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-400" /> Notas de Interconsulta
        </h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3 w-3" /> Solicitar Interconsulta
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Nova Interconsulta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">Especialidade Solicitante</Label>
                <Select value={form.requestingSpecialty} onValueChange={v => setForm(f => ({ ...f, requestingSpecialty: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">Especialidade Solicitada *</Label>
                <Select value={form.requestedSpecialty} onValueChange={v => setForm(f => ({ ...f, requestedSpecialty: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label className="text-xs">Urgência</Label>
              <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eletivo">Eletivo</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs">Motivo / Hipótese Diagnóstica</Label>
              <Textarea className="text-xs mt-1 min-h-[80px]" placeholder="Descreva o motivo da interconsulta..."
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Enviando..." : "Solicitar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma interconsulta registrada.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="py-3 px-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.requestedSpecialty}</span>
                      {statusBadge(item.status, item.urgency)}
                    </div>
                    {item.requestingSpecialty && <p className="text-xs text-muted-foreground">De: {item.requestingSpecialty}</p>}
                    <p className="text-xs text-muted-foreground">
                      {item.requestedByName} • {new Date(item.requestedAt).toLocaleDateString("pt-BR")} {new Date(item.requestedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {canEdit && item.status === "solicitado" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => setRespondId(respondId === item.id ? null : item.id)}>
                      <MessageSquare className="h-3 w-3" /> Responder
                    </Button>
                  )}
                </div>
                {item.reason && <p className="text-xs bg-muted/30 rounded p-2"><strong>Motivo:</strong> {item.reason}</p>}
                {item.response && (
                  <p className="text-xs bg-green-500/10 rounded p-2 border border-green-500/20">
                    <strong>Resposta ({item.respondedByName}):</strong> {item.response}
                  </p>
                )}
                {respondId === item.id && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Textarea className="text-xs min-h-[80px]" placeholder="Escreva a resposta da interconsulta..."
                      value={responseText} onChange={e => setResponseText(e.target.value)} />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRespondId(null)}>Cancelar</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleRespond(item.id)} disabled={saving}>
                        {saving ? "..." : "Registrar Resposta"}
                      </Button>
                    </div>
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

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, Printer, CheckCircle2, XCircle } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
const hdrs = () => ({ "x-staff-id": getStaffId(), "Content-Type": "application/json" });

interface Consent {
  id: number; patientId: number; consentType: string; title: string; description: string;
  patientOrGuardianName: string; guardianRelationship: string; agreed: boolean;
  professionalName: string; notes: string; createdAt: string;
}

const CONSENT_TYPES: Record<string, string> = {
  geral: "Consentimento Geral para Tratamento",
  cirurgia: "Consentimento para Procedimento Cirúrgico",
  anestesia: "Consentimento para Anestesia",
  transfusao: "Consentimento para Transfusão Sanguínea",
  pesquisa: "Consentimento para Pesquisa Clínica",
  alta_voluntaria: "Termo de Alta a Pedido",
  recusa: "Termo de Recusa de Tratamento",
  outro: "Outro",
};

interface Props { patientId: number; canEdit?: boolean; patientName?: string; }

export function PatientTcleTab({ patientId, canEdit = false, patientName = "" }: Props) {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    consentType: "geral", title: "", description: "",
    patientOrGuardianName: patientName, guardianRelationship: "", agreed: true, notes: "",
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/patients/${patientId}/consents`, { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setConsents(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (form.consentType in CONSENT_TYPES)
      setForm(f => ({ ...f, title: CONSENT_TYPES[f.consentType] }));
  }, [form.consentType]);

  const handleAdd = async () => {
    if (!form.patientOrGuardianName.trim()) {
      toast({ title: "Nome do paciente/responsável é obrigatório", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/patients/${patientId}/consents`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Erro");
      toast({ title: "TCLE registrado com sucesso" });
      setShowForm(false);
      await load();
    } catch (e) { toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const printConsent = (c: Consent) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>TCLE</title><style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:12px;max-width:700px;margin:0 auto}
      h1{font-size:16px;text-align:center;margin-bottom:20px}
      h2{font-size:13px;margin-top:16px;margin-bottom:4px}
      .box{border:2px solid #000;padding:20px;margin:20px 0}
      .sig{display:flex;gap:40px;margin-top:40px}
      .sig-line{flex:1;border-top:1px solid #000;padding-top:4px;font-size:11px}
      @media print{@page{margin:15mm}}
    </style></head><body>
    <h1>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO<br><small>${c.title}</small></h1>
    <div class="box">
      <p><strong>Paciente/Responsável:</strong> ${c.patientOrGuardianName}</p>
      ${c.guardianRelationship ? `<p><strong>Grau de parentesco/responsabilidade:</strong> ${c.guardianRelationship}</p>` : ""}
      <p><strong>Data:</strong> ${new Date(c.createdAt).toLocaleDateString("pt-BR")} &nbsp; <strong>Hora:</strong> ${new Date(c.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
    ${c.description ? `<h2>Informações sobre o Procedimento/Tratamento:</h2><p>${c.description}</p>` : ""}
    ${c.notes ? `<h2>Observações:</h2><p>${c.notes}</p>` : ""}
    <p style="margin-top:20px"><strong>Decisão:</strong> ${c.agreed ? "✅ CONSENTE com o tratamento/procedimento" : "❌ NÃO CONSENTE com o tratamento/procedimento"}</p>
    <div class="sig">
      <div class="sig-line">Assinatura do Paciente/Responsável<br>${c.patientOrGuardianName}</div>
      <div class="sig-line">Profissional Responsável<br>${c.professionalName}</div>
    </div>
    </body></html>`);
    w.document.close(); w.print();
  };

  if (loading) return <p className="text-muted-foreground text-sm py-6 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-400" /> Termos de Consentimento (TCLE)
        </h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3 w-3" /> Novo TCLE
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Registrar TCLE</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Tipo de Consentimento</Label>
              <Select value={form.consentType} onValueChange={v => setForm(f => ({ ...f, consentType: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONSENT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome do Paciente / Responsável *</Label>
              <Input className="h-8 text-xs mt-1" value={form.patientOrGuardianName}
                onChange={e => setForm(f => ({ ...f, patientOrGuardianName: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Grau de Parentesco/Responsabilidade (se responsável)</Label>
              <Input className="h-8 text-xs mt-1" placeholder="Ex: Filho, Cônjuge, Responsável legal..."
                value={form.guardianRelationship}
                onChange={e => setForm(f => ({ ...f, guardianRelationship: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Descrição / Informações</Label>
              <Textarea className="text-xs mt-1 min-h-[80px]"
                placeholder="Descreva o procedimento, riscos e alternativas..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Observações</Label>
              <Textarea className="text-xs mt-1 min-h-[60px]" placeholder="Observações adicionais..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="agreed" checked={form.agreed}
                onCheckedChange={v => setForm(f => ({ ...f, agreed: !!v }))} />
              <Label htmlFor="agreed" className="text-xs cursor-pointer">
                Paciente/Responsável CONSENTE com o tratamento/procedimento
              </Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Salvando..." : "Registrar TCLE"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {consents.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum termo de consentimento registrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consents.map(c => (
            <Card key={c.id} className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.title}</span>
                      {c.agreed
                        ? <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Consentido</Badge>
                        : <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Não Consentido</Badge>
                      }
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Paciente/Responsável: <strong>{c.patientOrGuardianName}</strong>
                      {c.guardianRelationship && ` (${c.guardianRelationship})`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Profissional: {c.professionalName} • {new Date(c.createdAt).toLocaleDateString("pt-BR")} {new Date(c.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={() => printConsent(c)}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

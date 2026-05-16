import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPOS_EVENTO = [
  "Queda do paciente",
  "Erro de medicação",
  "Reação adversa a medicamento",
  "Infecção relacionada à assistência (IRAS)",
  "Lesão por pressão",
  "Flebite / infiltração de acesso venoso",
  "Falha de equipamento / dispositivo",
  "Fuga do paciente",
  "Agressão física",
  "Erro de identificação do paciente",
  "Procedimento em local errado",
  "Transfusão incompatível",
  "Outro",
];

const GRAVIDADES = [
  { value: "near_miss", label: "Near miss (sem dano)", color: "border-blue-500/40 text-blue-400" },
  { value: "sem_dano", label: "Incidente sem dano", color: "border-yellow-500/40 text-yellow-400" },
  { value: "dano_leve", label: "Dano leve", color: "border-orange-500/40 text-orange-400" },
  { value: "dano_moderado", label: "Dano moderado", color: "border-red-500/40 text-red-400" },
  { value: "dano_grave", label: "Dano grave", color: "border-red-700/60 text-red-500" },
  { value: "obito", label: "Óbito", color: "border-red-900/60 text-red-700" },
];

interface EventoAdverso {
  id: string;
  data: string;
  hora: string;
  tipo: string;
  gravidade: string;
  descricao: string;
  localOcorrencia: string;
  condutasImediatas: string;
  notificadoA: string;
  registradoPor: string;
}

const STORAGE_KEY = (id: number) => `eventos_adversos_${id}`;

function load(patientId: number): EventoAdverso[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(patientId: number, items: EventoAdverso[]) {
  localStorage.setItem(STORAGE_KEY(patientId), JSON.stringify(items));
}

interface Props {
  patientId: number;
  patientName: string;
  canEdit: boolean;
}

export function PatientEventoAdversoTab({ patientId, patientName, canEdit }: Props) {
  const [eventos, setEventos] = useState<EventoAdverso[]>(() => load(patientId));
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("");
  const [gravidade, setGravidade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [condutas, setCondutas] = useState("");
  const [notificado, setNotificado] = useState("");
  const [registradoPor, setRegistradoPor] = useState("");

  function handleSave() {
    const ev: EventoAdverso = {
      id: crypto.randomUUID(),
      data: format(new Date(), "yyyy-MM-dd"),
      hora: format(new Date(), "HH:mm"),
      tipo,
      gravidade,
      descricao,
      localOcorrencia: local,
      condutasImediatas: condutas,
      notificadoA: notificado,
      registradoPor,
    };
    const updated = [ev, ...eventos];
    setEventos(updated);
    save(patientId, updated);
    setShowForm(false);
    setTipo(""); setGravidade(""); setDescricao(""); setLocal("");
    setCondutas(""); setNotificado(""); setRegistradoPor("");
  }

  function handlePrint(ev: EventoAdverso) {
    const grav = GRAVIDADES.find(g => g.value === ev.gravidade);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Evento Adverso</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
      h2 { font-size: 14px; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ccc; padding: 5px 8px; }
      th { background: #f0f0f0; width: 35%; }
      .sig { display: flex; gap: 40px; margin-top: 32px; }
      .sig-box { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
    </style></head><body>
    <h2>NOTIFICAÇÃO DE EVENTO ADVERSO / INCIDENTE</h2>
    <p style="text-align:center;font-size:10px">UPA 24H de Breves — Guarda mínima: 5 anos</p>
    <table>
      <tr><th>Paciente</th><td>${patientName}</td></tr>
      <tr><th>Data / Hora</th><td>${ev.data} às ${ev.hora}</td></tr>
      <tr><th>Tipo de evento</th><td>${ev.tipo}</td></tr>
      <tr><th>Gravidade</th><td>${grav?.label ?? ev.gravidade}</td></tr>
      <tr><th>Local de ocorrência</th><td>${ev.localOcorrencia || "—"}</td></tr>
      <tr><th>Descrição do evento</th><td>${ev.descricao}</td></tr>
      <tr><th>Condutas imediatas</th><td>${ev.condutasImediatas || "—"}</td></tr>
      <tr><th>Notificado a</th><td>${ev.notificadoA || "—"}</td></tr>
      <tr><th>Registrado por</th><td>${ev.registradoPor}</td></tr>
    </table>
    <div class="sig">
      <div class="sig-box">Assinatura do Notificador</div>
      <div class="sig-box">Assinatura da Chefia / Responsável</div>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  const canSave = tipo && gravidade && descricao.trim() && registradoPor.trim();

  return (
    <div className="space-y-4">
      {canEdit && !showForm && (
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> Registrar Evento
        </Button>
      )}

      {showForm && (
        <Card className="border-red-500/30">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Novo Evento Adverso / Incidente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo de evento *</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Gravidade *</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  value={gravidade}
                  onChange={e => setGravidade(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {GRAVIDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Local de ocorrência</label>
              <Input className="text-xs" placeholder="Ex: Leito 5, Corredor, Banheiro…" value={local} onChange={e => setLocal(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Descrição do evento *</label>
              <Textarea className="text-xs resize-none" rows={3} placeholder="Descreva o que aconteceu, quando e como…" value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Condutas imediatas tomadas</label>
              <Textarea className="text-xs resize-none" rows={2} placeholder="Quais ações foram tomadas imediatamente?" value={condutas} onChange={e => setCondutas(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Notificado a (chefia / médico)</label>
                <Input className="text-xs" placeholder="Nome e cargo" value={notificado} onChange={e => setNotificado(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Registrado por *</label>
                <Input className="text-xs" placeholder="Nome e cargo" value={registradoPor} onChange={e => setRegistradoPor(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={handleSave} disabled={!canSave}>Salvar</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {eventos.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum evento adverso registrado</p>
          <p className="text-xs opacity-60">Registre apenas eventos que realmente ocorreram durante o atendimento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map(ev => {
            const grav = GRAVIDADES.find(g => g.value === ev.gravidade);
            return (
              <Card key={ev.id} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{ev.tipo}</span>
                      {grav && <Badge variant="outline" className={`text-[10px] ${grav.color}`}>{grav.label}</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{ev.data} {ev.hora}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handlePrint(ev)}>
                        <Printer className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  <p className="text-xs">{ev.descricao}</p>
                  {ev.condutasImediatas && <p className="text-xs text-muted-foreground"><strong>Condutas:</strong> {ev.condutasImediatas}</p>}
                  {ev.localOcorrencia && <p className="text-xs text-muted-foreground"><strong>Local:</strong> {ev.localOcorrencia}</p>}
                  {ev.registradoPor && <p className="text-xs text-muted-foreground"><strong>Registrado por:</strong> {ev.registradoPor}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Activity, Calendar, Download, ArrowRightLeft, FlaskConical, TrendingUp, ArrowLeft } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}

const TRIAGE_LABELS: Record<string, string> = {
  red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", blue: "Azul",
};
const TRIAGE_COLORS: Record<string, string> = {
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

type Periodo = "hoje" | "semana" | "mes" | "ano";
const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "hoje",   label: "Hoje" },
  { value: "semana", label: "7 dias" },
  { value: "mes",    label: "Este mês" },
  { value: "ano",    label: "Este ano" },
];

interface ProducaoRow { profissional: string; cargo: string; total_evolucoes: string; evolucoes_medicas: string; evolucoes_enfermagem: string; }
interface EpiRow { triage_level: string; total: string; }
interface SetorRow { sector: string; total: string; }
interface DiagRow { diagnosis: string; total: string; }
interface OcupacaoRow { sector: string; total_pacientes: string; internados: string; tempo_medio_horas: string; }
interface AtendRow { dia: string; total: string; vermelho: string; laranja: string; amarelo: string; verde: string; azul: string; altas: string; }
interface TotaisRow { hoje: string; semana: string; mes: string; ano: string; }
interface TriagemLevelRow { triage_level: string; total: string; }
interface TriagemDayRow { dia: string; total: string; vermelho: string; laranja: string; amarelo: string; verde: string; azul: string; }
interface ExameTypeRow { exam_type: string; total: string; }
interface ExameDayRow { dia: string; total: string; laboratorial: string; imagem: string; }
interface TransfHospitalRow { hospital: string; total: string; }
interface TransfDayRow { dia: string; total: string; }

function PeriodoSelector({ value, onChange }: { value: Periodo; onChange: (v: Periodo) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {PERIODOS.map(p => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
            value === p.value
              ? "bg-primary/20 border-primary/50 text-primary"
              : "border-border/40 text-muted-foreground hover:bg-muted/30"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState("totais");
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  const [producao, setProducao] = useState<ProducaoRow[]>([]);
  const [epiTriage, setEpiTriage] = useState<EpiRow[]>([]);
  const [epiSector, setEpiSector] = useState<SetorRow[]>([]);
  const [epiDiag, setEpiDiag] = useState<DiagRow[]>([]);
  const [ocupacao, setOcupacao] = useState<OcupacaoRow[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendRow[]>([]);

  const [totaisAtend, setTotaisAtend] = useState<TotaisRow | null>(null);
  const [totaisAltas, setTotaisAltas] = useState<TotaisRow | null>(null);
  const [totaisTransf, setTotaisTransf] = useState<TotaisRow | null>(null);
  const [triagemByLevel, setTriagemByLevel] = useState<TriagemLevelRow[]>([]);
  const [triagemByDay, setTriagemByDay] = useState<TriagemDayRow[]>([]);
  const [exameByType, setExameByType] = useState<ExameTypeRow[]>([]);
  const [exameByDay, setExameByDay] = useState<ExameDayRow[]>([]);
  const [exameTotal, setExameTotal] = useState("0");
  const [transfByHospital, setTransfByHospital] = useState<TransfHospitalRow[]>([]);
  const [transfByDay, setTransfByDay] = useState<TransfDayRow[]>([]);
  const [transfTotal, setTransfTotal] = useState("0");

  const h = { "x-staff-id": getStaffId() };

  const fetchTab = useCallback(async (tab: string, p: Periodo) => {
    setLoading(true);
    try {
      if (tab === "totais") {
        const r = await fetch("/api/reports/totais", { headers: h });
        if (r.ok) {
          const d = await r.json() as { atendimentos: TotaisRow; altas: TotaisRow; transferencias: TotaisRow };
          setTotaisAtend(d.atendimentos);
          setTotaisAltas(d.altas ?? null);
          setTotaisTransf(d.transferencias);
        }
      } else if (tab === "triagem") {
        const r = await fetch(`/api/reports/triagem?periodo=${p}`, { headers: h });
        if (r.ok) {
          const d = await r.json() as { byLevel: TriagemLevelRow[]; byDay: TriagemDayRow[] };
          setTriagemByLevel(d.byLevel); setTriagemByDay(d.byDay);
        }
      } else if (tab === "exames") {
        const r = await fetch(`/api/reports/exames?periodo=${p}`, { headers: h });
        if (r.ok) {
          const d = await r.json() as { byType: ExameTypeRow[]; byDay: ExameDayRow[]; total: string };
          setExameByType(d.byType); setExameByDay(d.byDay); setExameTotal(d.total);
        }
      } else if (tab === "transferencias") {
        const r = await fetch(`/api/reports/transferencias?periodo=${p}`, { headers: h });
        if (r.ok) {
          const d = await r.json() as { byHospital: TransfHospitalRow[]; byDay: TransfDayRow[]; total: string };
          setTransfByHospital(d.byHospital); setTransfByDay(d.byDay); setTransfTotal(d.total);
        }
      } else if (tab === "producao") {
        const r = await fetch("/api/reports/producao", { headers: h });
        if (r.ok) setProducao(await r.json());
      } else if (tab === "epidemiologico") {
        const r = await fetch("/api/reports/epidemiologico", { headers: h });
        if (r.ok) {
          const d = await r.json() as { triage: EpiRow[]; sector: SetorRow[]; topDiagnosticos: DiagRow[] };
          setEpiTriage(d.triage); setEpiSector(d.sector); setEpiDiag(d.topDiagnosticos);
        }
      } else if (tab === "ocupacao") {
        const r = await fetch("/api/reports/ocupacao", { headers: h });
        if (r.ok) setOcupacao(await r.json());
      } else if (tab === "atendimentos") {
        const r = await fetch("/api/reports/atendimentos", { headers: h });
        if (r.ok) setAtendimentos(await r.json());
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchTab(activeTab, periodo); }, [activeTab, periodo, fetchTab]);

  const exportCSV = (data: Record<string, string>[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(hk => `"${String(row[hk] ?? "")}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const needsPeriodo = ["triagem", "exames", "transferencias"].includes(activeTab);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">Voltar</span>
          </Button>
        </Link>
        <BarChart3 className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold">Relatórios Gerenciais</h1>
          <p className="text-sm text-muted-foreground">Produção, triagem, exames, transferências e ocupação</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1 rounded-lg mb-2">
          <TabsTrigger value="totais" className="text-xs flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Totais
          </TabsTrigger>
          <TabsTrigger value="triagem" className="text-xs flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" /> Triagem
          </TabsTrigger>
          <TabsTrigger value="exames" className="text-xs flex items-center gap-1">
            <FlaskConical className="h-3.5 w-3.5" /> Exames
          </TabsTrigger>
          <TabsTrigger value="transferencias" className="text-xs flex items-center gap-1">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Transferências
          </TabsTrigger>
          <TabsTrigger value="producao" className="text-xs flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Produção
          </TabsTrigger>
          <TabsTrigger value="epidemiologico" className="text-xs flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" /> Epidemiológico
          </TabsTrigger>
          <TabsTrigger value="ocupacao" className="text-xs flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Ocupação
          </TabsTrigger>
          <TabsTrigger value="atendimentos" className="text-xs flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Atend. por Dia
          </TabsTrigger>
        </TabsList>

        {needsPeriodo && (
          <div className="mb-4">
            <PeriodoSelector value={periodo} onChange={setPeriodo} />
          </div>
        )}

        {/* TOTAIS */}
        <TabsContent value="totais">
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Atendimentos Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Hoje",       val: totaisAtend?.hoje },
                      { label: "7 dias",     val: totaisAtend?.semana },
                      { label: "Este mês",   val: totaisAtend?.mes },
                      { label: "Este ano",   val: totaisAtend?.ano },
                    ].map(({ label, val }) => (
                      <div key={label} className="rounded-lg border border-border/40 bg-muted/10 p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-400">{val ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Altas Concedidas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Hoje",       val: totaisAltas?.hoje },
                      { label: "7 dias",     val: totaisAltas?.semana },
                      { label: "Este mês",   val: totaisAltas?.mes },
                      { label: "Este ano",   val: totaisAltas?.ano },
                    ].map(({ label, val }) => (
                      <div key={label} className="rounded-lg border border-border/40 bg-muted/10 p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">{val ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Encaminhamentos / Transferências</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Hoje",       val: totaisTransf?.hoje },
                      { label: "7 dias",     val: totaisTransf?.semana },
                      { label: "Este mês",   val: totaisTransf?.mes },
                      { label: "Este ano",   val: totaisTransf?.ano },
                    ].map(({ label, val }) => (
                      <div key={label} className="rounded-lg border border-border/40 bg-muted/10 p-4 text-center">
                        <p className="text-2xl font-bold text-purple-400">{val ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TRIAGEM */}
        <TabsContent value="triagem">
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Classificações por Nível de Manchester</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => exportCSV(triagemByLevel as unknown as Record<string, string>[], "triagem-nivel.csv")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="space-y-2">
                    {triagemByLevel.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">Sem dados</p>}
                    {triagemByLevel.map((row, i) => {
                      const pct = triagemByLevel.reduce((s, r) => s + Number(r.total), 0);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <Badge className={`text-xs border w-20 justify-center ${TRIAGE_COLORS[row.triage_level] ?? "bg-muted/20"}`}>
                            {TRIAGE_LABELS[row.triage_level] ?? row.triage_level}
                          </Badge>
                          <div className="flex-1 rounded-full bg-muted/30 h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                row.triage_level === "red" ? "bg-red-500" :
                                row.triage_level === "orange" ? "bg-orange-500" :
                                row.triage_level === "yellow" ? "bg-yellow-400" :
                                row.triage_level === "green" ? "bg-green-500" : "bg-blue-500"
                              }`}
                              style={{ width: `${pct > 0 ? (Number(row.total) / pct * 100).toFixed(1) : 0}%` }}
                            />
                          </div>
                          <span className="font-bold text-sm w-8 text-right">{row.total}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {pct > 0 ? `${(Number(row.total) / pct * 100).toFixed(0)}%` : "0%"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Atendimentos por Dia</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => exportCSV(triagemByDay as unknown as Record<string, string>[], "triagem-dia.csv")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Data</th>
                          <th className="text-center py-2 px-2 font-bold">Total</th>
                          <th className="text-center py-2 px-2 text-red-400">Verm.</th>
                          <th className="text-center py-2 px-2 text-orange-400">Lar.</th>
                          <th className="text-center py-2 px-2 text-yellow-400">Amar.</th>
                          <th className="text-center py-2 px-2 text-green-400">Verde</th>
                          <th className="text-center py-2 px-2 text-blue-400">Azul</th>
                        </tr>
                      </thead>
                      <tbody>
                        {triagemByDay.length === 0 ? (
                          <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Nenhum dado disponível</td></tr>
                        ) : triagemByDay.map((row, i) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-2 px-2 font-medium">{new Date(row.dia).toLocaleDateString("pt-BR")}</td>
                            <td className="py-2 px-2 text-center font-bold">{row.total}</td>
                            <td className="py-2 px-2 text-center text-red-400">{row.vermelho}</td>
                            <td className="py-2 px-2 text-center text-orange-400">{row.laranja}</td>
                            <td className="py-2 px-2 text-center text-yellow-400">{row.amarelo}</td>
                            <td className="py-2 px-2 text-center text-green-400">{row.verde}</td>
                            <td className="py-2 px-2 text-center text-blue-400">{row.azul}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* EXAMES */}
        <TabsContent value="exames">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-center">
                <p className="text-2xl font-bold text-cyan-400">{exameTotal}</p>
                <p className="text-xs text-muted-foreground mt-1">Total de exames</p>
              </div>
              {exameByType.map((row, i) => (
                <div key={i} className="rounded-lg border border-border/40 bg-muted/10 p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-400">{row.total}</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {row.exam_type === "laboratorial" ? "Laboratório" : row.exam_type === "imagem" ? "Imagem" : row.exam_type}
                  </p>
                </div>
              ))}
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Exames por Dia</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => exportCSV(exameByDay as unknown as Record<string, string>[], "exames-dia.csv")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Data</th>
                          <th className="text-center py-2 px-2 font-bold">Total</th>
                          <th className="text-center py-2 px-2 text-cyan-400">Lab.</th>
                          <th className="text-center py-2 px-2 text-violet-400">Imagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exameByDay.length === 0 ? (
                          <tr><td colSpan={4} className="text-center text-muted-foreground py-6">Nenhum dado disponível</td></tr>
                        ) : exameByDay.map((row, i) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-2 px-2 font-medium">{new Date(row.dia).toLocaleDateString("pt-BR")}</td>
                            <td className="py-2 px-2 text-center font-bold">{row.total}</td>
                            <td className="py-2 px-2 text-center text-cyan-400">{row.laboratorial}</td>
                            <td className="py-2 px-2 text-center text-violet-400">{row.imagem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TRANSFERÊNCIAS */}
        <TabsContent value="transferencias">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-center">
                <p className="text-2xl font-bold text-purple-400">{transfTotal}</p>
                <p className="text-xs text-muted-foreground mt-1">Total de encaminhamentos</p>
              </div>
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Encaminhamentos por Hospital de Destino</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => exportCSV(transfByHospital as unknown as Record<string, string>[], "transferencias-hospital.csv")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="space-y-2">
                    {transfByHospital.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">Sem dados</p>}
                    {transfByHospital.map((row, i) => {
                      const total = transfByHospital.reduce((s, r) => s + Number(r.total), 0);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm flex-1 truncate">{row.hospital}</span>
                          <div className="w-24 rounded-full bg-muted/30 h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-purple-500"
                              style={{ width: `${total > 0 ? (Number(row.total) / total * 100).toFixed(1) : 0}%` }}
                            />
                          </div>
                          <span className="font-bold text-sm w-8 text-right">{row.total}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Encaminhamentos por Dia</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => exportCSV(transfByDay as unknown as Record<string, string>[], "transferencias-dia.csv")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Data</th>
                          <th className="text-center py-2 px-2 font-bold">Encaminhamentos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfByDay.length === 0 ? (
                          <tr><td colSpan={2} className="text-center text-muted-foreground py-6">Nenhum dado disponível</td></tr>
                        ) : transfByDay.map((row, i) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-2 px-2 font-medium">{new Date(row.dia).toLocaleDateString("pt-BR")}</td>
                            <td className="py-2 px-2 text-center font-bold text-purple-400">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PRODUÇÃO */}
        <TabsContent value="producao">
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Produção por Profissional</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => exportCSV(producao as unknown as Record<string, string>[], "producao.csv")}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground text-sm text-center py-4">Carregando...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Profissional</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cargo</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Total Evoluções</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Médicas</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Enfermagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {producao.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Nenhum dado disponível</td></tr>
                      ) : producao.map((row, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-2 px-2 font-medium">{row.profissional}</td>
                          <td className="py-2 px-2 text-muted-foreground capitalize">{row.cargo?.replace(/_/g, " ")}</td>
                          <td className="py-2 px-2 text-center">
                            <Badge className="text-xs bg-indigo-500/20 text-indigo-400 border-indigo-500/30">{row.total_evolucoes}</Badge>
                          </td>
                          <td className="py-2 px-2 text-center text-muted-foreground">{row.evolucoes_medicas}</td>
                          <td className="py-2 px-2 text-center text-muted-foreground">{row.evolucoes_enfermagem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EPIDEMIOLÓGICO */}
        <TabsContent value="epidemiologico">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Triagem (total histórico)</CardTitle></CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p> : (
                  <div className="space-y-2">
                    {epiTriage.map((row, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Badge className={`text-xs border ${TRIAGE_COLORS[row.triage_level] ?? "bg-muted/20"}`}>
                          {TRIAGE_LABELS[row.triage_level] ?? row.triage_level}
                        </Badge>
                        <span className="font-semibold text-sm">{row.total}</span>
                      </div>
                    ))}
                    {epiTriage.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">Sem dados</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pacientes por Setor (ativos)</CardTitle></CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p> : (
                  <div className="space-y-2">
                    {epiSector.map((row, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm">{row.sector}</span>
                        <Badge className="text-xs bg-muted/30">{row.total}</Badge>
                      </div>
                    ))}
                    {epiSector.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">Sem dados</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 md:col-span-2">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Top 20 Diagnósticos</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => exportCSV(epiDiag as unknown as Record<string, string>[], "diagnosticos.csv")}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {epiDiag.map((row, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/20">
                      <span className="text-xs truncate max-w-[200px]">{row.diagnosis || "(sem diagnóstico)"}</span>
                      <Badge className="text-xs ml-2 shrink-0">{row.total}</Badge>
                    </div>
                  ))}
                  {epiDiag.length === 0 && <p className="col-span-2 text-muted-foreground text-xs text-center py-4">Sem dados</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* OCUPAÇÃO */}
        <TabsContent value="ocupacao">
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Ocupação por Setor (Pacientes Ativos)</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => exportCSV(ocupacao as unknown as Record<string, string>[], "ocupacao.csv")}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Setor</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Internados</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Tempo Médio (h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocupacao.length === 0 ? (
                        <tr><td colSpan={4} className="text-center text-muted-foreground py-6">Nenhum dado disponível</td></tr>
                      ) : ocupacao.map((row, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-2 px-2 font-medium">{row.sector}</td>
                          <td className="py-2 px-2 text-center">
                            <Badge className="text-xs bg-muted/30">{row.total_pacientes}</Badge>
                          </td>
                          <td className="py-2 px-2 text-center text-muted-foreground">{row.internados}</td>
                          <td className="py-2 px-2 text-center text-muted-foreground">
                            {row.tempo_medio_horas != null ? `${row.tempo_medio_horas}h` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATENDIMENTOS POR DIA */}
        <TabsContent value="atendimentos">
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Atendimentos por Dia (últimos 31 dias)</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => exportCSV(atendimentos as unknown as Record<string, string>[], "atendimentos.csv")}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Data</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-center py-2 px-2 font-medium text-red-400">Verm.</th>
                        <th className="text-center py-2 px-2 font-medium text-orange-400">Lar.</th>
                        <th className="text-center py-2 px-2 font-medium text-yellow-400">Amar.</th>
                        <th className="text-center py-2 px-2 font-medium text-green-400">Verde</th>
                        <th className="text-center py-2 px-2 font-medium text-blue-400">Azul</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Altas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atendimentos.length === 0 ? (
                        <tr><td colSpan={8} className="text-center text-muted-foreground py-6">Nenhum dado disponível</td></tr>
                      ) : atendimentos.map((row, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-2 px-2 font-medium">{new Date(row.dia).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2 px-2 text-center font-bold">{row.total}</td>
                          <td className="py-2 px-2 text-center text-red-400">{row.vermelho}</td>
                          <td className="py-2 px-2 text-center text-orange-400">{row.laranja}</td>
                          <td className="py-2 px-2 text-center text-yellow-400">{row.amarelo}</td>
                          <td className="py-2 px-2 text-center text-green-400">{row.verde}</td>
                          <td className="py-2 px-2 text-center text-blue-400">{row.azul}</td>
                          <td className="py-2 px-2 text-center text-muted-foreground">{row.altas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

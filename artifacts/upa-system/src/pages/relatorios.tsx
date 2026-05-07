import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Activity, Calendar, Download } from "lucide-react";

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

interface ProducaoRow { profissional: string; cargo: string; total_evolucoes: string; evolucoes_medicas: string; evolucoes_enfermagem: string; }
interface EpiRow { triage_level: string; total: string; }
interface SetorRow { sector: string; total: string; }
interface DiagRow { diagnosis: string; total: string; }
interface OcupacaoRow { sector: string; total_pacientes: string; internados: string; tempo_medio_horas: string; }
interface AtendRow { dia: string; total: string; vermelho: string; laranja: string; amarelo: string; verde: string; azul: string; altas: string; }

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState("producao");
  const [loading, setLoading] = useState(false);

  const [producao, setProducao] = useState<ProducaoRow[]>([]);
  const [epiTriage, setEpiTriage] = useState<EpiRow[]>([]);
  const [epiSector, setEpiSector] = useState<SetorRow[]>([]);
  const [epiDiag, setEpiDiag] = useState<DiagRow[]>([]);
  const [ocupacao, setOcupacao] = useState<OcupacaoRow[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendRow[]>([]);

  const fetchTab = useCallback(async (tab: string) => {
    setLoading(true);
    const h = { "x-staff-id": getStaffId() };
    try {
      if (tab === "producao") {
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
  }, []);

  useEffect(() => { void fetchTab(activeTab); }, [activeTab, fetchTab]);

  const exportCSV = (data: Record<string, string>[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${String(row[h] ?? "")}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold">Relatórios Gerenciais</h1>
          <p className="text-sm text-muted-foreground">Análise de produção, perfil epidemiológico e ocupação</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1 rounded-lg mb-4">
          <TabsTrigger value="producao" className="text-xs flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Produção por Profissional
          </TabsTrigger>
          <TabsTrigger value="epidemiologico" className="text-xs flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" /> Perfil Epidemiológico
          </TabsTrigger>
          <TabsTrigger value="ocupacao" className="text-xs flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Ocupação por Setor
          </TabsTrigger>
          <TabsTrigger value="atendimentos" className="text-xs flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Atendimentos por Dia
          </TabsTrigger>
        </TabsList>

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
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Triagem</CardTitle></CardHeader>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pacientes por Setor</CardTitle></CardHeader>
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

        {/* ATENDIMENTOS */}
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
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground text-red-400">Verm.</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground text-orange-400">Lar.</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground text-yellow-400">Amar.</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground text-green-400">Verde</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground text-blue-400">Azul</th>
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

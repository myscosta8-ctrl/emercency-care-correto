import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Target, TrendingUp, Users2, RefreshCw, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}

const TRIAGE_LABELS: Record<string, { label: string; color: string; meta: string; metaMin: number }> = {
  red:    { label: "Vermelho", color: "text-red-400",    meta: "Imediato (0 min)",   metaMin: 0   },
  orange: { label: "Laranja",  color: "text-orange-400", meta: "Muito urgente (10 min)", metaMin: 10  },
  yellow: { label: "Amarelo",  color: "text-yellow-400", meta: "Urgente (60 min)",   metaMin: 60  },
  green:  { label: "Verde",    color: "text-green-400",  meta: "Pouco urgente (120 min)", metaMin: 120 },
  blue:   { label: "Azul",     color: "text-blue-400",   meta: "Não urgente (240 min)", metaMin: 240 },
};

interface TempoRow {
  triage_level: string; total: string;
  media_espera_triagem_min: string;
  media_espera_medico_min: string;
  media_permanencia_min: string;
}
interface ConformRow { triage_level: string; total: string; dentro_da_meta: string; }
interface FluxoRow { care_status: string; total: string; }
interface Hoje { admissoes_hoje: string; altas_hoje: string; ativos: string; }

function formatMin(val: string | null | undefined): string {
  const n = Number(val);
  if (!val || isNaN(n)) return "—";
  if (n < 60) return `${n.toFixed(0)} min`;
  return `${(n / 60).toFixed(1)} h`;
}

function pctBar(pct: number, color: string) {
  return (
    <div className="w-full bg-muted/30 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function TemposMetasPage() {
  const [tempos, setTempos] = useState<TempoRow[]>([]);
  const [conformidade, setConformidade] = useState<ConformRow[]>([]);
  const [fluxo, setFluxo] = useState<FluxoRow[]>([]);
  const [hoje, setHoje] = useState<Hoje | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/tempos-metas", { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) {
        const d = await r.json() as { tempos: TempoRow[]; conformidade: ConformRow[]; fluxo: FluxoRow[]; hoje: Hoje };
        setTempos(d.tempos); setConformidade(d.conformidade); setFluxo(d.fluxo); setHoje(d.hoje);
        setLastUpdate(new Date());
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const conformMap = Object.fromEntries(conformidade.map(r => [r.triage_level, r]));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-xs">Voltar</span>
            </Button>
          </Link>
          <Target className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold">Painel de Tempos e Metas</h1>
            <p className="text-sm text-muted-foreground">Indicadores Manchester — Portaria SVS/MS (últimos 30 dias)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Atualizado: {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de resumo do dia */}
      {hoje && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/50 bg-blue-500/5">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{hoje.admissoes_hoje}</p>
              <p className="text-xs text-muted-foreground mt-1">Admissões Hoje</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-green-500/5">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-green-400">{hoje.altas_hoje}</p>
              <p className="text-xs text-muted-foreground mt-1">Altas Hoje</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-orange-500/5">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{hoje.ativos}</p>
              <p className="text-xs text-muted-foreground mt-1">Pacientes Ativos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fluxo atual */}
      {fluxo.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users2 className="h-4 w-4 text-indigo-400" /> Fluxo Atual por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {fluxo.map(f => (
                <div key={f.care_status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
                  <span className="text-xs text-muted-foreground">{f.care_status}</span>
                  <Badge className="text-xs bg-indigo-500/20 text-indigo-400 border-indigo-500/30">{f.total}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conformidade com metas */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" /> Conformidade com Metas (Portaria SVS/MS 10/2017)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(TRIAGE_LABELS).map(([level, info]) => {
                const cr = conformMap[level];
                const total = Number(cr?.total ?? 0);
                const within = Number(cr?.dentro_da_meta ?? 0);
                const pct = total > 0 ? Math.round((within / total) * 100) : null;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <div className="w-24 shrink-0">
                      <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                      <p className="text-[10px] text-muted-foreground">{info.meta}</p>
                    </div>
                    <div className="flex-1">
                      {pct !== null ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{within} / {total} pacientes</span>
                            <div className="flex items-center gap-1">
                              {pct >= 80 ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                              <span className={`text-sm font-bold ${pct >= 80 ? "text-green-400" : "text-red-400"}`}>{pct}%</span>
                            </div>
                          </div>
                          {pctBar(pct, pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500")}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem dados suficientes</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tempos médios por triagem */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" /> Tempos Médios por Nível de Triagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : tempos.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Sem dados disponíveis. Registre horários nos atendimentos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Classificação</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Pacientes</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">
                      <span className="flex items-center justify-center gap-1"><Clock className="h-3 w-3" />Espera Triagem</span>
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">
                      <span className="flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" />Espera Médico</span>
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Permanência Média</th>
                  </tr>
                </thead>
                <tbody>
                  {tempos.map(row => {
                    const info = TRIAGE_LABELS[row.triage_level];
                    const metaMin = info?.metaMin ?? 9999;
                    const espMedico = Number(row.media_espera_medico_min);
                    const overMeta = !isNaN(espMedico) && espMedico > metaMin;
                    return (
                      <tr key={row.triage_level} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 px-2">
                          <span className={`font-medium ${info?.color ?? ""}`}>
                            {info?.label ?? row.triage_level}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{row.total}</td>
                        <td className="py-2 px-2 text-center">{formatMin(row.media_espera_triagem_min)}</td>
                        <td className={`py-2 px-2 text-center font-medium ${overMeta ? "text-red-400" : "text-green-400"}`}>
                          {formatMin(row.media_espera_medico_min)}
                          {overMeta && " ⚠️"}
                        </td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{formatMin(row.media_permanencia_min)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { AdminLayout } from "./layout";
import { useFeatures } from "@/lib/features-context";
import { FEATURE_LABELS, FEATURES_DEFAULTS } from "@/lib/features";
import type { FeatureKey } from "@/lib/features";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudit } from "@/hooks/use-audit";

const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  sinan_pdf:           "Geração automática de fichas SINAN e identificação do paciente em PDF.",
  classificacao_risco: "Painel de classificação de risco Manchester com cores de triagem.",
  triagem_avancada:    "Campos adicionais de triagem avançada no formulário de admissão.",
  dashboard:           "Dashboard principal com lista de pacientes por setor.",
  relatorios:          "Módulo de relatórios gerenciais e estatísticas da UPA.",
  controle_estoque:    "Controle de estoque de medicamentos e insumos (módulo futuro).",
};

export default function AdminFuncionalidadesPage() {
  const { features, toggleFeature } = useFeatures();
  const { registrar } = useAudit();

  function handleToggle(key: FeatureKey) {
    const novoEstado = !features[key];
    toggleFeature(key);
    registrar(
      novoEstado ? `ativou_${key}` : `desativou_${key}`,
      FEATURE_LABELS[key],
    );
  }

  function resetToDefaults() {
    (Object.keys(features) as FeatureKey[]).forEach(key => {
      if (features[key] !== FEATURES_DEFAULTS[key]) toggleFeature(key);
    });
    registrar("restaurou_funcionalidades", "Funcionalidades restauradas para os padrões do sistema.");
  }

  const featureList = Object.entries(features) as [FeatureKey, boolean][];
  const activeCount = featureList.filter(([, v]) => v).length;

  return (
    <AdminLayout title="Funcionalidades">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Funcionalidades do Sistema</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ative ou desative módulos em tempo real. {activeCount} de {featureList.length} ativas.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={resetToDefaults}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrões
          </Button>
        </div>

        <div className="grid gap-3">
          {featureList.map(([key, ativo]) => (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                ativo
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {ativo
                    ? <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    : <XCircle     className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className={cn(
                      "text-sm font-semibold leading-tight",
                      ativo ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {FEATURE_LABELS[key]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {FEATURE_DESCRIPTIONS[key]}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={ativo}
                  onCheckedChange={() => handleToggle(key)}
                  aria-label={FEATURE_LABELS[key]}
                  className="shrink-0 mt-0.5"
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          As alterações são aplicadas imediatamente e persistidas localmente no navegador.
        </p>
      </div>
    </AdminLayout>
  );
}

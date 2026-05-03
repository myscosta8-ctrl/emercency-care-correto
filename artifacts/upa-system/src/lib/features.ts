const config = {
  features: {
    sinan_pdf:           true,
    triagem_avancada:    false,
    classificacao_risco: true,
    dashboard_gestao:    true,
    controle_estoque:    false,
  } as Record<string, boolean>,
};

export type FeatureKey =
  | "sinan_pdf"
  | "triagem_avancada"
  | "classificacao_risco"
  | "dashboard_gestao"
  | "controle_estoque";

export function featureAtiva(nomeFeature: FeatureKey): boolean {
  return config.features[nomeFeature] === true;
}

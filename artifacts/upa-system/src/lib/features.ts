const config = {
  features: {
    sinan_pdf:           true,
    classificacao_risco: true,
    triagem_avancada:    false,
    dashboard:           true,
    relatorios:          true,
    controle_estoque:    false,
  } as Record<string, boolean>,
};

export type FeatureKey =
  | "sinan_pdf"
  | "classificacao_risco"
  | "triagem_avancada"
  | "dashboard"
  | "relatorios"
  | "controle_estoque";

export function featureAtiva(nomeFeature: FeatureKey): boolean {
  return config.features[nomeFeature] === true;
}

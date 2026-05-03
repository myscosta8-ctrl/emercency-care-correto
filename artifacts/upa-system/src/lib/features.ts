export type FeatureKey =
  | "sinan_pdf"
  | "classificacao_risco"
  | "triagem_avancada"
  | "dashboard"
  | "relatorios"
  | "controle_estoque";

const FEATURES: Record<FeatureKey, boolean> = {
  sinan_pdf:           true,
  classificacao_risco: true,
  triagem_avancada:    false,
  dashboard:           true,
  relatorios:          true,
  controle_estoque:    false,
};

export function featureAtiva(feature: FeatureKey): boolean {
  return FEATURES[feature] === true;
}

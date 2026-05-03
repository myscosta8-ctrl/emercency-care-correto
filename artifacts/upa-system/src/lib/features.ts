export type FeatureKey =
  | "sinan_pdf"
  | "classificacao_risco"
  | "triagem_avancada"
  | "dashboard"
  | "relatorios"
  | "controle_estoque";

export const FEATURES_DEFAULTS: Record<FeatureKey, boolean> = {
  sinan_pdf:           true,
  classificacao_risco: true,
  triagem_avancada:    false,
  dashboard:           true,
  relatorios:          true,
  controle_estoque:    false,
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  sinan_pdf:           "SINAN — Notificações Compulsórias",
  classificacao_risco: "Classificação de Risco",
  triagem_avancada:    "Triagem Avançada",
  dashboard:           "Dashboard",
  relatorios:          "Relatórios",
  controle_estoque:    "Controle de Estoque",
};

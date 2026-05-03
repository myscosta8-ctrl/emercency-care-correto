/**
 * Feature flags for UPA Breves — Gestão de Pacientes.
 * Set a flag to `true` to enable the feature, `false` to disable it.
 */
export const FEATURES = {
  sinan_pdf:            true,
  triagem_avancada:     false,
  classificacao_risco:  true,
  dashboard_gestao:     true,
  controle_estoque:     false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const isEnabled = (feature: FeatureKey): boolean => FEATURES[feature];

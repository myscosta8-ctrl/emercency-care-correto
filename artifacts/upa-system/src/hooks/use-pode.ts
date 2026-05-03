import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/features-context";
import type { Acao } from "@/lib/permissions";
import type { FeatureKey } from "@/lib/features";

/**
 * Retorna uma função `pode(acao, feature?)` que verifica permissão de perfil
 * e, opcionalmente, se uma feature flag está ativa — em uma única chamada.
 *
 * Exemplos:
 *   pode("editar_paciente")           // só permissão
 *   pode("gerar_pdf", "sinan_pdf")    // permissão + feature flag
 */
export function usePode() {
  const { pode: podeAuth } = useAuth();
  const { featureAtiva } = useFeatures();

  return function pode(acao: Acao, feature?: FeatureKey): boolean {
    if (!podeAuth(acao)) return false;
    if (feature !== undefined && !featureAtiva(feature)) return false;
    return true;
  };
}

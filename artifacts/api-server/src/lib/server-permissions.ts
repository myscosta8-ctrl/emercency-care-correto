const PERMISSOES: Record<string, string[]> = {
  recepcionista:           ["criar_paciente", "editar_paciente", "visualizar_setores"],
  enfermeiro:              ["editar_paciente", "excluir_paciente", "classificacao_risco", "gerar_pdf", "mudar_setor", "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao"],
  tecnico_enfermagem:      ["registrar_sinais_vitais", "registrar_evolucao"],
  medico:                  ["*"],
  assistente_social:       ["visualizar_setores", "visualizar_relatorios", "editar_paciente", "registrar_nota_social"],
  nutricionista:           ["visualizar_setores", "visualizar_relatorios", "registrar_avaliacao_nutricional"],
  farmaceutico:            ["visualizar_setores", "visualizar_relatorios", "registrar_prescricao", "registrar_farmacia"],
  administrador:           ["*"],
  auxiliar_administrativo: ["editar_paciente", "visualizar_setores", "visualizar_relatorios"],
  diretoria_geral:         ["*"],
};

/**
 * Verifica se um colaborador tem uma permissão.
 * Se o colaborador tiver customPermissions definidas (JSON com lista de ações),
 * usa apenas elas. Caso contrário, usa o padrão do cargo.
 */
export function temPermissaoServer(role: string, acao: string, customPermissions?: string | null): boolean {
  if (customPermissions && customPermissions.trim()) {
    try {
      const perms: string[] = JSON.parse(customPermissions);
      if (Array.isArray(perms) && perms.length > 0) {
        return perms.includes("*") || perms.includes(acao);
      }
    } catch {
      // fall through to role-based check
    }
  }
  const perms = PERMISSOES[role];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(acao);
}

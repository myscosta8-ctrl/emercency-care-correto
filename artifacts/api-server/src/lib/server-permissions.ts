const PERMISSOES: Record<string, (string)[]> = {
  recepcionista:      ["criar_paciente", "editar_paciente", "visualizar_setores"],
  enfermeiro:         ["criar_paciente", "editar_paciente", "excluir_paciente", "classificacao_risco", "gerar_pdf", "mudar_setor", "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao"],
  tecnico_enfermagem: ["criar_paciente", "registrar_sinais_vitais", "registrar_evolucao"],
  medico:             ["*"],
  assistente_social:  ["visualizar_setores", "visualizar_relatorios", "editar_paciente", "registrar_nota_social"],
  nutricionista:      ["visualizar_setores", "visualizar_relatorios", "registrar_avaliacao_nutricional"],
  farmaceutico:       ["visualizar_setores", "visualizar_relatorios", "registrar_prescricao", "registrar_farmacia"],
  administrador:      ["*"],
};

export function temPermissaoServer(role: string, acao: string): boolean {
  const perms = PERMISSOES[role];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(acao);
}

export type Perfil =
  | "recepcionista"
  | "enfermeiro"
  | "tecnico_enfermagem"
  | "medico"
  | "assistente_social"
  | "nutricionista"
  | "farmaceutico"
  | "laboratorio"
  | "administrador"
  | "auxiliar_administrativo"
  | "diretoria_geral";

export type Acao =
  | "criar_paciente"
  | "editar_paciente"
  | "excluir_paciente"
  | "gerar_pdf"
  | "mudar_setor"
  | "visualizar_relatorios"
  | "classificacao_risco"
  | "visualizar_setores"
  | "registrar_sinais_vitais"
  | "registrar_evolucao"
  | "registrar_prescricao"
  | "registrar_nota_social"
  | "registrar_avaliacao_nutricional"
  | "registrar_farmacia"
  | "registrar_exames"
  | "gerenciar_usuarios"
  | "registrar_alergia"
  | "registrar_consentimento"
  | "registrar_obito"
  | "registrar_procedimento"
  | "registrar_interconsulta"
  | "registrar_plano_cuidados"
  | "registrar_medicamento_controlado"
  | "registrar_dispensacao";

export interface Usuario {
  role: string;
  customPermissions?: string;
}

export const PERFIL_LABELS: Record<Perfil, string> = {
  recepcionista:          "Recepcionista",
  enfermeiro:             "Enfermeiro",
  tecnico_enfermagem:     "Técnico de Enfermagem",
  medico:                 "Médico",
  assistente_social:      "Assistente Social",
  nutricionista:          "Nutricionista",
  farmaceutico:           "Farmacêutico",
  laboratorio:            "Técnico de Laboratório",
  administrador:          "Administrador",
  auxiliar_administrativo: "Auxiliar Administrativo",
  diretoria_geral:        "Diretoria Geral",
};

export const ACAO_LABELS: Record<Acao, string> = {
  criar_paciente:                  "Criar Paciente",
  editar_paciente:                 "Editar Paciente",
  excluir_paciente:                "Alta / Excluir Paciente",
  gerar_pdf:                       "Gerar PDF / SINAN",
  mudar_setor:                     "Mover entre Setores",
  visualizar_relatorios:           "Visualizar Relatórios",
  classificacao_risco:             "Classificação de Risco",
  visualizar_setores:              "Visualizar Setores",
  registrar_sinais_vitais:         "Registrar Sinais Vitais",
  registrar_evolucao:              "Registrar Evolução (SOAP)",
  registrar_prescricao:            "Registrar Prescrição",
  registrar_nota_social:           "Registrar Nota Social",
  registrar_avaliacao_nutricional: "Registrar Avaliação Nutricional",
  registrar_farmacia:              "Registrar Dispensação / Farmácia",
  registrar_exames:                "Laboratório / Exames",
  gerenciar_usuarios:              "Gerenciar Usuários",
  registrar_alergia:               "Gestão de Alergias",
  registrar_consentimento:         "Consentimento Informado (TCLE)",
  registrar_obito:                 "Declaração de Óbito",
  registrar_procedimento:          "Formulários de Procedimentos",
  registrar_interconsulta:         "Nota de Interconsulta",
  registrar_plano_cuidados:        "Plano de Cuidados",
  registrar_medicamento_controlado: "Medicamentos Controlados",
  registrar_dispensacao:           "Farmácia — Dispensação",
};

export const ACOES: Acao[] = [
  "criar_paciente", "editar_paciente", "excluir_paciente",
  "gerar_pdf", "mudar_setor", "visualizar_relatorios",
  "classificacao_risco", "visualizar_setores",
  "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao",
  "registrar_nota_social", "registrar_avaliacao_nutricional", "registrar_farmacia",
  "registrar_exames", "gerenciar_usuarios",
  "registrar_alergia", "registrar_consentimento", "registrar_obito",
  "registrar_procedimento", "registrar_interconsulta", "registrar_plano_cuidados",
  "registrar_medicamento_controlado", "registrar_dispensacao",
];

export const PERFIS: Perfil[] = [
  "recepcionista", "enfermeiro", "tecnico_enfermagem", "medico",
  "assistente_social", "nutricionista", "farmaceutico", "laboratorio",
  "administrador", "auxiliar_administrativo", "diretoria_geral",
];

export const PERMISSOES: Record<Perfil, (Acao | "*")[]> = {
  recepcionista:          ["criar_paciente", "editar_paciente", "visualizar_setores"],
  enfermeiro:             ["editar_paciente", "excluir_paciente", "classificacao_risco", "gerar_pdf", "mudar_setor", "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao", "registrar_alergia", "registrar_consentimento", "registrar_procedimento", "registrar_interconsulta", "registrar_plano_cuidados"],
  tecnico_enfermagem:     ["registrar_sinais_vitais", "registrar_evolucao"],
  medico:                 ["*"],
  assistente_social:      ["visualizar_setores", "visualizar_relatorios", "editar_paciente", "registrar_nota_social"],
  nutricionista:          ["visualizar_setores", "visualizar_relatorios", "registrar_avaliacao_nutricional"],
  farmaceutico:           ["visualizar_setores", "visualizar_relatorios", "registrar_prescricao", "registrar_farmacia", "registrar_exames", "registrar_medicamento_controlado", "registrar_dispensacao"],
  laboratorio:            ["visualizar_setores", "registrar_exames"],
  administrador:          ["*"],
  auxiliar_administrativo: ["editar_paciente", "visualizar_setores", "visualizar_relatorios"],
  diretoria_geral:        ["*"],
};

export function temPermissao(usuario: Usuario | null | undefined, acao: Acao): boolean {
  if (!usuario) return false;

  // Se o colaborador tem permissões individuais configuradas, usa elas
  if (usuario.customPermissions && usuario.customPermissions.trim()) {
    try {
      const perms: string[] = JSON.parse(usuario.customPermissions);
      if (Array.isArray(perms) && perms.length > 0) {
        return perms.includes("*") || perms.includes(acao);
      }
    } catch {
      // fall through to role-based check
    }
  }

  // Fallback: usa padrão do cargo
  const permissoes = PERMISSOES[usuario.role as Perfil];
  if (!permissoes) return false;
  return permissoes.includes("*") || (permissoes as Acao[]).includes(acao);
}

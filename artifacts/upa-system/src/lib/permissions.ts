export type Perfil =
  | "recepcionista"
  | "enfermeiro"
  | "tecnico_enfermagem"
  | "medico"
  | "assistente_social"
  | "nutricionista"
  | "farmaceutico"
  | "administrador";

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
  | "gerenciar_usuarios";

export interface Usuario {
  role: string;
}

export const PERFIL_LABELS: Record<Perfil, string> = {
  recepcionista:      "Recepcionista",
  enfermeiro:         "Enfermeiro",
  tecnico_enfermagem: "Técnico de Enfermagem",
  medico:             "Médico",
  assistente_social:  "Assistente Social",
  nutricionista:      "Nutricionista",
  farmaceutico:       "Farmacêutico",
  administrador:      "Administrador",
};

export const ACAO_LABELS: Record<Acao, string> = {
  criar_paciente:                "Criar Paciente",
  editar_paciente:               "Editar Paciente",
  excluir_paciente:              "Alta / Excluir Paciente",
  gerar_pdf:                     "Gerar PDF / SINAN",
  mudar_setor:                   "Mover entre Setores",
  visualizar_relatorios:         "Visualizar Relatórios",
  classificacao_risco:           "Classificação de Risco",
  visualizar_setores:            "Visualizar Setores",
  registrar_sinais_vitais:       "Registrar Sinais Vitais",
  registrar_evolucao:            "Registrar Evolução (SOAP)",
  registrar_prescricao:          "Registrar Prescrição",
  registrar_nota_social:         "Registrar Nota Social",
  registrar_avaliacao_nutricional: "Registrar Avaliação Nutricional",
  registrar_farmacia:            "Registrar Dispensação / Farmácia",
  gerenciar_usuarios:            "Gerenciar Usuários",
};

export const ACOES: Acao[] = [
  "criar_paciente", "editar_paciente", "excluir_paciente",
  "gerar_pdf", "mudar_setor", "visualizar_relatorios",
  "classificacao_risco", "visualizar_setores",
  "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao",
  "registrar_nota_social", "registrar_avaliacao_nutricional", "registrar_farmacia",
  "gerenciar_usuarios",
];

export const PERFIS: Perfil[] = [
  "recepcionista", "enfermeiro", "tecnico_enfermagem", "medico",
  "assistente_social", "nutricionista", "farmaceutico", "administrador",
];

export const PERMISSOES: Record<Perfil, (Acao | "*")[]> = {
  recepcionista:      ["criar_paciente", "editar_paciente", "visualizar_setores"],
  enfermeiro:         ["criar_paciente", "editar_paciente", "excluir_paciente", "classificacao_risco", "gerar_pdf", "mudar_setor", "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao"],
  tecnico_enfermagem: ["criar_paciente", "registrar_sinais_vitais"],
  medico:             ["*"],
  assistente_social:  ["visualizar_setores", "visualizar_relatorios", "editar_paciente", "registrar_nota_social"],
  nutricionista:      ["visualizar_setores", "visualizar_relatorios", "registrar_avaliacao_nutricional"],
  farmaceutico:       ["visualizar_setores", "visualizar_relatorios", "registrar_prescricao", "registrar_farmacia"],
  administrador:      ["*"],
};

export function temPermissao(usuario: Usuario | null | undefined, acao: Acao): boolean {
  if (!usuario) return false;
  const permissoes = PERMISSOES[usuario.role as Perfil];
  if (!permissoes) return false;
  return permissoes.includes("*") || (permissoes as Acao[]).includes(acao);
}

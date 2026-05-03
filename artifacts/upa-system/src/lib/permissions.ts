export type Perfil = "direcao" | "administrativo" | "coordenacao" | "enfermeiro" | "tecnico";
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
  | "registrar_prescricao";

export interface Usuario {
  perfil: Perfil;
}

export const PERFIL_LABELS: Record<Perfil, string> = {
  direcao:        "Direção",
  administrativo: "Administrativo",
  coordenacao:    "Coordenação",
  enfermeiro:     "Enfermeiro",
  tecnico:        "Técnico",
};

export const ACAO_LABELS: Record<Acao, string> = {
  criar_paciente:          "Criar Paciente",
  editar_paciente:         "Editar Paciente",
  excluir_paciente:        "Alta / Excluir Paciente",
  gerar_pdf:               "Gerar PDF / SINAN",
  mudar_setor:             "Mover entre Setores",
  visualizar_relatorios:   "Visualizar Relatórios",
  classificacao_risco:     "Classificação de Risco",
  visualizar_setores:      "Visualizar Setores",
  registrar_sinais_vitais: "Registrar Sinais Vitais",
  registrar_evolucao:      "Registrar Evolução (SOAP)",
  registrar_prescricao:    "Registrar Prescrição",
};

export const ACOES: Acao[] = [
  "criar_paciente", "editar_paciente", "excluir_paciente",
  "gerar_pdf", "mudar_setor", "visualizar_relatorios",
  "classificacao_risco", "visualizar_setores",
  "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao",
];

export const PERFIS: Perfil[] = [
  "direcao", "administrativo", "coordenacao", "enfermeiro", "tecnico",
];

export const PERMISSOES: Record<Perfil, (Acao | "*")[]> = {
  direcao:        ["*"],
  administrativo: ["*"],
  coordenacao: [
    "criar_paciente", "editar_paciente", "excluir_paciente",
    "mudar_setor", "visualizar_setores", "visualizar_relatorios",
    "registrar_sinais_vitais",
  ],
  enfermeiro: [
    "criar_paciente", "editar_paciente", "excluir_paciente",
    "classificacao_risco", "gerar_pdf",
    "registrar_sinais_vitais", "registrar_evolucao", "registrar_prescricao",
  ],
  tecnico: [
    "criar_paciente",
    "registrar_sinais_vitais",
  ],
};

export function temPermissao(usuario: Usuario | null | undefined, acao: Acao): boolean {
  if (!usuario) return false;
  const permissoes = PERMISSOES[usuario.perfil];
  return permissoes.includes("*") || permissoes.includes(acao);
}

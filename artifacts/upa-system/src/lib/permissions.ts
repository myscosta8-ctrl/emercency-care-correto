export type Perfil = "direcao" | "administrativo" | "coordenacao" | "enfermeiro" | "tecnico";
export type Acao =
  | "criar_paciente"
  | "editar_paciente"
  | "excluir_paciente"
  | "gerar_pdf"
  | "mudar_setor"
  | "visualizar_relatorios"
  | "classificacao_risco"
  | "visualizar_setores";

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
  criar_paciente:       "Criar Paciente",
  editar_paciente:      "Editar Paciente",
  excluir_paciente:     "Alta / Excluir Paciente",
  gerar_pdf:            "Gerar PDF / SINAN",
  mudar_setor:          "Mover entre Setores",
  visualizar_relatorios:"Visualizar Relatórios",
  classificacao_risco:  "Classificação de Risco",
  visualizar_setores:   "Visualizar Setores",
};

export const ACOES: Acao[] = [
  "criar_paciente", "editar_paciente", "excluir_paciente",
  "gerar_pdf", "mudar_setor", "visualizar_relatorios",
  "classificacao_risco", "visualizar_setores",
];

export const PERFIS: Perfil[] = [
  "direcao", "administrativo", "coordenacao", "enfermeiro", "tecnico",
];

export const PERMISSOES: Record<Perfil, (Acao | "*")[]> = {
  direcao:        ["*"],
  administrativo: ["criar_paciente", "editar_paciente", "excluir_paciente", "gerar_pdf", "visualizar_relatorios"],
  coordenacao:    ["criar_paciente", "editar_paciente", "excluir_paciente", "mudar_setor", "visualizar_setores"],
  enfermeiro:     ["criar_paciente", "editar_paciente", "excluir_paciente", "classificacao_risco"],
  tecnico:        ["criar_paciente"],
};

export function temPermissao(usuario: Usuario | null | undefined, acao: Acao): boolean {
  if (!usuario) return false;
  const permissoes = PERMISSOES[usuario.perfil];
  return permissoes.includes("*") || permissoes.includes(acao);
}

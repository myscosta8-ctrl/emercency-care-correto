export type Perfil = "direcao" | "administrativo" | "coordenacao" | "enfermeiro" | "tecnico";
export type Acao =
  | "criar_paciente"
  | "editar_paciente"
  | "gerar_pdf"
  | "mudar_setor"
  | "visualizar_relatorios"
  | "classificacao_risco"
  | "visualizar_setores";

export interface Usuario {
  perfil: Perfil;
}

const PERMISSOES: Record<Perfil, (Acao | "*")[]> = {
  direcao:        ["*"],
  administrativo: ["criar_paciente", "editar_paciente", "gerar_pdf", "visualizar_relatorios"],
  coordenacao:    ["criar_paciente", "editar_paciente", "mudar_setor", "visualizar_setores"],
  enfermeiro:     ["criar_paciente", "editar_paciente", "classificacao_risco"],
  tecnico:        ["criar_paciente"],
};

export function temPermissao(usuario: Usuario | null | undefined, acao: Acao): boolean {
  if (!usuario) return false;
  const permissoes = PERMISSOES[usuario.perfil];
  return permissoes.includes("*") || permissoes.includes(acao);
}

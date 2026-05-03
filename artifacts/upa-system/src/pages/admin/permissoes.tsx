import { AdminLayout } from "./layout";
import { PERFIS, ACOES, PERFIL_LABELS, ACAO_LABELS, PERMISSOES } from "@/lib/permissions";
import type { Perfil, Acao } from "@/lib/permissions";
import { Check, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function hasPermissao(perfil: Perfil, acao: Acao): boolean {
  const perms = PERMISSOES[perfil];
  return perms.includes("*") || perms.includes(acao);
}

const PERFIL_HEADER_COLOR: Record<Perfil, string> = {
  recepcionista:     "text-pink-400",
  enfermeiro:        "text-cyan-400",
  tecnico_enfermagem:"text-blue-400",
  medico:            "text-emerald-400",
  assistente_social: "text-purple-400",
  nutricionista:     "text-lime-400",
  farmaceutico:      "text-amber-400",
  administrador:     "text-yellow-400",
};

const ACAO_GROUPS: { label: string; acoes: Acao[] }[] = [
  {
    label: "Pacientes",
    acoes: ["criar_paciente", "editar_paciente", "excluir_paciente"],
  },
  {
    label: "Documentos",
    acoes: ["gerar_pdf"],
  },
  {
    label: "Operações",
    acoes: ["mudar_setor", "classificacao_risco"],
  },
  {
    label: "Relatórios & Visibilidade",
    acoes: ["visualizar_relatorios", "visualizar_setores"],
  },
];

export default function AdminPermissoesPage() {
  return (
    <AdminLayout title="Permissões">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Matriz de Permissões</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão completa de quais perfis têm acesso a cada ação do sistema.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-start gap-2 p-3 border-b border-border bg-muted/20">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              As permissões são definidas por perfil e estão fixadas no código do sistema.
              O perfil <strong className="text-yellow-400">Direção</strong> possui acesso irrestrito a todas as ações.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56 sticky left-0 bg-card">
                    Ação
                  </th>
                  {PERFIS.map(perfil => (
                    <th key={perfil} className="px-3 py-3 text-center font-semibold min-w-[90px]">
                      <span className={cn("text-xs", PERFIL_HEADER_COLOR[perfil])}>
                        {PERFIL_LABELS[perfil]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACAO_GROUPS.map(({ label, acoes }) => (
                  <>
                    <tr key={label} className="border-b border-border/30">
                      <td
                        colSpan={PERFIS.length + 1}
                        className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 sticky left-0"
                      >
                        {label}
                      </td>
                    </tr>
                    {acoes.map(acao => (
                      <tr key={acao} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-medium sticky left-0 bg-card">
                          {ACAO_LABELS[acao]}
                        </td>
                        {PERFIS.map(perfil => {
                          const tem = hasPermissao(perfil, acao);
                          return (
                            <td key={perfil} className="px-3 py-2.5 text-center">
                              {tem
                                ? <Check className="h-4 w-4 text-green-400 mx-auto" />
                                : <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-green-400" /> Permitido
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-muted-foreground/30" /> Sem acesso
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

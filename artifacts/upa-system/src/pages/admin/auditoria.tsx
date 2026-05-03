import { AdminLayout } from "./layout";
import { useListAuditLogs } from "@workspace/api-client-react";
import { ClipboardList, RefreshCw, Search, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ACAO_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativou_sinan_pdf:           { label: "Ativou SINAN PDF",          variant: "default"     },
  desativou_sinan_pdf:        { label: "Desativou SINAN PDF",        variant: "secondary"   },
  ativou_classificacao_risco: { label: "Ativou Triagem",             variant: "default"     },
  desativou_classificacao_risco: { label: "Desativou Triagem",       variant: "secondary"   },
  ativou_triagem_avancada:    { label: "Ativou Triagem Avançada",    variant: "default"     },
  desativou_triagem_avancada: { label: "Desativou Triagem Avançada", variant: "secondary"   },
  ativou_relatorios:          { label: "Ativou Relatórios",          variant: "default"     },
  desativou_relatorios:       { label: "Desativou Relatórios",       variant: "secondary"   },
  ativou_controle_estoque:    { label: "Ativou Estoque",             variant: "default"     },
  desativou_controle_estoque: { label: "Desativou Estoque",          variant: "secondary"   },
  criou_usuario:              { label: "Criou usuário",              variant: "default"     },
  editou_usuario:             { label: "Editou usuário",             variant: "outline"     },
  excluiu_usuario:            { label: "Excluiu usuário",            variant: "destructive" },
  ativou_usuario:             { label: "Ativou usuário",             variant: "default"     },
  desativou_usuario:          { label: "Desativou usuário",          variant: "secondary"   },
  restaurou_funcionalidades:  { label: "Restaurou padrões",          variant: "outline"     },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function AcaoBadge({ acao }: { acao: string }) {
  const meta = ACAO_LABELS[acao];
  if (!meta) {
    return (
      <Badge variant="outline" className="font-mono text-xs">
        {acao}
      </Badge>
    );
  }
  return (
    <Badge variant={meta.variant} className="text-xs">
      {meta.label}
    </Badge>
  );
}

export default function AdminAuditoriaPage() {
  const { data: logs, isLoading, refetch, isFetching } = useListAuditLogs({ limit: 200 });
  const [search, setSearch] = useState("");

  const filtered = (logs ?? []).filter(log =>
    !search ||
    log.usuario.toLowerCase().includes(search.toLowerCase()) ||
    log.acao.toLowerCase().includes(search.toLowerCase()) ||
    (log.detalhes ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Auditoria">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Log de Auditoria</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Registro de todas as ações realizadas no sistema.
              {!isLoading && ` ${filtered.length} registros.`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por usuário, ação ou detalhes..."
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "Nenhum registro encontrado para a busca." : "Nenhum registro de auditoria ainda."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {filtered.map(log => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{log.usuario}</span>
                      <AcaoBadge acao={log.acao} />
                    </div>
                    {log.detalhes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.detalhes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    <span className="hidden sm:inline">{formatDate(log.criadoEm)}</span>
                    <span className="sm:hidden">{new Date(log.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Exibindo até 200 registros mais recentes.
        </p>
      </div>
    </AdminLayout>
  );
}

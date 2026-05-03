import { useCreateAuditLog } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useCallback } from "react";

export function useAudit() {
  const { activeUser } = useAuth();
  const { mutate } = useCreateAuditLog();

  const registrar = useCallback(
    (acao: string, detalhes?: string) => {
      if (!activeUser) return;
      mutate({
        data: {
          usuario: activeUser.nome,
          acao,
          ...(detalhes ? { detalhes } : {}),
        },
      });
    },
    [activeUser, mutate],
  );

  return { registrar };
}

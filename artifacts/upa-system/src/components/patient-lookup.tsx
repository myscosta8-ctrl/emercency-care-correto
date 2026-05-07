import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Patient } from "@workspace/api-client-react";
import { Search, UserPlus, User, Clock, ChevronRight, X, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TRIAGE_CLS: Record<string, string> = {
  red:    "bg-red-500/20 text-red-400 border-red-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  green:  "bg-green-500/20 text-green-400 border-green-500/30",
  blue:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
const TRIAGE_LABEL: Record<string, string> = {
  red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", blue: "Azul",
};

const CARE_STATUS_LABEL: Record<string, string> = {
  "Em Triagem":              "Em Triagem",
  "Aguardando Atendimento":  "Aguardando Atend.",
  "Em Atendimento (Cons. 1)":"Cons. 1",
  "Em Atendimento (Cons. 2)":"Cons. 2",
  "Em Medicação":            "Em Medicação",
  "Aguardando Exames":       "Aguard. Exames",
  "Aguardando Reavaliação":  "Aguard. Reavaliação",
  "Em Observação":           "Em Observação",
  "Internado":               "Internado",
  "Em Transferência":        "Em Transferência",
};

function getStaffId(): string {
  try {
    const raw = localStorage.getItem("upa_auth_user");
    if (!raw) return "0";
    const user = JSON.parse(raw) as { id?: number };
    return String(user.id ?? 0);
  } catch {
    return "0";
  }
}

async function fetchLookup(q: string): Promise<Patient[]> {
  if (!q.trim()) return [];
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const resp = await fetch(`${base}/api/patients/lookup?q=${encodeURIComponent(q)}`, {
    headers: { "x-staff-id": getStaffId() },
  });
  if (!resp.ok) return [];
  return resp.json() as Promise<Patient[]>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewPatient: (prefill?: Partial<Patient>) => void;
}

export function PatientLookupDialog({ open, onOpenChange, onNewPatient }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [admitting, setAdmitting] = useState<string | null>(null);
  const [admitError, setAdmitError] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["patient-lookup", debouncedQuery],
    queryFn: () => fetchLookup(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  function handleClose() {
    onOpenChange(false);
    setQuery("");
    setAdmitting(null);
    setAdmitError("");
  }

  async function handleDirectAdmit(p: Patient) {
    setAdmitting(String(p.id));
    setAdmitError("");
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const pr = p as Patient & Record<string, string>;
      const body = {
        full_name:              p.full_name,
        birthDate:              p.birthDate           ?? "",
        age:                    p.age                 ?? 0,
        sex:                    p.sex                 ?? "O",
        motherName:             p.motherName          ?? "",
        estadoCivil:            p.estadoCivil         ?? "",
        corRaca:                p.corRaca             ?? "",
        cpf:                    p.cpf                 ?? "",
        cns:                    p.cns                 ?? "",
        rg:                     p.rg                  ?? "",
        phone:                  p.phone               ?? "",
        email:                  p.email               ?? "",
        address:                p.address             ?? "",
        addressStreet:          pr["addressStreet"]       ?? "",
        addressNumber:          pr["addressNumber"]       ?? "",
        addressNeighborhood:    pr["addressNeighborhood"] ?? "",
        addressCity:            pr["addressCity"]         ?? "Breves",
        addressCep:             pr["addressCep"]          ?? "",
        triage_level:           "yellow",
        careStatus:             "Em Triagem",
        sector:                 "triagem",
        attendanceDate:         new Date().toISOString().slice(0, 10),
        attendanceTime:         new Date().toTimeString().slice(0, 5),
        healthUnit:             "UPA Breves - Breves/PA",
        source_prontuario_number: p.prontuarioNumber ?? "",
      };
      const resp = await fetch(`${base}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-staff-id": getStaffId() },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof err["error"] === "string" ? err["error"] : "Erro ao registrar admissão";
        if (resp.status === 409 && typeof err["existingId"] === "number") {
          handleClose();
          navigate(`/patients/${err["existingId"] as number}`);
          return;
        }
        throw new Error(msg);
      }
      const created = await resp.json() as Patient;
      handleClose();
      navigate(`/patients/${created.id}`);
    } catch (e) {
      setAdmitError(e instanceof Error ? e.message : "Erro ao registrar admissão.");
    } finally {
      setAdmitting(null);
    }
  }

  function handleNewBlank() {
    onNewPatient(undefined);
    handleClose();
  }

  const showResults = debouncedQuery.length >= 2;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Buscar Paciente — Cadastro Único
          </DialogTitle>
          <DialogDescription>
            Digite nome, CPF, CNS ou data de nascimento para verificar se o paciente já tem cadastro.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9 pr-9"
            placeholder="Nome, CPF, CNS, prontuário, nº registro ou nascimento..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {admitError && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{admitError}</span>
          </div>
        )}

        {showResults && (
          <div className="border border-border/40 rounded-md overflow-hidden max-h-72 overflow-y-auto">
            {isFetching ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <div className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <User className="h-6 w-6 mx-auto mb-1 opacity-40" />
                Nenhum cadastro encontrado para "<strong>{debouncedQuery}</strong>"
              </div>
            ) : (
              results.map(p => {
                const isActive = p.careStatus !== "Alta";
                const isLoading = admitting === String(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-border/25 last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <span className={cn(
                      "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border leading-tight",
                      TRIAGE_CLS[p.triage_level] ?? TRIAGE_CLS.blue,
                    )}>
                      {TRIAGE_LABEL[p.triage_level] ?? p.triage_level}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{p.full_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {p.age > 0 && <span>{p.age}a</span>}
                        {p.cpf && <span>CPF: {p.cpf}</span>}
                        {p.cns && <span>CNS: {p.cns}</span>}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            {CARE_STATUS_LABEL[p.careStatus ?? ""] ?? p.careStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isActive ? (
                        /* Patient currently in care — navigate to their active record */
                        <Link href={`/patients/${p.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                            onClick={handleClose}
                          >
                            <ChevronRight className="h-3.5 w-3.5 mr-1" />
                            Ver Atendimento
                          </Button>
                        </Link>
                      ) : (
                        /* Patient discharged — allow new admission directly to triagem */
                        <>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={isLoading}
                            title="Encaminhar para Triagem"
                            onClick={() => handleDirectAdmit(p)}
                          >
                            {isLoading ? (
                              <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            Novo Atendimento
                          </Button>
                          <Link href={`/patients/${p.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              title="Ver último atendimento"
                              onClick={handleClose}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {showResults && results.length > 0
              ? `${results.length} cadastro(s) encontrado(s)`
              : showResults
              ? "Nenhum cadastro existente"
              : "Digite ao menos 2 caracteres para buscar"}
          </p>
          <Button onClick={handleNewBlank} size="sm" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Novo Cadastro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

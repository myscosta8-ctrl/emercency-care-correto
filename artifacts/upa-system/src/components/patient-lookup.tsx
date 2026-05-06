import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Patient } from "@workspace/api-client-react";
import { Search, UserPlus, User, Clock, ChevronRight, X } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["patient-lookup", debouncedQuery],
    queryFn: () => fetchLookup(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  function handleSelectPrefill(p: Patient) {
    onNewPatient({
      full_name:    p.full_name,
      birthDate:    p.birthDate,
      age:          p.age,
      sex:          p.sex as Patient["sex"],
      motherName:   p.motherName,
      cns:          p.cns,
      cpf:          p.cpf,
      rg:           p.rg,
      address:      p.address,
      addressStreet:       (p as unknown as Record<string,string>)["addressStreet"]       ?? "",
      addressNumber:       (p as unknown as Record<string,string>)["addressNumber"]       ?? "",
      addressNeighborhood: (p as unknown as Record<string,string>)["addressNeighborhood"] ?? "",
      addressCity:         (p as unknown as Record<string,string>)["addressCity"]         ?? "",
      addressCep:          (p as unknown as Record<string,string>)["addressCep"]          ?? "",
      phone:        p.phone,
      email:        p.email,
    } as Partial<Patient>);
    onOpenChange(false);
    setQuery("");
  }

  function handleNewBlank() {
    onNewPatient(undefined);
    onOpenChange(false);
    setQuery("");
  }

  const showResults = debouncedQuery.length >= 2;

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) setQuery(""); }}>
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
            placeholder="Nome, CPF, CNS ou data de nascimento..."
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

        {/* Results */}
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
                Nenhum paciente encontrado para "<strong>{debouncedQuery}</strong>"
              </div>
            ) : (
              results.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-border/25 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Triage badge */}
                  <span className={cn(
                    "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border leading-tight",
                    TRIAGE_CLS[p.triage_level] ?? TRIAGE_CLS.blue,
                  )}>
                    {TRIAGE_LABEL[p.triage_level] ?? p.triage_level}
                  </span>

                  {/* Info */}
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
                      <span className={cn(
                        "px-1.5 py-0 rounded border text-[10px] font-medium",
                        p.careStatus === "Alta"
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-primary/10 text-primary border-primary/30",
                      )}>
                        {p.careStatus}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      title="Preencher dados deste paciente no novo atendimento"
                      onClick={() => handleSelectPrefill(p)}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Novo Atendimento
                    </Button>
                    <Link href={`/patients/${p.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        title="Abrir prontuário atual"
                        onClick={() => onOpenChange(false)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {showResults && results.length > 0
              ? `${results.length} registro(s) encontrado(s)`
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

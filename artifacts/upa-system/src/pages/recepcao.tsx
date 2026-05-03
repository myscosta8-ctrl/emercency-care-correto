import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useCreatePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserPlus, Clock, ChevronRight } from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const TRIAGE = {
  red:    { dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-500",    ring: "ring-red-500",    label: "Vermelho — Emergência" },
  orange: { dot: "bg-orange-500", text: "text-orange-400", bg: "bg-orange-500", ring: "ring-orange-500", label: "Laranja — Muito Urgente" },
  yellow: { dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-400", ring: "ring-yellow-400", label: "Amarelo — Urgente" },
  green:  { dot: "bg-green-500",  text: "text-green-400",  bg: "bg-green-500",  ring: "ring-green-500",  label: "Verde — Pouco Urgente" },
  blue:   { dot: "bg-blue-500",   text: "text-blue-400",   bg: "bg-blue-500",   ring: "ring-blue-500",   label: "Azul — Não Urgente" },
} as const;

type TriageKey = keyof typeof TRIAGE;

const SECTORS = [
  { value: "sala_vermelha",         label: "Sala Vermelha" },
  { value: "observacao_adulto",     label: "Obs. Adulto" },
  { value: "observacao_pediatrica", label: "Obs. Pediátrica" },
  { value: "observacao_pre_adulto", label: "Obs. Pré-Adulto" },
];

const SEVERITY: Record<string, number> = { red: 0, orange: 1, yellow: 2, green: 3, blue: 4 };

export default function RecepcaoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex]             = useState("M");
  const [cpf, setCpf]             = useState("");
  const [phone, setPhone]         = useState("");
  const [complaint, setComplaint] = useState("");
  const [triage, setTriage]       = useState<TriageKey>("green");
  const [sector, setSector]       = useState("sala_vermelha");
  const [saving, setSaving]       = useState(false);

  const { data: patients } = useListPatients();
  const createPatient = useCreatePatient();

  useEffect(() => { nameRef.current?.focus(); }, []);

  const todayPatients = (patients ?? [])
    .filter(p => {
      const d = new Date(p.createdAt ?? "");
      const now = new Date();
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    })
    .sort((a, b) => (SEVERITY[a.triage_level ?? "blue"] ?? 4) - (SEVERITY[b.triage_level ?? "blue"] ?? 4));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await createPatient.mutateAsync({
        data: {
          full_name: name.trim(),
          sector,
          triage_level: triage,
          birthDate: birthDate || undefined,
          sex: sex as "M" | "F" | "O",
          cpf: cpf || undefined,
          phone: phone || undefined,
          diagnosis: complaint || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
      toast({ title: "Paciente admitido com sucesso", description: name.trim() });
      setName(""); setBirthDate(""); setCpf(""); setPhone(""); setComplaint(""); setTriage("green");
      nameRef.current?.focus();
    } catch {
      toast({ title: "Erro ao admitir paciente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader title="Recepção — Admissão de Pacientes" />

      <div className="flex flex-1 overflow-hidden">
        {/* ── FORM ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-4 md:max-w-xl border-r border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Nova Admissão</h2>

            <div className="space-y-1.5">
              <Label htmlFor="r-name">Nome completo *</Label>
              <Input
                id="r-name"
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome do paciente"
                className="text-base h-11"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-dob">Data de nascimento</Label>
                <Input
                  id="r-dob"
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sexo</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Não informado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-cpf">CPF</Label>
                <Input
                  id="r-cpf"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-phone">Telefone</Label>
                <Input
                  id="r-phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(91) 99999-9999"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-complaint">Queixa principal</Label>
              <Textarea
                id="r-complaint"
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                placeholder="Descreva o motivo da consulta..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Triage Color */}
            <div className="space-y-2">
              <Label>Classificação de risco</Label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(TRIAGE) as TriageKey[]).map(key => {
                  const cfg = TRIAGE[key];
                  const selected = triage === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTriage(key)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all",
                        selected
                          ? `border-current ${cfg.text} bg-current/10 ring-2 ring-offset-2 ring-offset-background ring-current`
                          : "border-border text-muted-foreground hover:border-border/80"
                      )}
                    >
                      <span className={cn("h-5 w-5 rounded-full", cfg.dot)} />
                      <span className="text-[10px] font-medium leading-none text-center">
                        {cfg.label.split(" — ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Setor de destino</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full h-12 text-base font-semibold gap-2"
            >
              <UserPlus className="h-5 w-5" />
              {saving ? "Enviando..." : "Enviar à Triagem"}
            </Button>
          </form>
        </div>

        {/* ── TODAY'S PATIENTS ──────────────────────────────────────── */}
        <div className="hidden md:flex flex-col w-80 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admitidos hoje — {todayPatients.length} paciente{todayPatients.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            {todayPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">Nenhum paciente admitido hoje</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {todayPatients.map(p => {
                  const t = TRIAGE[(p.triage_level ?? "blue") as TriageKey];
                  return (
                    <li key={p.id}>
                      <Link href={`/patients/${p.id}`}>
                        <button className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3">
                          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", t?.dot)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(p.createdAt ?? ""), { locale: ptBR, addSuffix: true })}
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useCreatePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserPlus, Clock, ChevronRight } from "lucide-react";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const TRIAGE_DOT: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-400",
  green: "bg-green-500", blue: "bg-blue-500",
};

const ESTADO_CIVIL_OPTIONS = [
  "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Separado(a)",
  "Viúvo(a)", "União estável", "Não informado",
];

const COR_RACA_OPTIONS = [
  "Branca", "Preta", "Parda", "Amarela", "Indígena", "Não informado",
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 border-t border-border/50">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1 mb-3">{children}</p>
    </div>
  );
}

export default function RecepcaoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName]                   = useState("");
  const [birthDate, setBirthDate]         = useState("");
  const [age, setAge]                     = useState("");
  const [sex, setSex]                     = useState("O");
  const [motherName, setMotherName]       = useState("");
  const [estadoCivil, setEstadoCivil]     = useState("");
  const [corRaca, setCorRaca]             = useState("");
  const [cpf, setCpf]                     = useState("");
  const [rg, setRg]                       = useState("");
  const [cns, setCns]                     = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity]     = useState("Breves");
  const [addressCep, setAddressCep]       = useState("");
  const [phone, setPhone]                 = useState("");
  const [saving, setSaving]               = useState(false);

  const { data: patients } = useListPatients();
  const createPatient = useCreatePatient();

  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    if (!birthDate) return;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return;
    const today = new Date();
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    setAge(String(Math.max(0, a)));
  }, [birthDate]);

  const todayPatients = (patients ?? [])
    .filter(p => {
      const d = new Date(p.createdAt ?? "");
      const now = new Date();
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    })
    .sort((a, b) => new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime());

  function resetForm() {
    setName(""); setBirthDate(""); setAge(""); setSex("O");
    setMotherName(""); setEstadoCivil(""); setCorRaca("");
    setCpf(""); setRg(""); setCns("");
    setAddressStreet(""); setAddressNumber(""); setAddressNeighborhood("");
    setAddressCity("Breves"); setAddressCep(""); setPhone("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const address = [addressStreet, addressNumber, addressNeighborhood, addressCity, addressCep]
        .filter(Boolean).join(", ");
      await createPatient.mutateAsync({
        data: {
          full_name: name.trim(),
          sector: "triagem",
          triage_level: "green",
          care_status: "Aguardando Triagem",
          birthDate:   birthDate || undefined,
          age:         age ? Number(age) : undefined,
          sex:         sex as "M" | "F" | "O",
          motherName:  motherName || undefined,
          estadoCivil: estadoCivil || undefined,
          corRaca:     corRaca || undefined,
          cpf:         cpf || undefined,
          rg:          rg || undefined,
          cns:         cns || undefined,
          addressStreet:       addressStreet || undefined,
          addressNumber:       addressNumber || undefined,
          addressNeighborhood: addressNeighborhood || undefined,
          addressCity:         addressCity || undefined,
          addressCep:          addressCep || undefined,
          address:     address || undefined,
          phone:       phone || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
      toast({ title: "Paciente admitido com sucesso", description: name.trim() });
      resetForm();
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
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Nova Admissão — Dados do Paciente
            </h2>

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Nome completo *</Label>
              <Input
                id="r-name" ref={nameRef}
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Nome do paciente"
                className="text-base h-11" required
              />
            </div>

            {/* Nascimento + Idade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-dob">Data de nascimento</Label>
                <Input id="r-dob" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-age">
                  Idade
                  {birthDate && <span className="text-[10px] text-primary ml-1">(automática)</span>}
                </Label>
                <Input
                  id="r-age" type="number" min={0}
                  value={age} readOnly={!!birthDate}
                  onChange={e => setAge(e.target.value)}
                  placeholder="0"
                  className={cn("h-10", birthDate && "bg-muted/40 text-muted-foreground cursor-not-allowed")}
                />
              </div>
            </div>

            {/* Sexo */}
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["M","F","O"] as const).map((v, i) => (
                  <button key={v} type="button" onClick={() => setSex(v)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors h-10",
                      sex === v ? "bg-primary/20 border-primary text-primary" : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    )}
                  >{["Masculino","Feminino","Não inf."][i]}</button>
                ))}
              </div>
            </div>

            {/* Nome da mãe */}
            <div className="space-y-1.5">
              <Label htmlFor="r-mother">Nome da mãe</Label>
              <Input id="r-mother" value={motherName} onChange={e => setMotherName(e.target.value)} placeholder="Nome completo da mãe" className="h-10" />
            </div>

            {/* Estado civil + Cor/Raça */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado civil</Label>
                <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {ESTADO_CIVIL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cor / Raça</Label>
                <Select value={corRaca} onValueChange={setCorRaca}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {COR_RACA_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Documentos */}
            <SectionHeader>Documentos</SectionHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-cpf">CPF</Label>
                <Input id="r-cpf" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-rg">RG</Label>
                <Input id="r-rg" value={rg} onChange={e => setRg(e.target.value)} placeholder="0.000.000" className="h-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-cns">CNS — Cartão Nacional de Saúde</Label>
              <Input id="r-cns" value={cns} onChange={e => setCns(e.target.value)} placeholder="000 0000 0000 0000" maxLength={18} className="h-10" />
            </div>

            {/* ── Endereço */}
            <SectionHeader>Endereço</SectionHeader>

            <div className="space-y-1.5">
              <Label htmlFor="r-street">Logradouro</Label>
              <Input id="r-street" value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Rua, Av., Travessa, Passagem..." className="h-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-number">Número</Label>
                <Input id="r-number" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} placeholder="123 / S/N" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-neighborhood">Bairro</Label>
                <Input id="r-neighborhood" value={addressNeighborhood} onChange={e => setAddressNeighborhood(e.target.value)} placeholder="Bairro" className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-city">Cidade</Label>
                <Input id="r-city" value={addressCity} onChange={e => setAddressCity(e.target.value)} placeholder="Breves" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-cep">CEP</Label>
                <Input
                  id="r-cep" value={addressCep}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "");
                    setAddressCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5, 8)}` : v);
                  }}
                  placeholder="68800-000" maxLength={9} className="h-10"
                />
              </div>
            </div>

            {/* ── Contato */}
            <SectionHeader>Contato</SectionHeader>

            <div className="space-y-1.5">
              <Label htmlFor="r-phone">Telefone</Label>
              <Input id="r-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(91) 99999-9999" className="h-10" />
            </div>

            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full h-12 text-base font-semibold gap-2"
            >
              <UserPlus className="h-5 w-5" />
              {saving ? "Registrando..." : "Admitir Paciente"}
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
                {todayPatients.map(p => (
                  <li key={p.id}>
                    <Link href={`/patients/${p.id}`}>
                      <button className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3">
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", TRIAGE_DOT[p.triage_level ?? "blue"] ?? "bg-blue-500")} />
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
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

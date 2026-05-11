import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/lib/use-auth";
import { RoleHeader } from "@/components/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, Save, Printer, ClipboardList, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getStaffId(): string {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}

function authHeaders() {
  return { "Content-Type": "application/json", "x-staff-id": getStaffId() };
}

function now() {
  const d = new Date();
  return {
    date: format(d, "dd/MM/yyyy"),
    time: format(d, "HH:mm"),
    full: format(d, "dd/MM/yyyy 'às' HH:mm"),
  };
}

// ─── tipos ────────────────────────────────────────────────────────────────────

interface MedRow { medicacao: string; dose: string; via: string; horario: string; enfermeiro: string }

interface FormData {
  // 2
  dataAtendimento: string; horaAtendimento: string; classificacaoRisco: string;
  origemPaciente: string[]; origemOutro: string; setor: string;
  enfermeiroResponsavel: string; coren: string;
  // 3
  queixaPrincipal: string[]; queixaOutros: string;
  // 4
  historiaClinica: string[]; historiaObservacoes: string;
  // 5
  svPa: string; svFc: string; svFr: string; svSpo2: string;
  svTemp: string; svGlicemia: string; svEva: string;
  // 6
  avaliacaoEstadoGeral: string;
  avaliacaoConsciencia: string[]; avaliacaoPele: string[];
  avaliacaoRespiracao: string[]; avaliacaoPerfusao: string[];
  avaliacaoMobilidade: string[]; tecCapilar: string;
  // 7
  antecedentes: string[]; antecedentesOutros: string;
  // 8
  alergia: string; alergiaQual: string;
  // 9
  medicacaoContinua: string; medicacaoContinuaQuais: string;
  // 10
  procedimentos: string[]; procedimentosOutros: string;
  // 11
  medicacoesAdministradas: MedRow[];
  // 12
  evolucaoEnfermagem: string[]; intercorrenciaQual: string; evolucaoObservacoes: string;
  // 13
  conduta: string[]; condutaObservacoes: string;
  // 14
  assinaturaEnfermeiro: string; assinaturaCoren: string; assinaturaData: string;
}

function blankForm(): FormData {
  const t = now();
  return {
    dataAtendimento: t.date, horaAtendimento: t.time, classificacaoRisco: "",
    origemPaciente: [], origemOutro: "", setor: "",
    enfermeiroResponsavel: "", coren: "",
    queixaPrincipal: [], queixaOutros: "",
    historiaClinica: [], historiaObservacoes: "",
    svPa: "", svFc: "", svFr: "", svSpo2: "", svTemp: "", svGlicemia: "", svEva: "",
    avaliacaoEstadoGeral: "", avaliacaoConsciencia: [], avaliacaoPele: [],
    avaliacaoRespiracao: [], avaliacaoPerfusao: [], avaliacaoMobilidade: [], tecCapilar: "",
    antecedentes: [], antecedentesOutros: "",
    alergia: "nao", alergiaQual: "",
    medicacaoContinua: "nao", medicacaoContinuaQuais: "",
    procedimentos: [], procedimentosOutros: "",
    medicacoesAdministradas: [{ medicacao: "", dose: "", via: "", horario: "", enfermeiro: "" }],
    evolucaoEnfermagem: [], intercorrenciaQual: "", evolucaoObservacoes: "",
    conduta: [], condutaObservacoes: "",
    assinaturaEnfermeiro: "", assinaturaCoren: "", assinaturaData: t.full,
  };
}

// ─── sub-componentes reutilizáveis ────────────────────────────────────────────

function SecHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="bg-[#1a5c2a] text-white text-xs font-bold px-3 py-1.5 rounded-t flex items-center gap-2">
      <span className="bg-white/20 rounded px-1.5 py-0.5">{n}</span>
      {title}
    </div>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors text-sm text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[#1a5c2a] w-3.5 h-3.5 shrink-0" />
      {label}
    </label>
  );
}

function Radio({ label, name, value, checked, onChange }: { label: string; name: string; value: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors text-sm text-muted-foreground">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="accent-[#1a5c2a] w-3.5 h-3.5 shrink-0" />
      {label}
    </label>
  );
}

function Field({ label, value, onChange, className, readOnly }: { label: string; value: string; onChange?: (v: string) => void; className?: string; readOnly?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{label}:</span>
      {readOnly
        ? <span className="text-sm font-medium border-b border-border/40 flex-1 pb-0.5">{value || "—"}</span>
        : <input
            value={value}
            onChange={e => onChange?.(e.target.value)}
            className="flex-1 bg-transparent border-b border-border/60 text-sm focus:outline-none focus:border-[#1a5c2a] pb-0.5 min-w-0"
          />
      }
    </div>
  );
}

// ─── patient info (seção 1 — leitura apenas) ──────────────────────────────────

interface PatientInfo {
  fullName: string; motherName: string; birthDate: string | null; age: number;
  sex: string; cpf: string; cns: string; address: string; addressNumber: string;
  addressNeighborhood: string; addressCity: string; phone: string; prontuarioNumber: string;
}

function Section1({ patient, prontuario }: { patient: PatientInfo; prontuario: string }) {
  const sex = patient.sex === "M" ? "Masculino" : patient.sex === "F" ? "Feminino" : patient.sex || "—";
  const dob = patient.birthDate
    ? format(new Date(patient.birthDate), "dd/MM/yyyy")
    : "—";

  return (
    <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
      <SecHeader n="1" title="IDENTIFICAÇÃO DO PACIENTE" />
      <div className="p-3 space-y-2 bg-card">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Field label="Nome" value={patient.fullName} readOnly />
          <Field label="Nome da mãe" value={patient.motherName} readOnly />
        </div>
        <div className="grid grid-cols-4 gap-x-6 gap-y-2">
          <Field label="Data de nasc." value={dob} readOnly />
          <Field label="Idade" value={`${patient.age} anos`} readOnly />
          <Field label="Sexo" value={sex} readOnly className="col-span-2" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Field label="CPF" value={patient.cpf} readOnly />
          <Field label="Cartão SUS" value={patient.cns} readOnly />
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-2">
          <Field label="Endereço" value={patient.address} readOnly />
          <Field label="Nº" value={patient.addressNumber} readOnly />
          <Field label="Bairro" value={patient.addressNeighborhood} readOnly />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Field label="Município" value={patient.addressCity} readOnly />
          <Field label="Telefone" value={patient.phone} readOnly />
        </div>
        <Field label="Prontuário" value={prontuario} readOnly />
      </div>
    </div>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function PatientNursingForm() {
  const [, params] = useRoute("/patients/:id/ficha-enfermagem");
  const [, params2] = useRoute("/patients/:id/ficha-enfermagem/:formId");
  const [, setLocation] = useLocation();
  const { activeUser } = useAuth();
  const { toast } = useToast();

  const patientId = Number(params?.id ?? params2?.id ?? 0);
  const formId = params2?.formId ? Number(params2.formId) : null;

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [form, setForm] = useState<FormData>(blankForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(formId);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ── carrega dados do paciente + ficha existente ──────────────────────────
  useEffect(() => {
    if (!patientId) return;
    const h = { "x-staff-id": getStaffId() };

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}api/patients/${patientId}`, { headers: h }).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}api/patients/${patientId}/vitals`, { headers: h }).then(r => r.json()),
      formId
        ? fetch(`${import.meta.env.BASE_URL}api/patients/${patientId}/nursing-forms/${formId}`, { headers: h }).then(r => r.json())
        : Promise.resolve(null),
    ]).then(([pat, vitals, existing]) => {
      // patient
      const p = pat as Record<string, unknown>;
      setPatient({
        fullName: String(p.full_name ?? p.fullName ?? ""),
        motherName: String(p.motherName ?? ""),
        birthDate: p.birthDate ? String(p.birthDate) : null,
        age: Number(p.age ?? 0),
        sex: String(p.sex ?? ""),
        cpf: String(p.cpf ?? ""),
        cns: String(p.cns ?? ""),
        address: String(p.address ?? ""),
        addressNumber: String(p.address_number ?? p.addressNumber ?? ""),
        addressNeighborhood: String(p.address_neighborhood ?? p.addressNeighborhood ?? ""),
        addressCity: String(p.address_city ?? p.addressCity ?? ""),
        phone: String(p.phone ?? ""),
        prontuarioNumber: String(p.prontuarioNumber ?? ""),
      });

      if (existing) {
        // ficha existente
        setForm(existing as FormData);
        setSavedAt(String((existing as Record<string, string>).updatedAt ?? ""));
      } else {
        // nova ficha — auto-preenche o que for possível
        const v = Array.isArray(vitals) && vitals.length > 0 ? vitals[0] as Record<string, unknown> : null;
        const user = activeUser;
        setForm(prev => ({
          ...prev,
          svPa: v?.bp ? String(v.bp) : "",
          svFc: v?.hr ? String(v.hr) : "",
          svFr: v?.rr ? String(v.rr) : "",
          svSpo2: v?.spo2 ? String(v.spo2) : "",
          svTemp: v?.temp ? String(v.temp) : "",
          svGlicemia: v?.glucose ? String(v.glucose) : "",
          enfermeiroResponsavel: user?.name ?? "",
          coren: String((user as unknown as Record<string, unknown>)?.coren ?? ""),
          setor: String(p.sector ?? p.setor ?? ""),
        }));
      }
    }).catch(() => {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [patientId, formId, activeUser, toast]);

  // ── mutações de estado do form ──────────────────────────────────────────
  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  function toggleArr(key: keyof FormData, val: string) {
    const arr = (form[key] as string[]);
    set(key, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  function inArr(key: keyof FormData, val: string) {
    return (form[key] as string[]).includes(val);
  }

  // medicações administradas
  function setMed(i: number, field: keyof MedRow, value: string) {
    const rows = [...form.medicacoesAdministradas];
    rows[i] = { ...rows[i], [field]: value };
    set("medicacoesAdministradas", rows);
  }
  function addMedRow() {
    set("medicacoesAdministradas", [...form.medicacoesAdministradas, { medicacao: "", dose: "", via: "", horario: "", enfermeiro: "" }]);
  }
  function removeMedRow(i: number) {
    set("medicacoesAdministradas", form.medicacoesAdministradas.filter((_, idx) => idx !== i));
  }

  // ── salvar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const url = savedId
        ? `${import.meta.env.BASE_URL}api/patients/${patientId}/nursing-forms/${savedId}`
        : `${import.meta.env.BASE_URL}api/patients/${patientId}/nursing-forms`;
      const resp = await fetch(url, {
        method: savedId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error();
      const data = await resp.json() as { id: number; updatedAt: string };
      setSavedId(data.id);
      setSavedAt(data.updatedAt);
      toast({ title: "Ficha salva com sucesso" });
      if (!savedId) setLocation(`/patients/${patientId}/ficha-enfermagem/${data.id}`);
    } catch {
      toast({ title: "Erro ao salvar ficha", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── imprimir ─────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <RoleHeader title="Ficha de Atendimento de Enfermagem" icon={<ClipboardList className="h-5 w-5 text-primary" />} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm animate-pulse">Carregando ficha...</p>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  const RISCO_COLORS: Record<string, string> = {
    Azul: "bg-blue-500", Verde: "bg-green-500",
    Amarelo: "bg-yellow-400", Laranja: "bg-orange-500", Vermelho: "bg-red-500",
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <RoleHeader title="Ficha de Atendimento de Enfermagem — UPA" icon={<ClipboardList className="h-5 w-5 text-primary" />} />

      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl space-y-1 print:px-0 print:py-0 print:max-w-none" ref={printRef}>

        {/* toolbar — oculto ao imprimir */}
        <div className="flex items-center justify-between flex-wrap gap-2 no-print mb-3">
          <button
            onClick={() => setLocation(`/patients/${patientId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao prontuário
          </button>
          <div className="flex items-center gap-2">
            {savedAt && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Salvo em {format(new Date(savedAt), "dd/MM/yyyy 'às' HH:mm")}
              </div>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#1a5c2a] hover:bg-[#154a21]" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Salvar Ficha"}
            </Button>
          </div>
        </div>

        {/* título impresso */}
        <div className="hidden print:block text-center mb-4">
          <p className="font-bold text-base uppercase tracking-wide">
            Ficha de Atendimento de Enfermagem — Unidade de Pronto Atendimento (UPA)
          </p>
        </div>

        {/* ── Seção 1: Identificação ─────────────────────────────────────────── */}
        {patient && (
          <Section1
            patient={patient}
            prontuario={patient.prontuarioNumber}
          />
        )}

        {/* ── Seções 2 e 3 lado a lado ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">

          {/* Seção 2 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="2" title="DADOS DO ATENDIMENTO" />
            <div className="p-3 space-y-3 bg-card">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Data" value={form.dataAtendimento} onChange={v => set("dataAtendimento", v)} />
                <Field label="Hora" value={form.horaAtendimento} onChange={v => set("horaAtendimento", v)} />
                <Field label="Prontuário" value={patient?.prontuarioNumber ?? ""} readOnly />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Classificação de Risco:</p>
                <div className="flex flex-wrap gap-2">
                  {["Azul", "Verde", "Amarelo", "Laranja", "Vermelho"].map(c => (
                    <label key={c} className={cn(
                      "flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded text-xs font-medium transition-all border",
                      form.classificacaoRisco === c
                        ? "border-[#1a5c2a] bg-[#1a5c2a]/10 text-foreground"
                        : "border-border/40 text-muted-foreground hover:border-border"
                    )}>
                      <input type="radio" name="risco" value={c} checked={form.classificacaoRisco === c}
                        onChange={() => set("classificacaoRisco", c)} className="hidden" />
                      <span className={cn("w-2.5 h-2.5 rounded-full", RISCO_COLORS[c])} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Origem do Paciente:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {["Demanda espontânea", "SAMU", "UBS", "Transferência", "Polícia", "Bombeiros"].map(o => (
                    <Chk key={o} label={o} checked={inArr("origemPaciente", o)} onChange={() => toggleArr("origemPaciente", o)} />
                  ))}
                  <div className="col-span-2 flex items-baseline gap-1">
                    <Chk label="Outro:" checked={inArr("origemPaciente", "Outro")} onChange={() => toggleArr("origemPaciente", "Outro")} />
                    <input value={form.origemOutro} onChange={e => set("origemOutro", e.target.value)}
                      className="flex-1 bg-transparent border-b border-border/60 text-xs focus:outline-none focus:border-[#1a5c2a]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Setor:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {["Consultório", "Sala de medicação", "Observação", "Sala vermelha", "Pediatria", "Isolamento"].map(s => (
                    <Radio key={s} label={s} name="setor" value={s} checked={form.setor === s} onChange={() => set("setor", s)} />
                  ))}
                </div>
              </div>

              <Field label="Enfermeiro(a) Responsável" value={form.enfermeiroResponsavel} onChange={v => set("enfermeiroResponsavel", v)} />
              <Field label="COREN" value={form.coren} onChange={v => set("coren", v)} />
            </div>
          </div>

          {/* Seção 3 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="3" title="QUEIXA PRINCIPAL" />
            <div className="p-3 bg-card h-full">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  "Cefaleia", "Vômitos", "Febre", "Diarreia",
                  "Dor abdominal", "Hipertensão", "Dor lombar", "Hipoglicemia",
                  "Dor torácica", "Trauma", "Dispneia", "Ferimento",
                  "Tosse", "Crise asmática", "Náuseas", "Reação alérgica",
                  "Mal-estar geral",
                ].map(q => (
                  <Chk key={q} label={q} checked={inArr("queixaPrincipal", q)} onChange={() => toggleArr("queixaPrincipal", q)} />
                ))}
                <div className="col-span-2 flex items-baseline gap-1 mt-1">
                  <Chk label="Outros:" checked={inArr("queixaPrincipal", "Outros")} onChange={() => toggleArr("queixaPrincipal", "Outros")} />
                  <input value={form.queixaOutros} onChange={e => set("queixaOutros", e.target.value)}
                    className="flex-1 bg-transparent border-b border-border/60 text-xs focus:outline-none focus:border-[#1a5c2a]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seções 4 e 5 lado a lado ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">

          {/* Seção 4 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="4" title="HISTÓRIA CLÍNICA" />
            <div className="p-3 space-y-2 bg-card">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {["Início súbito", "Início gradual", "Piora progressiva", "Sintomas recorrentes", "Primeiro episódio", "Uso prévio de medicação"].map(h => (
                  <Chk key={h} label={h} checked={inArr("historiaClinica", h)} onChange={() => toggleArr("historiaClinica", h)} />
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                <textarea
                  value={form.historiaObservacoes}
                  onChange={e => set("historiaObservacoes", e.target.value)}
                  rows={4}
                  className="w-full bg-transparent border border-border/60 rounded text-sm p-2 focus:outline-none focus:border-[#1a5c2a] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 5 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="5" title="SINAIS VITAIS" />
            <div className="bg-card">
              <div className="grid grid-cols-[1fr_auto] border-b border-border/30">
                <div className="text-xs font-bold text-center py-1.5 border-r border-border/30 bg-muted/20 text-muted-foreground">PARÂMETRO</div>
                <div className="text-xs font-bold text-center py-1.5 w-28 bg-muted/20 text-muted-foreground">VALOR</div>
              </div>
              {[
                { label: "Pressão Arterial (PA)", key: "svPa" as const, unit: "mmHg" },
                { label: "Frequência Cardíaca (FC)", key: "svFc" as const, unit: "bpm" },
                { label: "Frequência Respiratória (FR)", key: "svFr" as const, unit: "irpm" },
                { label: "Saturação de O₂ (Sat O₂)", key: "svSpo2" as const, unit: "%" },
                { label: "Temperatura (T)", key: "svTemp" as const, unit: "°C" },
                { label: "Glicemia Capilar", key: "svGlicemia" as const, unit: "mg/dL" },
                { label: "Escala de Dor (EVA)", key: "svEva" as const, unit: "/10" },
              ].map(({ label, key, unit }, i) => (
                <div key={key} className={cn("grid grid-cols-[1fr_auto] border-b border-border/20", i % 2 === 1 && "bg-muted/5")}>
                  <div className="text-xs px-3 py-1.5 border-r border-border/30 text-foreground">{label}</div>
                  <div className="flex items-center gap-1 px-2 w-28">
                    <input
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      className="w-full bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#1a5c2a] rounded"
                    />
                    <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Seção 6: Avaliação Geral ──────────────────────────────────────── */}
        <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
          <SecHeader n="6" title="AVALIAÇÃO GERAL" />
          <div className="p-3 bg-card">
            <div className="grid grid-cols-6 gap-4">

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Estado Geral</p>
                {["Bom", "Regular", "Grave"].map(v => (
                  <Radio key={v} label={v} name="estadoGeral" value={v} checked={form.avaliacaoEstadoGeral === v} onChange={() => set("avaliacaoEstadoGeral", v)} />
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Nível de Consciência</p>
                {["Consciente", "Orientado", "Sonolento", "Confuso", "Agitado", "Rebaixado", "Inconsciente"].map(v => (
                  <Chk key={v} label={v} checked={inArr("avaliacaoConsciencia", v)} onChange={() => toggleArr("avaliacaoConsciencia", v)} />
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Pele e Mucosas</p>
                {["Coradas", "Hipocoradas", "Cianóticas", "Ictéricas", "Desidratadas", "Normohidratadas", "Diaforéticas"].map(v => (
                  <Chk key={v} label={v} checked={inArr("avaliacaoPele", v)} onChange={() => toggleArr("avaliacaoPele", v)} />
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Respiração</p>
                {["Eupneico", "Dispneico", "Taquipneico", "Bradipneico", "Uso de musculatura acessória", "Sibilos", "Roncos"].map(v => (
                  <Chk key={v} label={v} checked={inArr("avaliacaoRespiracao", v)} onChange={() => toggleArr("avaliacaoRespiracao", v)} />
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Perfusão</p>
                {["Boa perfusão", "Perfusão lentificada", "Extremidades frias", "Extremidades quentes"].map(v => (
                  <Chk key={v} label={v} checked={inArr("avaliacaoPerfusao", v)} onChange={() => toggleArr("avaliacaoPerfusao", v)} />
                ))}
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">TEC:</span>
                  <input value={form.tecCapilar} onChange={e => set("tecCapilar", e.target.value)}
                    className="w-12 bg-transparent border-b border-border/60 text-xs focus:outline-none focus:border-[#1a5c2a] text-center" />
                  <span className="text-[11px] text-muted-foreground">seg</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Mobilidade</p>
                {["Deambula", "Cadeira de rodas", "Acamado", "Necessita apoio", "Restrição de movimento"].map(v => (
                  <Chk key={v} label={v} checked={inArr("avaliacaoMobilidade", v)} onChange={() => toggleArr("avaliacaoMobilidade", v)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Seções 7, 8, 9 na mesma linha ───────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">

          {/* Seção 7 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="7" title="ANTECEDENTES / COMORBIDADES" />
            <div className="p-3 bg-card">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {["HAS", "AVC prévio", "DM", "Nefropatia", "DPOC", "Hepatopatia", "Asma", "Transtorno psiquiátrico", "Cardiopatia", "Câncer", "Epilepsia", "Nenhuma"].map(v => (
                  <Chk key={v} label={v} checked={inArr("antecedentes", v)} onChange={() => toggleArr("antecedentes", v)} />
                ))}
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <Chk label="Outros:" checked={inArr("antecedentes", "Outros")} onChange={() => toggleArr("antecedentes", "Outros")} />
                <input value={form.antecedentesOutros} onChange={e => set("antecedentesOutros", e.target.value)}
                  className="flex-1 bg-transparent border-b border-border/60 text-xs focus:outline-none focus:border-[#1a5c2a]" />
              </div>
            </div>
          </div>

          {/* Seção 8 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="8" title="ALERGIAS" />
            <div className="p-3 space-y-2 bg-card">
              <Radio label="Não" name="alergia" value="nao" checked={form.alergia === "nao"} onChange={() => set("alergia", "nao")} />
              <div className="flex items-baseline gap-2">
                <Radio label="Sim — Qual?" name="alergia" value="sim" checked={form.alergia === "sim"} onChange={() => set("alergia", "sim")} />
              </div>
              {form.alergia === "sim" && (
                <input value={form.alergiaQual} onChange={e => set("alergiaQual", e.target.value)}
                  placeholder="Descreva a alergia..."
                  className="w-full bg-transparent border border-border/60 rounded text-sm p-1.5 focus:outline-none focus:border-[#1a5c2a]" />
              )}
            </div>
          </div>

          {/* Seção 9 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="9" title="USO CONTÍNUO DE MEDICAÇÕES" />
            <div className="p-3 space-y-2 bg-card">
              <Radio label="Não" name="medicacaoContinua" value="nao" checked={form.medicacaoContinua === "nao"} onChange={() => set("medicacaoContinua", "nao")} />
              <Radio label="Sim" name="medicacaoContinua" value="sim" checked={form.medicacaoContinua === "sim"} onChange={() => set("medicacaoContinua", "sim")} />
              {form.medicacaoContinua === "sim" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quais?</p>
                  <textarea
                    value={form.medicacaoContinuaQuais}
                    onChange={e => set("medicacaoContinuaQuais", e.target.value)}
                    rows={3}
                    className="w-full bg-transparent border border-border/60 rounded text-sm p-1.5 focus:outline-none focus:border-[#1a5c2a] resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Seção 10: Procedimentos ────────────────────────────────────── */}
        <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
          <SecHeader n="10" title="PROCEDIMENTOS REALIZADOS" />
          <div className="p-3 bg-card">
            <div className="grid grid-cols-3 gap-x-6 gap-y-1">
              {[
                "Punção venosa", "ECG", "Aspiração de vias aéreas",
                "Medicação VO", "Glicemia capilar", "Cateterismo vesical",
                "Medicação IM", "Curativo", "Lavagem gástrica",
                "Medicação EV", "Coleta laboratorial", "Retirada de pontos",
                "Nebulização", "Sondagem nasogástrica",
                "Oxigenoterapia", "Monitorização",
              ].map(v => (
                <Chk key={v} label={v} checked={inArr("procedimentos", v)} onChange={() => toggleArr("procedimentos", v)} />
              ))}
              <div className="col-span-3 flex items-baseline gap-1 mt-1">
                <Chk label="Outros:" checked={inArr("procedimentos", "Outros")} onChange={() => toggleArr("procedimentos", "Outros")} />
                <input value={form.procedimentosOutros} onChange={e => set("procedimentosOutros", e.target.value)}
                  className="flex-1 bg-transparent border-b border-border/60 text-xs focus:outline-none focus:border-[#1a5c2a]" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Seção 11: Medicações Administradas ───────────────────────────── */}
        <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
          <SecHeader n="11" title="MEDICAÇÕES ADMINISTRADAS" />
          <div className="bg-card">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] text-[10px] font-bold text-muted-foreground bg-muted/20 border-b border-border/30">
              {["MEDICAÇÃO", "DOSE", "VIA", "HORÁRIO", "ENFERMEIRO(A)", ""].map((h, i) => (
                <div key={i} className="px-2 py-1.5 border-r border-border/20 last:border-0">{h}</div>
              ))}
            </div>
            {form.medicacoesAdministradas.map((row, i) => (
              <div key={i} className={cn("grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] border-b border-border/20", i % 2 === 1 && "bg-muted/5")}>
                {(["medicacao", "dose", "via", "horario", "enfermeiro"] as const).map(f => (
                  <input key={f} value={row[f]} onChange={e => setMed(i, f, e.target.value)}
                    className="px-2 py-1.5 bg-transparent text-sm border-r border-border/20 focus:outline-none focus:bg-[#1a5c2a]/5 min-w-0" />
                ))}
                <button onClick={() => removeMedRow(i)} className="px-2 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="p-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={addMedRow}>
                <Plus className="h-3 w-3" /> Adicionar linha
              </Button>
            </div>
          </div>
        </div>

        {/* ── Seções 12, 13, 14 na mesma linha ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">

          {/* Seção 12 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="12" title="EVOLUÇÃO DE ENFERMAGEM" />
            <div className="p-3 space-y-1.5 bg-card">
              {["Paciente estável", "Sem queixas", "Mantém dor", "Melhora após medicação",
                "Aguarda avaliação médica", "Encaminhamento ao médico", "Encaminhado para observação",
                "Alta orientada"].map(v => (
                <Chk key={v} label={v} checked={inArr("evolucaoEnfermagem", v)} onChange={() => toggleArr("evolucaoEnfermagem", v)} />
              ))}
              <div className="flex items-baseline gap-1">
                <Chk label="Intercorrência:" checked={inArr("evolucaoEnfermagem", "Intercorrência")} onChange={() => toggleArr("evolucaoEnfermagem", "Intercorrência")} />
                <input value={form.intercorrenciaQual} onChange={e => set("intercorrenciaQual", e.target.value)}
                  className="flex-1 bg-transparent border-b border-border/60 text-xs focus:outline-none focus:border-[#1a5c2a]" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                <textarea value={form.evolucaoObservacoes} onChange={e => set("evolucaoObservacoes", e.target.value)}
                  rows={3} className="w-full bg-transparent border border-border/60 rounded text-sm p-1.5 focus:outline-none focus:border-[#1a5c2a] resize-none" />
              </div>
            </div>
          </div>

          {/* Seção 13 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="13" title="CONDUTA" />
            <div className="p-3 space-y-1.5 bg-card">
              {["Alta", "Observação", "Encaminhamento médico", "Sala de medicação",
                "Sala vermelha", "Transferência", "Internação", "Exames complementares"].map(v => (
                <Chk key={v} label={v} checked={inArr("conduta", v)} onChange={() => toggleArr("conduta", v)} />
              ))}
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                <textarea value={form.condutaObservacoes} onChange={e => set("condutaObservacoes", e.target.value)}
                  rows={3} className="w-full bg-transparent border border-border/60 rounded text-sm p-1.5 focus:outline-none focus:border-[#1a5c2a] resize-none" />
              </div>
            </div>
          </div>

          {/* Seção 14 */}
          <div className="border border-[#1a5c2a]/40 rounded overflow-hidden">
            <SecHeader n="14" title="ASSINATURA" />
            <div className="p-3 space-y-3 bg-card">
              <div className="space-y-6">
                <div>
                  <Field label="Enfermeiro(a)" value={form.assinaturaEnfermeiro} onChange={v => set("assinaturaEnfermeiro", v)} />
                </div>
                <div>
                  <Field label="COREN" value={form.assinaturaCoren} onChange={v => set("assinaturaCoren", v)} />
                </div>
                <div className="border-t border-dashed border-border/40 pt-3 mt-6">
                  <p className="text-[10px] text-muted-foreground text-center mb-4">Assinatura</p>
                </div>
                <Field label="Data/Hora" value={form.assinaturaData} onChange={v => set("assinaturaData", v)} />
              </div>
            </div>
          </div>

        </div>

        {/* rodapé legal */}
        <div className="border border-[#1a5c2a]/30 rounded p-2 mt-1">
          <p className="text-[10px] text-muted-foreground text-center">
            ATENÇÃO: Este documento é parte integrante do prontuário do paciente e deve ser preenchido de forma legível, completa e conforme os protocolos institucionais.
          </p>
        </div>

        {/* alerta se ainda não salvo */}
        {!savedId && (
          <div className="no-print flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs text-yellow-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Esta ficha ainda não foi salva. Clique em "Salvar Ficha" para preservar os dados.
          </div>
        )}

      </main>

      {/* CSS de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .bg-card { background: white !important; }
          .bg-background { background: white !important; }
          .text-foreground { color: black !important; }
          .text-muted-foreground { color: #555 !important; }
          .border-border\\/40, .border-border\\/30, .border-border\\/60 { border-color: #ccc !important; }
          .border-\\[\\#1a5c2a\\]\\/40 { border-color: #1a5c2a !important; }
          .bg-\\[\\#1a5c2a\\] { background: #1a5c2a !important; }
        }
      `}</style>
    </div>
  );
}

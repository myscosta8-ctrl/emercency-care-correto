import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, BedDouble, AlertTriangle, ShieldAlert, User, RefreshCw, Biohazard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/use-auth";
import { temPermissao } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";

export type Sector =
  | "sala_vermelha"
  | "observacao_adulto"
  | "observacao_pediatrica"
  | "observacao_pre_adulto";

const SECTOR_LABELS: Record<Sector, string> = {
  sala_vermelha:          "Sala Vermelha",
  observacao_adulto:      "Observação Adulto",
  observacao_pediatrica:  "Observação Pediátrica",
  observacao_pre_adulto:  "Pré-Observação",
};

const SECTOR_ORDER: Sector[] = [
  "sala_vermelha",
  "observacao_adulto",
  "observacao_pediatrica",
  "observacao_pre_adulto",
];

interface BedPatient {
  id:          number;
  fullName:    string;
  triageLevel: string;
  sector:      string;
  diagnosis:   string | null;
}

interface Bed {
  id:              number;
  bedId:           string;
  sector:          Sector;
  bedNumber:       number;
  isIsolation:     boolean;
  isOccupied:      boolean;
  patientId:       number | null;
  isolationActive: boolean;
  isolationType:   string | null;
  isolationReason: string | null;
  patient:         BedPatient | null;
}

type IsolationType = "contact" | "droplet" | "airborne";

const ISOLATION_LABELS: Record<IsolationType, string> = {
  contact:  "Contato",
  droplet:  "Gotículas",
  airborne: "Aerossóis",
};

const ISOLATION_COLORS: Record<IsolationType, string> = {
  contact:  "text-orange-400",
  droplet:  "text-blue-400",
  airborne: "text-purple-400",
};

function bedColor(bed: Bed): string {
  if (bed.isolationActive) return "border-purple-500 bg-purple-950/40 hover:bg-purple-950/60";
  if (!bed.isOccupied)     return "border-green-600 bg-green-950/30 hover:bg-green-950/50";
  if (bed.patient?.triageLevel === "red") return "border-red-500 bg-red-950/40 hover:bg-red-950/60";
  return "border-yellow-500 bg-yellow-950/30 hover:bg-yellow-950/50";
}

function bedDotColor(bed: Bed): string {
  if (bed.isolationActive) return "bg-purple-400";
  if (!bed.isOccupied)     return "bg-green-400";
  if (bed.patient?.triageLevel === "red") return "bg-red-400";
  return "bg-yellow-400";
}

interface BedModalProps {
  bed:      Bed | null;
  canEdit:  boolean;
  onClose:  () => void;
  onSaved:  () => void;
}

function BedModal({ bed, canEdit, onClose, onSaved }: BedModalProps) {
  const { activeUser } = useAuth();
  const { toast } = useToast();
  const [isolationActive,  setIsolationActive]  = useState(false);
  const [isolationType,    setIsolationType]    = useState<IsolationType | "">("");
  const [isolationReason,  setIsolationReason]  = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bed) return;
    setIsolationActive(bed.isolationActive);
    setIsolationType((bed.isolationType as IsolationType) ?? "");
    setIsolationReason(bed.isolationReason ?? "");
  }, [bed]);

  if (!bed) return null;

  const handleSave = async () => {
    if (isolationActive && !isolationType) {
      toast({ title: "Selecione o tipo de isolamento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(activeUser ? { "x-staff-id": String(activeUser.id) } : {}),
      };
      const res = await fetch(`/api/beds/${bed.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          isolationActive,
          isolationType:   isolationActive ? isolationType || null : null,
          isolationReason: isolationActive ? isolationReason || null : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Erro ao salvar");
      }
      toast({ title: "Leito atualizado com sucesso" });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isoColor = isolationType ? ISOLATION_COLORS[isolationType as IsolationType] : "";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-sky-400" />
            Leito {bed.bedId}
            {bed.isIsolation && (
              <Badge className="bg-purple-700/50 text-purple-200 text-[10px] border border-purple-500/40">
                Isolamento
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Patient info */}
          <div className="rounded-lg border border-white/8 bg-white/4 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paciente</p>
            {bed.isOccupied && bed.patient ? (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{bed.patient.fullName}</p>
                  {bed.patient.diagnosis && (
                    <p className="text-xs text-muted-foreground mt-0.5">{bed.patient.diagnosis}</p>
                  )}
                </div>
                <Badge
                  className={`text-[10px] capitalize ${
                    bed.patient.triageLevel === "red"
                      ? "bg-red-800/60 text-red-200 border-red-600/40"
                      : bed.patient.triageLevel === "orange"
                      ? "bg-orange-800/60 text-orange-200 border-orange-600/40"
                      : bed.patient.triageLevel === "yellow"
                      ? "bg-yellow-800/60 text-yellow-200 border-yellow-600/40"
                      : "bg-green-800/60 text-green-200 border-green-600/40"
                  }`}
                >
                  {bed.patient.triageLevel}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Leito livre</p>
            )}
          </div>

          {/* Isolation control */}
          <div className={`rounded-lg border p-3 space-y-3 ${
            bed.isIsolation ? "border-purple-500/30 bg-purple-950/20" : "border-white/6 bg-white/3 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`h-4 w-4 ${bed.isIsolation ? "text-purple-400" : "text-muted-foreground"}`} />
                <Label className={`text-sm font-medium ${bed.isIsolation ? "text-white" : "text-muted-foreground"}`}>
                  Precaução de isolamento
                </Label>
              </div>
              {canEdit ? (
                <Switch
                  checked={isolationActive}
                  onCheckedChange={(v) => {
                    if (!bed.isIsolation) {
                      toast({ title: "Apenas leitos de isolamento podem ativar precaução", variant: "destructive" });
                      return;
                    }
                    setIsolationActive(v);
                    if (!v) { setIsolationType(""); setIsolationReason(""); }
                  }}
                  disabled={!bed.isIsolation}
                  className="data-[state=checked]:bg-purple-600"
                />
              ) : (
                <span className={`text-xs font-medium ${isolationActive ? "text-purple-300" : "text-muted-foreground"}`}>
                  {isolationActive ? "Ativo" : "Inativo"}
                </span>
              )}
            </div>

            {!bed.isIsolation && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                Isolamento não disponível neste leito
              </p>
            )}

            {bed.isIsolation && isolationActive && (
              <div className="space-y-3 border-t border-purple-500/20 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de precaução</Label>
                  {canEdit ? (
                    <Select value={isolationType} onValueChange={(v) => setIsolationType(v as IsolationType)}>
                      <SelectTrigger className="h-8 bg-white/5 border-white/10 text-sm">
                        <SelectValue placeholder="Selecionar tipo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                        <SelectItem value="contact">Contato</SelectItem>
                        <SelectItem value="droplet">Gotículas</SelectItem>
                        <SelectItem value="airborne">Aerossóis</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className={`text-sm font-medium ${isoColor}`}>
                      {isolationType ? ISOLATION_LABELS[isolationType as IsolationType] : "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Diagnóstico / motivo</Label>
                  {canEdit ? (
                    <Textarea
                      className="h-20 resize-none bg-white/5 border-white/10 text-sm placeholder:text-muted-foreground/50"
                      placeholder="Ex: suspeita de tuberculose..."
                      value={isolationReason}
                      onChange={(e) => setIsolationReason(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{isolationReason || "—"}</p>
                  )}
                </div>
              </div>
            )}

            {bed.isIsolation && !isolationActive && bed.isolationActive === false && canEdit && (
              <p className="text-[11px] text-muted-foreground">
                Ative a precaução para configurar o tipo e motivo de isolamento.
              </p>
            )}
          </div>

          {canEdit && (
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BedCardProps {
  bed:     Bed;
  onClick: (bed: Bed) => void;
}

function BedCard({ bed, onClick }: BedCardProps) {
  return (
    <button
      className={`relative rounded-lg border p-2.5 text-left transition-colors cursor-pointer w-full ${bedColor(bed)}`}
      onClick={() => onClick(bed)}
      title={bed.isOccupied && bed.patient ? bed.patient.fullName : "Leito livre"}
    >
      {/* Dot indicator */}
      <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${bedDotColor(bed)}`} />

      {/* Isolation warning */}
      {bed.isIsolation && (
        <span className="absolute top-1.5 left-1.5">
          <Biohazard className={`h-3 w-3 ${bed.isolationActive ? "text-purple-300" : "text-purple-500/50"}`} />
        </span>
      )}

      <p className={`text-[11px] font-bold tracking-wide mt-1 ${bed.isIsolation && !bed.isolationActive ? "ml-3" : bed.isIsolation ? "ml-3" : ""}`}>
        {bed.bedId}
      </p>

      {bed.isOccupied && bed.patient ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] font-medium text-white/90 leading-tight truncate pr-2">
            {bed.patient.fullName.split(" ")[0]}
          </p>
          {bed.isolationActive && bed.isolationType && (
            <p className={`text-[9px] font-medium leading-tight ${ISOLATION_COLORS[bed.isolationType as IsolationType]}`}>
              {ISOLATION_LABELS[bed.isolationType as IsolationType]}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-green-400/70">Livre</p>
      )}
    </button>
  );
}

function SectorStats({ beds }: { beds: Bed[] }) {
  const total    = beds.length;
  const occupied = beds.filter(b => b.isOccupied).length;
  const free     = total - occupied;
  const isolation = beds.filter(b => b.isolationActive).length;

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
        {free} livre{free !== 1 ? "s" : ""}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block" />
        {occupied} ocupado{occupied !== 1 ? "s" : ""}
      </span>
      {isolation > 0 && (
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 inline-block" />
          {isolation} isolamento{isolation !== 1 ? "s" : ""}
        </span>
      )}
      <span className="text-white/30">|</span>
      <span className="text-white/50">{occupied}/{total}</span>
    </div>
  );
}

export default function LeitosPage() {
  const { activeUser } = useAuth();
  const [beds,         setBeds]         = useState<Bed[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedBed,  setSelectedBed]  = useState<Bed | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);

  const canEdit = temPermissao(
    activeUser ? { role: activeUser.role } : null,
    "registrar_sinais_vitais",
  );

  const fetchBeds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/beds", {
        headers: activeUser ? { "x-staff-id": String(activeUser.id) } : {},
      });
      if (res.ok) setBeds(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUser]);

  useEffect(() => { fetchBeds(); }, [fetchBeds]);

  const bedsBySector = SECTOR_ORDER.map(sector => ({
    sector,
    beds: beds.filter(b => b.sector === sector).sort((a, b) => a.bedNumber - b.bedNumber),
  }));

  const totalOccupied   = beds.filter(b => b.isOccupied).length;
  const totalBeds       = beds.length;
  const totalIsolations = beds.filter(b => b.isolationActive).length;
  const totalCritical   = beds.filter(b => b.patient?.triageLevel === "red").length;

  return (
    <div className="min-h-screen bg-[#080c10] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/6 bg-[#080c10]/95 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-sky-400" />
              <h1 className="text-sm font-semibold">Gestão de Leitos</h1>
            </div>
          </div>

          {/* Global stats */}
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>
              <span className="text-white font-medium">{totalOccupied}</span>/{totalBeds} ocupados
            </span>
            {totalIsolations > 0 && (
              <span className="flex items-center gap-1 text-purple-300">
                <ShieldAlert className="h-3 w-3" />
                {totalIsolations} isolamento{totalIsolations !== 1 ? "s" : ""}
              </span>
            )}
            {totalCritical > 0 && (
              <span className="flex items-center gap-1 text-red-300">
                <AlertTriangle className="h-3 w-3" />
                {totalCritical} crítico{totalCritical !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchBeds(true)}
            disabled={refreshing}
            className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">Atualizar</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground px-1">
          <span className="font-medium text-white/50 uppercase tracking-wide text-[10px]">Legenda:</span>
          {[
            { color: "bg-green-500", label: "Livre" },
            { color: "bg-yellow-500", label: "Ocupado" },
            { color: "bg-red-500", label: "Crítico" },
            { color: "bg-purple-500", label: "Isolamento" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded ${color} opacity-80`} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <Biohazard className="h-3 w-3 text-purple-400" />
            Leito c/ isolamento disponível
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Carregando leitos...
          </div>
        ) : (
          bedsBySector.map(({ sector, beds: sectorBeds }) => (
            <section key={sector} className="space-y-3">
              {/* Sector header */}
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      sector === "sala_vermelha" ? "bg-red-500" :
                      sector === "observacao_adulto" ? "bg-blue-500" :
                      sector === "observacao_pediatrica" ? "bg-emerald-500" :
                      "bg-orange-500"
                    }`}
                  />
                  {SECTOR_LABELS[sector]}
                </h2>
                <SectorStats beds={sectorBeds} />
              </div>

              {/* Bed grid */}
              <div className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))" }}>
                {sectorBeds.map(bed => (
                  <BedCard key={bed.id} bed={bed} onClick={setSelectedBed} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* No beds */}
        {!loading && beds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <BedDouble className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum leito cadastrado</p>
          </div>
        )}
      </main>

      {/* Modal */}
      <BedModal
        bed={selectedBed}
        canEdit={canEdit}
        onClose={() => setSelectedBed(null)}
        onSaved={() => fetchBeds(true)}
      />
    </div>
  );
}

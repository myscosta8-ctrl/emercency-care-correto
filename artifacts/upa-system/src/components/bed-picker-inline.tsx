import { useState, useEffect } from "react";
import { BedDouble, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BedItem {
  id:          number;
  bedId:       string;
  sector:      string;
  isOccupied:  boolean;
  isIsolation: boolean;
  isExtra:     boolean;
  patient:     { fullName: string } | null;
}

interface BedPickerInlineProps {
  sector:         string;
  authId:         number | undefined;
  selectedBedId:  number | null;
  onSelect:       (bedId: number, bedLabel: string) => void;
}

const SECTOR_LABELS: Record<string, string> = {
  sala_vermelha:         "Sala Vermelha",
  observacao_adulto:     "Obs. Adulto",
  observacao_pediatrica: "Obs. Pediátrica",
  observacao_pre_adulto: "Pré-Adulto",
};

export function BedPickerInline({ sector, authId, selectedBedId, onSelect }: BedPickerInlineProps) {
  const [beds, setBeds]       = useState<BedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!sector) return;
    setLoading(true);
    setError("");
    fetch("/api/beds", {
      headers: authId ? { "x-staff-id": String(authId) } : {},
    })
      .then(r => r.json())
      .then((all: BedItem[]) => {
        setBeds(all.filter(b => b.sector === sector));
        setLoading(false);
      })
      .catch(() => { setError("Erro ao carregar leitos"); setLoading(false); });
  }, [sector, authId]);

  if (!sector) return null;

  const free     = beds.filter(b => !b.isOccupied);
  const occupied = beds.filter(b => b.isOccupied);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BedDouble className="h-3.5 w-3.5" />
          Escolha o leito — {SECTOR_LABELS[sector] ?? sector}
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <span className="text-[10px] text-muted-foreground">
          {free.length} livre{free.length !== 1 ? "s" : ""} / {beds.length} total
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-xs">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Carregando leitos...
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {!loading && !error && beds.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum leito cadastrado neste setor.
        </p>
      )}

      {!loading && !error && beds.length > 0 && (
        <div
          className="grid gap-1.5 max-h-48 overflow-y-auto pr-0.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}
        >
          {/* Free beds first, then occupied */}
          {[...free, ...occupied].map(bed => {
            const isSel = bed.id === selectedBedId;
            const isOcc = bed.isOccupied;

            return (
              <button
                key={bed.id}
                type="button"
                disabled={isOcc}
                onClick={() => !isOcc && onSelect(bed.id, bed.bedId)}
                title={isOcc ? `Ocupado: ${bed.patient?.fullName ?? ""}` : `Leito ${bed.bedId} — livre`}
                className={cn(
                  "relative rounded-md border px-1.5 py-2 text-center text-[10px] font-bold transition-all",
                  "focus:outline-none focus:ring-1 focus:ring-ring",
                  isOcc
                    ? "border-border/30 bg-muted/20 text-muted-foreground/40 cursor-not-allowed"
                    : isSel
                      ? "border-primary bg-primary/15 text-primary ring-1 ring-primary scale-[1.03]"
                      : "border-green-600 bg-green-950/25 text-green-300 hover:bg-green-950/50 hover:border-green-500 cursor-pointer",
                )}
              >
                {isSel && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary border border-background" />
                )}
                <p className="leading-none">{bed.bedId}</p>
                {bed.isIsolation && <p className="text-[8px] leading-none mt-0.5 opacity-60">ISO</p>}
                {bed.isExtra    && <p className="text-[8px] leading-none mt-0.5 opacity-60">EXTRA</p>}
                {isOcc && (
                  <p className="text-[8px] leading-none mt-0.5 opacity-50 truncate max-w-full">
                    {bed.patient?.fullName?.split(" ")[0] ?? "Ocupado"}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!loading && selectedBedId === null && free.length > 0 && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠ Selecione um leito para continuar.
        </p>
      )}
    </div>
  );
}

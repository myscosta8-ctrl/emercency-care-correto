import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList, Stethoscope, FlaskConical, Truck,
  Pill, Activity, UserCheck, ArrowRightLeft, LogIn,
  LogOut, Syringe, FileText, Heart, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  detail?: string;
  authorName?: string;
  sector?: string;
  timestamp: string;
}

const EVENT_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  admissao:       { icon: <LogIn className="h-3.5 w-3.5" />,          color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  evolucao:       { icon: <ClipboardList className="h-3.5 w-3.5" />, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
  prescricao:     { icon: <Stethoscope className="h-3.5 w-3.5" />,   color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
  medicacao:      { icon: <Syringe className="h-3.5 w-3.5" />,       color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30" },
  exame:          { icon: <FlaskConical className="h-3.5 w-3.5" />,  color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  transferencia:  { icon: <Truck className="h-3.5 w-3.5" />,         color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
  farmacia:       { icon: <Pill className="h-3.5 w-3.5" />,          color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  vitais:         { icon: <Activity className="h-3.5 w-3.5" />,      color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
  social:         { icon: <UserCheck className="h-3.5 w-3.5" />,     color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30" },
  nutricao:       { icon: <Heart className="h-3.5 w-3.5" />,         color: "text-lime-400",    bg: "bg-lime-500/10",    border: "border-lime-500/30" },
  nir:            { icon: <ArrowRightLeft className="h-3.5 w-3.5" />,color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  notificacao:    { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30" },
  alta:           { icon: <LogOut className="h-3.5 w-3.5" />,        color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30" },
  default:        { icon: <FileText className="h-3.5 w-3.5" />,      color: "text-muted-foreground", bg: "bg-muted/20",  border: "border-border/30" },
};

function cfg(type: string) {
  return EVENT_CFG[type] ?? EVENT_CFG.default;
}

export function PatientTimelineTab({ patientId }: { patientId: number }) {
  const { activeUser } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeUser) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/patients/${patientId}/timeline`, {
      headers: { "x-staff-id": String(activeUser.id) },
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) { setEvents(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Erro ao carregar linha do tempo"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [patientId, activeUser]);

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );

  if (error) return (
    <div className="text-center py-10 text-sm text-red-400">{error}</div>
  );

  if (events.length === 0) return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      Nenhum evento registrado ainda.
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Linha do Tempo da Internação
        </h3>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
          {events.length}
        </span>
      </div>

      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border/40" />

        <div className="space-y-2">
          {events.map((ev, idx) => {
            const c = cfg(ev.type);
            return (
              <div key={`${ev.id}-${idx}`} className="flex gap-3 relative">
                {/* dot */}
                <div className={cn(
                  "relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border",
                  c.bg, c.border
                )}>
                  <span className={c.color}>{c.icon}</span>
                </div>

                {/* card */}
                <div className={cn(
                  "flex-1 rounded-lg border px-3 py-2 mb-0.5",
                  c.bg, c.border
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold", c.color)}>{ev.label}</p>
                      {ev.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.detail}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {ev.authorName && (
                          <span className="text-[10px] text-muted-foreground/70">{ev.authorName}</span>
                        )}
                        {ev.sector && (
                          <span className="text-[10px] text-muted-foreground/50">{ev.sector}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 text-right whitespace-nowrap">
                      {format(new Date(ev.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

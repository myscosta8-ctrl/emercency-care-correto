import { useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";

export interface CriticalAlert {
  patientId: number;
  full_name: string;
  triage_level: string;
  sector: string;
  bed: string | null;
  diagnosis: string | null;
  alertReason: string;
  alertDetail: string;
  triggeredAt: string;
  spo2: number | null;
  hr: number | null;
  bpSystolic: number | null;
  temp: number | null;
  rr: number | null;
  alertaEnfermeiro: string;
}

// ---------------------------------------------------------------------------
// Web Audio beep — 3 short pulses at 880 Hz, no external files needed.
// ---------------------------------------------------------------------------
function playAlertSound(): void {
  try {
    const ctx = new AudioContext();
    const beep = (t: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.28);
    };
    const now = ctx.currentTime;
    beep(now);
    beep(now + 0.38);
    beep(now + 0.76);
    setTimeout(() => ctx.close(), 2_000);
  } catch {
    // AudioContext unavailable or user hasn't interacted yet — silently skip.
  }
}

// ---------------------------------------------------------------------------
// useCriticalAlerts
// ---------------------------------------------------------------------------
export interface UseCriticalAlertsOptions {
  /** Called with newly-detected critical patients (not previously seen). */
  onNewCriticals?: (newOnes: CriticalAlert[]) => void;
  /** When false, sound and popup callbacks are suppressed. */
  alertsEnabled?: boolean;
}

export function useCriticalAlerts(options: UseCriticalAlertsOptions = {}) {
  const { onNewCriticals, alertsEnabled = true } = options;
  const { activeUser } = useAuth();
  const seenIds        = useRef<Set<number>>(new Set());
  const base           = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const fetchCriticals = useCallback(async (): Promise<CriticalAlert[]> => {
    if (!activeUser?.id) return [];
    const res = await fetch(`${base}/api/alerts/critical`, {
      headers: { "x-staff-id": String(activeUser.id) },
    });
    if (!res.ok) return [];
    return (await res.json()) as CriticalAlert[];
  }, [activeUser?.id, base]);

  const { data = [] } = useQuery<CriticalAlert[]>({
    queryKey:        ["critical-alerts"],
    queryFn:         fetchCriticals,
    refetchInterval: 30_000,
    staleTime:       25_000,
    enabled:         !!activeUser,
  });

  // Fire sound / callback when NEW critical patients appear.
  useEffect(() => {
    const newOnes = data.filter(a => !seenIds.current.has(a.patientId));

    if (newOnes.length > 0) {
      if (alertsEnabled) {
        playAlertSound();
        onNewCriticals?.(newOnes);
      }

      newOnes.forEach(a => seenIds.current.add(a.patientId));

      // Log to audit_log regardless of role (always audit critical events).
      if (activeUser?.id) {
        const detalhes = newOnes
          .map(a => `Paciente #${a.patientId} ${a.full_name}: ${a.alertDetail}`)
          .join("; ");

        fetch(`${base}/api/alerts/log`, {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            "x-staff-id":   String(activeUser.id),
          },
          body: JSON.stringify({ detalhes }),
        }).catch(() => {});
      }
    }

    // Remove IDs that are no longer critical so they can re-trigger later.
    const currentIds = new Set(data.map(a => a.patientId));
    seenIds.current.forEach(id => {
      if (!currentIds.has(id)) seenIds.current.delete(id);
    });
  }, [data, activeUser, base, alertsEnabled, onNewCriticals]);

  const criticalPatientIds = new Set(data.map(a => a.patientId));
  const criticalDetailMap  = new Map(data.map(a => [a.patientId, a.alertDetail]));

  return { criticals: data, criticalPatientIds, criticalDetailMap };
}

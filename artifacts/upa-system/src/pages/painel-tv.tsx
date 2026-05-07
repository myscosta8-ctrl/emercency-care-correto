import { useState, useEffect, useRef, useCallback } from "react";
import { Monitor, Maximize2, Minimize2, Volume2, VolumeX, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallRecord {
  id: number;
  patient_id: number;
  patient_name: string;
  staff_name: string;
  sector: string;
  local_display: string;
  called_at: string;
}

const SECTOR_LABEL: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  triagem:              { label: "TRIAGEM",               icon: "🩺", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  consultorio_1:        { label: "CONSULTÓRIO 1",         icon: "🏥", color: "text-sky-700",    bg: "bg-sky-50 border-sky-200" },
  consultorio_2:        { label: "CONSULTÓRIO 2",         icon: "🏥", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  sala_vermelha:        { label: "SALA VERMELHA",         icon: "🚨", color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  observacao_adulto:    { label: "OBSERVAÇÃO ADULTO",     icon: "🛏", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  observacao_pediatrica:{ label: "OBSERVAÇÃO PEDIÁTRICA", icon: "👶", color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  farmacia:             { label: "FARMÁCIA",              icon: "💊", color: "text-pink-700",   bg: "bg-pink-50 border-pink-200" },
  laboratorio:          { label: "LABORATÓRIO",           icon: "🔬", color: "text-cyan-700",   bg: "bg-cyan-50 border-cyan-200" },
};

function getSectorInfo(sector: string, localDisplay: string) {
  return SECTOR_LABEL[sector] ?? { label: localDisplay.toUpperCase(), icon: "📢", color: "text-gray-700", bg: "bg-gray-50 border-gray-200" };
}

function playChime(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const notes = [
      { freq: 523.25, start: 0,    dur: 0.6 },
      { freq: 659.25, start: 0.15, dur: 0.6 },
      { freq: 783.99, start: 0.30, dur: 0.9 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.04);
      gain.gain.setValueAtTime(0.12, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur);
    });
  } catch {
    // AudioContext may be unavailable in some environments
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function useClockString() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function PainelTvPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [animateKey, setAnimateKey] = useState(0);
  const [error, setError] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clockStr = useClockString();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/calls/recent?limit=8");
      if (!res.ok) throw new Error("server error");
      const data: CallRecord[] = await res.json();
      setCalls(data);
      setError(false);

      if (data.length > 0) {
        const newestId = data[0].id;
        if (latestId !== null && newestId !== latestId) {
          setAnimateKey(k => k + 1);
          if (!muted) playChime(audioCtxRef);
        }
        setLatestId(newestId);
      }
    } catch {
      setError(true);
    }
  }, [latestId, muted]);

  useEffect(() => {
    fetchCalls();
    const id = setInterval(fetchCalls, 5000);
    return () => clearInterval(id);
  }, [fetchCalls]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const current = calls[0] ?? null;
  const history = calls.slice(1, 6);
  const sectorInfo = current ? getSectorInfo(current.sector, current.local_display) : null;

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col bg-white select-none overflow-hidden"
      style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-4 bg-blue-700 text-white shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">UPA 24h — Breves/PA</p>
            <p className="text-xl font-bold text-white">Painel de Chamadas</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {error && (
            <span className="text-xs font-bold text-red-300 bg-red-900/40 px-3 py-1 rounded-full animate-pulse">
              ⚠ Verificando conexão...
            </span>
          )}
          <div className="flex items-center gap-2 text-white/90 bg-white/10 px-4 py-2 rounded-xl">
            <Clock className="h-5 w-5 text-blue-200" />
            <span className="text-2xl font-mono font-bold tracking-widest">{clockStr}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMuted(m => !m)}
              title={muted ? "Ativar som" : "Silenciar"}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              {muted
                ? <VolumeX className="h-5 w-5 text-white/60" />
                : <Volume2 className="h-5 w-5 text-white" />}
            </button>
            <button
              onClick={toggleFullscreen}
              title={fullscreen ? "Sair do fullscreen" : "Fullscreen"}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              {fullscreen
                ? <Minimize2 className="h-5 w-5 text-white" />
                : <Maximize2 className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Area ── */}
      <main className="flex-1 flex gap-0 overflow-hidden">

        {/* ── Current Call ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 py-10 bg-gradient-to-br from-blue-50 to-white">
          {current && sectorInfo ? (
            <div key={animateKey} className="w-full max-w-2xl animate-[fadeIn_0.4s_ease-out]">
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-bold px-4 py-1.5 rounded-full border border-blue-200 uppercase tracking-widest">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                  Chamada Atual
                </span>
              </div>

              {/* Patient Name */}
              <div className="bg-white rounded-3xl shadow-xl border-2 border-blue-100 px-10 py-10 text-center mb-6">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Paciente</p>
                <p
                  className="font-extrabold text-gray-800 leading-tight mb-2"
                  style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
                >
                  {current.patient_name.toUpperCase()}
                </p>
                <div className="h-1 w-24 bg-blue-400 rounded-full mx-auto mt-4" />
              </div>

              {/* Destination */}
              <div className={cn(
                "rounded-3xl border-2 px-10 py-8 text-center shadow-lg",
                sectorInfo.bg,
              )}>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Dirija-se a</p>
                <p
                  className={cn("font-extrabold leading-tight mb-3", sectorInfo.color)}
                  style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
                >
                  <span className="mr-3">{sectorInfo.icon}</span>
                  {current.local_display || sectorInfo.label}
                </p>
                {current.staff_name && (
                  <p className="text-base text-gray-500 font-medium mt-2">
                    Profissional: <span className="font-bold text-gray-700">{current.staff_name}</span>
                  </p>
                )}
              </div>

              <p className="text-center text-xs text-gray-400 mt-6 font-medium">
                Chamado às {formatTime(current.called_at)}
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="h-24 w-24 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center mx-auto">
                <Monitor className="h-10 w-10 text-blue-200" />
              </div>
              <p className="text-xl font-bold text-gray-300">Aguardando chamadas...</p>
              <p className="text-sm text-gray-300">O painel atualizará automaticamente</p>
            </div>
          )}
        </div>

        {/* ── History Sidebar ── */}
        <aside className="w-80 flex flex-col bg-gray-50 border-l border-gray-200 shrink-0">
          <div className="px-5 py-4 border-b border-gray-200 bg-white">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chamadas Anteriores</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {history.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-gray-300">Nenhuma chamada anterior</p>
              </div>
            ) : (
              history.map((call, idx) => {
                const si = getSectorInfo(call.sector, call.local_display);
                return (
                  <div
                    key={call.id}
                    className={cn(
                      "px-5 py-4 transition-opacity",
                      idx === 0 ? "opacity-80" : idx === 1 ? "opacity-60" : "opacity-40",
                    )}
                  >
                    <p className="text-xs text-gray-400 font-mono mb-1">{formatTime(call.called_at)}</p>
                    <p className="text-sm font-bold text-gray-700 leading-tight">{call.patient_name}</p>
                    <p className={cn("text-xs font-semibold mt-0.5", si.color)}>
                      {si.icon} {call.local_display || si.label}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-5 py-4 border-t border-gray-200 bg-white">
            <p className="text-[10px] text-gray-300 text-center">
              Atualização automática a cada 5s
            </p>
          </div>
        </aside>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

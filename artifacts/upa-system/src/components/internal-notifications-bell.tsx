import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, CheckCheck, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

function getStaffId() {
  try { return String((JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { id?: number })?.id ?? 0); }
  catch { return "0"; }
}
function getStaffName() {
  try { return (JSON.parse(localStorage.getItem("upa_auth_user") ?? "null") as { name?: string })?.name ?? ""; }
  catch { return ""; }
}

interface Notif {
  id: number; senderName: string; patientName: string; type: string;
  title: string; message: string; readAt: string | null; createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  exame_resultado: "text-blue-400",
  interconsulta: "text-cyan-400",
  alerta_critico: "text-red-400",
  observacao: "text-muted-foreground",
  sistema: "text-purple-400",
};

export function InternalNotificationsBell() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState({ title: "", message: "", type: "observacao" });
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/internal-notifications", { headers: { "x-staff-id": getStaffId() } });
      if (r.ok) setNotifs(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifs.filter(n => !n.readAt).length;

  const markRead = async (id: number) => {
    await fetch(`/api/internal-notifications/${id}/read`, {
      method: "PATCH", headers: { "x-staff-id": getStaffId(), "Content-Type": "application/json" },
    });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifs.filter(n => !n.readAt).map(n => n.id);
    await Promise.all(unreadIds.map(id => markRead(id)));
  };

  const handleSend = async () => {
    if (!msg.title.trim() || !msg.message.trim()) return;
    setSending(true);
    try {
      await fetch("/api/internal-notifications", {
        method: "POST",
        headers: { "x-staff-id": getStaffId(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...msg, senderName: getStaffName() }),
      });
      setMsg({ title: "", message: "", type: "observacao" });
      setShowSend(false);
      await load();
    } catch { /* ignore */ } finally { setSending(false); }
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => setOpen(v => !v)}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white border-0 min-w-0">
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 w-80 z-50 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold">Notificações</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1"
                onClick={() => setShowSend(v => !v)}>
                <Send className="h-3 w-3" /> Enviar
              </Button>
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3" /> Ler todas
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Send form */}
          {showSend && (
            <div className="border-b border-border bg-muted/10 p-3 space-y-2">
              <input
                className="w-full text-xs h-7 px-2 bg-background border border-border rounded"
                placeholder="Título da notificação..."
                value={msg.title} onChange={e => setMsg(m => ({ ...m, title: e.target.value }))} />
              <textarea
                className="w-full text-xs px-2 py-1 bg-background border border-border rounded min-h-[60px] resize-none"
                placeholder="Mensagem para toda a equipe..."
                value={msg.message} onChange={e => setMsg(m => ({ ...m, message: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowSend(false)}>Cancelar</Button>
                <Button size="sm" className="h-6 text-[10px] px-2" onClick={handleSend} disabled={sending}>
                  {sending ? "..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma notificação.</p>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "px-3 py-2.5 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors",
                    !n.readAt && "bg-muted/20"
                  )}
                  onClick={() => { if (!n.readAt) void markRead(n.id); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.readAt && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />}
                        <span className="text-xs font-medium truncate">{n.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className={cn("h-2.5 w-2.5", TYPE_COLORS[n.type] ?? "text-muted-foreground")} />
                        <span className="text-[10px] text-muted-foreground">{n.senderName}</span>
                        {n.patientName && <span className="text-[10px] text-muted-foreground">• {n.patientName}</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(n.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useRoute } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  useGetPatient,
  useGetPatientNotifications,
  getGetPatientQueryKey,
  getGetPatientNotificationsQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generateSinanPdfBlob } from "@/lib/pdf-fill";

export default function NotificationPrintPage() {
  const [, params] = useRoute("/patients/:id/notifications/:notificationId/print");
  const patientId      = params?.id            ? parseInt(params.id, 10)            : 0;
  const notificationId = params?.notificationId ? parseInt(params.notificationId, 10) : 0;

  const { data: patient,          isLoading: loadingPatient }       = useGetPatient(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientQueryKey(patientId) },
  });
  const { data: allNotifications, isLoading: loadingNotifications } = useGetPatientNotifications(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientNotificationsQueryKey(patientId) },
  });

  const [blobUrl,  setBlobUrl]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const prevUrl = useRef<string | null>(null);

  const notif = allNotifications?.find(n => n.id === notificationId) ?? null;

  useEffect(() => {
    if (!patient || !notif) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    generateSinanPdfBlob(patient, notif, import.meta.env.BASE_URL)
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        prevUrl.current = url;
      })
      .catch(e => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patient?.id, notif?.id, notif?.formData, notif?.disease]);

  useEffect(() => {
    return () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current); };
  }, []);

  const filename = patient
    ? `SINAN_${patient.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`
    : "SINAN.pdf";

  const handlePrint = () => {
    if (!blobUrl) return;
    const win = window.open(blobUrl, "_blank");
    if (win) {
      win.addEventListener("load", () => win.print(), { once: true });
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = Object.assign(document.createElement("a"), { href: blobUrl, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isLoadingData = loadingPatient || loadingNotifications;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#111" }}>

      {/* ── toolbar (hidden in print) ─────────────────────────────────────────── */}
      <div className="noprint" style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "8px 16px", background: "#1a1a1a", borderBottom: "1px solid #333", flexShrink: 0,
      }}>
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        {blobUrl && (
          <>
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button size="sm" variant="outline"
              className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              onClick={handleDownload}>
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </>
        )}

        {patient && notif && (
          <span style={{ fontSize: "12px", color: "#aaa", marginLeft: "8px" }}>
            {notif.disease ?? "Notificação SINAN"}
            {" · "}
            {patient.full_name}
          </span>
        )}

        {loading && (
          <span style={{ fontSize: "12px", color: "#aaa", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
            Gerando PDF…
          </span>
        )}
      </div>

      {/* ── content area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>

        {isLoadingData && (
          <div style={{ width: "100%", maxWidth: 600, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!isLoadingData && (!patient || !notif) && (
          <p style={{ color: "#888", fontSize: 14 }}>Notificação não encontrada.</p>
        )}

        {!isLoadingData && error && (
          <div style={{ color: "#f87171", fontSize: 13, maxWidth: 480, textAlign: "center", padding: 32 }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Erro ao gerar o PDF</p>
            <p style={{ color: "#888" }}>{error}</p>
          </div>
        )}

        {!isLoadingData && loading && !blobUrl && (
          <div style={{ color: "#aaa", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
            Gerando PDF SINAN preenchido…
          </div>
        )}

        {blobUrl && (
          <embed
            src={blobUrl}
            type="application/pdf"
            style={{ width: "100%", height: "100%", border: "none" }}
            title="SINAN PDF"
          />
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .noprint { display: none !important; }
        }
      `}</style>
    </div>
  );
}

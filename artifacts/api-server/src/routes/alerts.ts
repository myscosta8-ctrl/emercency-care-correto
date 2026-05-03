import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Request } from "express";

const router = Router();

type AlertReason = "triage_red" | "spo2_baixo" | "fc_alta" | "pas_baixa" | "multiplos";

interface CriticalAlert {
  patientId: number;
  full_name: string;
  triage_level: string;
  sector: string;
  bed: string | null;
  diagnosis: string | null;
  alertReason: AlertReason;
  alertDetail: string;
  triggeredAt: string;
  spo2: number | null;
  hr: number | null;
  bpSystolic: number | null;
}

/**
 * GET /api/alerts/critical
 * Returns all patients in a critical state based on:
 *   - triage_level = 'red'
 *   - SpO2 < 90
 *   - HR > 130
 *   - Systolic BP < 90
 *
 * Uses a LATERAL join to efficiently fetch each patient's latest vitals
 * in a single query (no N+1).
 */
router.get("/critical", async (req: Request, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id                 AS "patientId",
        p.full_name          AS "full_name",
        p.triage_level       AS "triage_level",
        p.sector             AS "sector",
        p.bed                AS "bed",
        p.diagnosis          AS "diagnosis",
        v.spo2               AS "spo2",
        v.hr                 AS "hr",
        v.bp                 AS "bp",
        v.created_at         AS "vitalAt"
      FROM patients p
      LEFT JOIN LATERAL (
        SELECT spo2, hr, bp, created_at
        FROM vitals
        WHERE patient_id = p.id
        ORDER BY created_at DESC
        LIMIT 1
      ) v ON true
      WHERE
        p.triage_level = 'red'
        OR (v.spo2 IS NOT NULL AND v.spo2 > 0 AND v.spo2 < 90)
        OR (v.hr   IS NOT NULL AND v.hr   > 0 AND v.hr   > 130)
        OR (
          v.bp IS NOT NULL
          AND v.bp != ''
          AND v.bp LIKE '%/%'
          AND SPLIT_PART(v.bp, '/', 1) ~ '^[0-9]+$'
          AND SPLIT_PART(v.bp, '/', 1)::integer > 0
          AND SPLIT_PART(v.bp, '/', 1)::integer < 90
        )
      ORDER BY p.triage_level = 'red' DESC, p.id
    `);

    const now = new Date().toISOString();
    const criticals: CriticalAlert[] = [];

    for (const row of rows.rows) {
      const reasons: AlertReason[] = [];
      const details: string[] = [];

      const triage  = row["triage_level"] as string;
      const spo2    = row["spo2"]  as number | null;
      const hr      = row["hr"]    as number | null;
      const bp      = row["bp"]    as string | null;

      // Parse systolic BP
      let bpSystolic: number | null = null;
      if (bp && bp.includes("/")) {
        const sys = parseInt(bp.split("/")[0] ?? "", 10);
        if (!isNaN(sys) && sys > 0) bpSystolic = sys;
      }

      if (triage === "red") {
        reasons.push("triage_red");
        details.push("Triagem Vermelha");
      }
      if (spo2 !== null && spo2 > 0 && spo2 < 90) {
        reasons.push("spo2_baixo");
        details.push(`SpO₂ ${spo2}%`);
      }
      if (hr !== null && hr > 0 && hr > 130) {
        reasons.push("fc_alta");
        details.push(`FC ${hr} bpm`);
      }
      if (bpSystolic !== null && bpSystolic > 0 && bpSystolic < 90) {
        reasons.push("pas_baixa");
        details.push(`PAS ${bpSystolic} mmHg`);
      }

      if (reasons.length === 0) continue;

      const alertReason: AlertReason =
        reasons.length > 1 ? "multiplos" : reasons[0]!;

      criticals.push({
        patientId:   row["patientId"] as number,
        full_name:   row["full_name"] as string,
        triage_level: triage,
        sector:      row["sector"] as string,
        bed:         (row["bed"] as string | null) || null,
        diagnosis:   (row["diagnosis"] as string | null) || null,
        alertReason,
        alertDetail: details.join(" · "),
        triggeredAt: now,
        spo2:        spo2 && spo2 > 0 ? spo2 : null,
        hr:          hr   && hr   > 0 ? hr   : null,
        bpSystolic,
      });
    }

    res.json(criticals);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch critical alerts");
    res.status(500).json({ error: "Erro ao buscar alertas críticos" });
  }
});

/**
 * POST /api/alerts/log
 * Records a critical-alert event to the audit_log table.
 * Called by the frontend when new critical patients are first detected.
 */
router.post("/log", async (req: Request, res) => {
  const { usuario, detalhes } = req.body as { usuario?: string; detalhes?: string };

  if (!usuario || !detalhes) {
    res.status(400).json({ error: "usuario e detalhes são obrigatórios" });
    return;
  }

  const staffId = req.staff?.id ?? null;
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    null;

  const [row] = await db
    .insert(auditLogTable)
    .values({
      staffId,
      usuario,
      acao: "alerta_critico_disparado",
      detalhes,
      ip,
    })
    .returning();

  res.status(201).json({ id: row?.id });
});

export default router;

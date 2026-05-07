import { Router } from "express";
import { pool } from "@workspace/db";
import type { Request } from "express";

const router = Router();

/**
 * GET /api/calls/recent
 * Public — no auth required. Used by the TV panel (/painel-tv) to display recent patient calls.
 */
router.get("/recent", async (req: Request, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const result = await pool.query<{
      id: number;
      patient_id: number;
      patient_name: string;
      staff_name: string;
      sector: string;
      local_display: string;
      called_at: string;
    }>(
      `SELECT id, patient_id, patient_name, staff_name, sector, local_display, called_at
       FROM patient_calls
       ORDER BY called_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar chamadas recentes" });
  }
});

/**
 * POST /api/calls
 * Records a patient call to display on the TV panel.
 * Requires auth (staff must be identified).
 */
router.post("/", async (req: Request, res) => {
  try {
    const { patientId, patientName, staffName, sector, localDisplay } = req.body as {
      patientId: number;
      patientName: string;
      staffName?: string;
      sector: string;
      localDisplay: string;
    };

    if (!patientId || !patientName || !sector || !localDisplay) {
      res.status(400).json({ error: "Campos obrigatórios: patientId, patientName, sector, localDisplay" });
      return;
    }

    const staffId = req.staff?.id ?? null;

    const result = await pool.query(
      `INSERT INTO patient_calls (patient_id, patient_name, staff_id, staff_name, sector, local_display)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, patient_id, patient_name, staff_name, sector, local_display, called_at`,
      [patientId, patientName, staffId, staffName ?? "", sector, localDisplay]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao registrar chamada" });
  }
});

export default router;

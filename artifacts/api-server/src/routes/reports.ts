import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermissao } from "../middleware/require-auth";

const router = Router();
const guard = requirePermissao("visualizar_relatorios");

// GET /api/reports/producao — atendimentos por profissional e cargo
router.get("/producao", guard, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      s.name AS profissional,
      s.role AS cargo,
      COUNT(e.id) AS total_evolucoes,
      COUNT(CASE WHEN e.professional_category = 'medico' THEN 1 END) AS evolucoes_medicas,
      COUNT(CASE WHEN e.professional_category != 'medico' THEN 1 END) AS evolucoes_enfermagem
    FROM patient_evolutions e
    JOIN staff s ON s.id = e.user_id
    WHERE e.invalidado = false
    GROUP BY s.id, s.name, s.role
    ORDER BY total_evolucoes DESC
  `);
  res.json(rows);
});

// GET /api/reports/epidemiologico — perfil de diagnósticos e triagem
router.get("/epidemiologico", guard, async (_req, res) => {
  const { rows: triage } = await pool.query(`
    SELECT triage_level, COUNT(*) AS total
    FROM patients GROUP BY triage_level ORDER BY total DESC
  `);
  const { rows: status } = await pool.query(`
    SELECT care_status, COUNT(*) AS total
    FROM patients GROUP BY care_status ORDER BY total DESC
  `);
  const { rows: sector } = await pool.query(`
    SELECT sector, COUNT(*) AS total
    FROM patients WHERE care_status != 'Alta'
    GROUP BY sector ORDER BY total DESC
  `);
  const { rows: diag } = await pool.query(`
    SELECT diagnosis, COUNT(*) AS total
    FROM patients WHERE diagnosis != ''
    GROUP BY diagnosis ORDER BY total DESC LIMIT 20
  `);
  res.json({ triage, status, sector, topDiagnosticos: diag });
});

// GET /api/reports/ocupacao — ocupação por setor com tempos
router.get("/ocupacao", guard, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      sector,
      COUNT(*) AS total_pacientes,
      COUNT(CASE WHEN internment_status = 'internado' THEN 1 END) AS internados,
      AVG(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::numeric(10,1) AS tempo_medio_horas
    FROM patients
    WHERE care_status NOT IN ('Alta')
    GROUP BY sector ORDER BY total_pacientes DESC
  `);
  res.json(rows);
});

// GET /api/reports/atendimentos — resumo mensal
router.get("/atendimentos", guard, async (req, res) => {
  const mes = String(req.query["mes"] ?? "");
  const filter = mes ? `AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', '${mes}'::date)` : "";
  const { rows } = await pool.query(`
    SELECT
      DATE(created_at) AS dia,
      COUNT(*) AS total,
      COUNT(CASE WHEN triage_level = 'red' THEN 1 END) AS vermelho,
      COUNT(CASE WHEN triage_level = 'orange' THEN 1 END) AS laranja,
      COUNT(CASE WHEN triage_level = 'yellow' THEN 1 END) AS amarelo,
      COUNT(CASE WHEN triage_level = 'green' THEN 1 END) AS verde,
      COUNT(CASE WHEN triage_level = 'blue' THEN 1 END) AS azul,
      COUNT(CASE WHEN care_status = 'Alta' THEN 1 END) AS altas
    FROM patients
    WHERE 1=1 ${filter}
    GROUP BY dia ORDER BY dia DESC LIMIT 31
  `);
  res.json(rows);
});

export default router;

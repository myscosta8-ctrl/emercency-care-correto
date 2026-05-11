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
  const mesRaw = String(req.query["mes"] ?? "");
  // Validate format YYYY-MM to prevent injection
  const mes = /^\d{4}-\d{2}$/.test(mesRaw) ? mesRaw : "";
  if (mes) {
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
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $1::date)
      GROUP BY dia ORDER BY dia DESC LIMIT 31
    `, [mes + "-01"]);
    res.json(rows);
  } else {
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
      GROUP BY dia ORDER BY dia DESC LIMIT 31
    `);
    res.json(rows);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function periodFilter(tableAlias: string, periodo: string): string {
  const col = `${tableAlias}.created_at`;
  if (periodo === "hoje")   return `AND DATE(${col}) = CURRENT_DATE`;
  if (periodo === "semana") return `AND ${col} >= CURRENT_DATE - INTERVAL '7 days'`;
  if (periodo === "ano")    return `AND DATE_TRUNC('year',  ${col}) = DATE_TRUNC('year',  CURRENT_DATE)`;
  // default: mês corrente
  return `AND DATE_TRUNC('month', ${col}) = DATE_TRUNC('month', CURRENT_DATE)`;
}

// GET /api/reports/totais — contagens rápidas hoje / semana / mês / ano
router.get("/totais", guard, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)                                             AS hoje,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')                              AS semana,
      COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE))         AS mes,
      COUNT(*) FILTER (WHERE DATE_TRUNC('year',  created_at) = DATE_TRUNC('year',  CURRENT_DATE))         AS ano
    FROM patients
  `);
  const { rows: altas } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE DATE(care_status_changed_at) = CURRENT_DATE                                             AND care_status = 'Alta') AS hoje,
      COUNT(*) FILTER (WHERE care_status_changed_at >= CURRENT_DATE - INTERVAL '7 days'                              AND care_status = 'Alta') AS semana,
      COUNT(*) FILTER (WHERE DATE_TRUNC('month', care_status_changed_at) = DATE_TRUNC('month', CURRENT_DATE)         AND care_status = 'Alta') AS mes,
      COUNT(*) FILTER (WHERE DATE_TRUNC('year',  care_status_changed_at) = DATE_TRUNC('year',  CURRENT_DATE)         AND care_status = 'Alta') AS ano
    FROM patients
  `);
  const { rows: tr } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE DATE(t.created_at) = CURRENT_DATE)                                           AS hoje,
      COUNT(*) FILTER (WHERE t.created_at >= CURRENT_DATE - INTERVAL '7 days')                            AS semana,
      COUNT(*) FILTER (WHERE DATE_TRUNC('month', t.created_at) = DATE_TRUNC('month', CURRENT_DATE))       AS mes,
      COUNT(*) FILTER (WHERE DATE_TRUNC('year',  t.created_at) = DATE_TRUNC('year',  CURRENT_DATE))       AS ano
    FROM transfers t
  `);
  res.json({ atendimentos: rows[0], altas: altas[0], transferencias: tr[0] });
});

// GET /api/reports/triagem?periodo=hoje|semana|mes|ano — classificações de triagem por período
router.get("/triagem", guard, async (req, res) => {
  const periodo = String(req.query["periodo"] ?? "mes");
  const df = periodFilter("p", periodo);

  const { rows: byLevel } = await pool.query(`
    SELECT
      triage_level,
      COUNT(*) AS total
    FROM patients p
    WHERE triage_level IS NOT NULL ${df}
    GROUP BY triage_level
    ORDER BY CASE triage_level
      WHEN 'red' THEN 1 WHEN 'orange' THEN 2 WHEN 'yellow' THEN 3 WHEN 'green' THEN 4 WHEN 'blue' THEN 5 ELSE 6 END
  `);

  const { rows: byDay } = await pool.query(`
    SELECT
      DATE(p.created_at) AS dia,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE triage_level = 'red')    AS vermelho,
      COUNT(*) FILTER (WHERE triage_level = 'orange') AS laranja,
      COUNT(*) FILTER (WHERE triage_level = 'yellow') AS amarelo,
      COUNT(*) FILTER (WHERE triage_level = 'green')  AS verde,
      COUNT(*) FILTER (WHERE triage_level = 'blue')   AS azul
    FROM patients p
    WHERE 1=1 ${df}
    GROUP BY dia ORDER BY dia DESC LIMIT 60
  `);

  res.json({ byLevel, byDay });
});

// GET /api/reports/exames?periodo=hoje|semana|mes|ano — exames realizados (lab/imagem) por período
router.get("/exames", guard, async (req, res) => {
  const periodo = String(req.query["periodo"] ?? "mes");
  const df = periodFilter("e", periodo);

  const { rows: byType } = await pool.query(`
    SELECT exam_type, COUNT(*) AS total
    FROM exam_results e
    WHERE 1=1 ${df}
    GROUP BY exam_type ORDER BY total DESC
  `);

  const { rows: byDay } = await pool.query(`
    SELECT
      DATE(e.created_at) AS dia,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE exam_type = 'laboratorial') AS laboratorial,
      COUNT(*) FILTER (WHERE exam_type = 'imagem')       AS imagem
    FROM exam_results e
    WHERE 1=1 ${df}
    GROUP BY dia ORDER BY dia DESC LIMIT 60
  `);

  const { rows: total } = await pool.query(`
    SELECT COUNT(*) AS total FROM exam_results e WHERE 1=1 ${df}
  `);

  res.json({ byType, byDay, total: total[0]?.total ?? "0" });
});

// GET /api/reports/transferencias?periodo=hoje|semana|mes|ano — encaminhamentos por período
router.get("/transferencias", guard, async (req, res) => {
  const periodo = String(req.query["periodo"] ?? "mes");
  const df = periodFilter("t", periodo);

  const { rows: byHospital } = await pool.query(`
    SELECT destination_hospital AS hospital, COUNT(*) AS total
    FROM transfers t
    WHERE 1=1 ${df}
    GROUP BY destination_hospital ORDER BY total DESC
  `);

  const { rows: byDay } = await pool.query(`
    SELECT DATE(t.created_at) AS dia, COUNT(*) AS total
    FROM transfers t
    WHERE 1=1 ${df}
    GROUP BY dia ORDER BY dia DESC LIMIT 60
  `);

  const { rows: totalRow } = await pool.query(`
    SELECT COUNT(*) AS total FROM transfers t WHERE 1=1 ${df}
  `);

  res.json({ byHospital, byDay, total: totalRow[0]?.total ?? "0" });
});

export default router;

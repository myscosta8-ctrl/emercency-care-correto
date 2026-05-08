import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermissao } from "../middleware/require-auth";

const router = Router();
const guard = requirePermissao("visualizar_relatorios");

// Pacientes em internação prolongada não entram nos cálculos de tempo de fluxo
const LONG_STAY_STATUSES = `('Internado', 'Em Observação', 'Em Transferência')`;

// GET /api/tempos-metas — métricas de tempo de espera e metas
router.get("/", guard, async (_req, res) => {
  // Tempo médio por etapa — somente pacientes que completaram o ciclo completo
  // (recepção → triagem → consultório → alta) excluindo internações prolongadas
  const { rows: tempos } = await pool.query(`
    SELECT
      triage_level,
      COUNT(*) AS total,
      AVG(CASE WHEN hora_triagem IS NOT NULL AND hora_recepcao IS NOT NULL
        THEN EXTRACT(EPOCH FROM (hora_triagem - hora_recepcao)) / 60 END
      )::numeric(10,1) AS media_espera_triagem_min,
      AVG(CASE WHEN hora_atendimento_medico IS NOT NULL AND hora_triagem IS NOT NULL
        THEN EXTRACT(EPOCH FROM (hora_atendimento_medico - hora_triagem)) / 60 END
      )::numeric(10,1) AS media_espera_medico_min,
      AVG(CASE WHEN hora_alta IS NOT NULL
        THEN EXTRACT(EPOCH FROM (hora_alta - created_at)) / 60 END
      )::numeric(10,1) AS media_permanencia_min
    FROM patients
    WHERE created_at >= now() - interval '30 days'
      AND hora_recepcao IS NOT NULL
      AND hora_triagem IS NOT NULL
      AND hora_atendimento_medico IS NOT NULL
      AND care_status NOT IN ${LONG_STAY_STATUSES}
    GROUP BY triage_level
    ORDER BY triage_level
  `);

  // Fluxo atual — exclui pacientes em internação prolongada (não são fluxo de UPA)
  const { rows: fluxo } = await pool.query(`
    SELECT care_status, COUNT(*) AS total
    FROM patients
    WHERE care_status != 'Alta'
      AND care_status NOT IN ${LONG_STAY_STATUSES}
    GROUP BY care_status ORDER BY total DESC
  `);

  // Conformidade com metas (Portaria MS 10/2017) — apenas visitas completas e não-internadas
  const { rows: conformidade } = await pool.query(`
    SELECT
      triage_level,
      COUNT(*) AS total,
      COUNT(CASE
        WHEN triage_level = 'red'    AND EXTRACT(EPOCH FROM (hora_atendimento_medico - COALESCE(hora_triagem, created_at)))/60 <= 0   THEN 1
        WHEN triage_level = 'orange' AND EXTRACT(EPOCH FROM (hora_atendimento_medico - COALESCE(hora_triagem, created_at)))/60 <= 10  THEN 1
        WHEN triage_level = 'yellow' AND EXTRACT(EPOCH FROM (hora_atendimento_medico - COALESCE(hora_triagem, created_at)))/60 <= 60  THEN 1
        WHEN triage_level = 'green'  AND EXTRACT(EPOCH FROM (hora_atendimento_medico - COALESCE(hora_triagem, created_at)))/60 <= 120 THEN 1
        WHEN triage_level = 'blue'   AND EXTRACT(EPOCH FROM (hora_atendimento_medico - COALESCE(hora_triagem, created_at)))/60 <= 240 THEN 1
      END) AS dentro_da_meta
    FROM patients
    WHERE hora_atendimento_medico IS NOT NULL
      AND hora_triagem IS NOT NULL
      AND hora_recepcao IS NOT NULL
      AND created_at >= now() - interval '30 days'
      AND care_status NOT IN ${LONG_STAY_STATUSES}
    GROUP BY triage_level
  `);

  // Totais do dia
  const { rows: hoje } = await pool.query(`
    SELECT
      COUNT(*) AS admissoes_hoje,
      COUNT(CASE WHEN care_status = 'Alta' THEN 1 END) AS altas_hoje,
      COUNT(CASE WHEN care_status != 'Alta' THEN 1 END) AS ativos
    FROM patients
    WHERE DATE(created_at) = CURRENT_DATE
  `);

  res.json({ tempos, fluxo, conformidade, hoje: hoje[0] });
});

export default router;

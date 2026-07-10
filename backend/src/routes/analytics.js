import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/painel", async (req, res, next) => {
  try {
    const { de, ate } = req.query;
    if (!de || !ate) return res.status(400).json({ error: "Informe o período (de/ate)." });

    const byDayQ = pool.query(
      `SELECT data_atendimento AS data, count(*)::int AS total
       FROM atendimentos
       WHERE data_atendimento BETWEEN $1 AND $2
       GROUP BY data_atendimento ORDER BY data_atendimento`,
      [de, ate]
    );

    const byFocoQ = pool.query(
      `SELECT f.nome AS name, count(*)::int AS value
       FROM atendimento_focos af
       JOIN atendimentos a ON a.id = af.atendimento_id
       JOIN focos_infeccao_catalogo f ON f.id = af.foco_id
       WHERE a.data_atendimento BETWEEN $1 AND $2
       GROUP BY f.nome ORDER BY value DESC`,
      [de, ate]
    );

    const byAtbQ = pool.query(
      `SELECT ab.nome AS name, count(*)::int AS total
       FROM atendimento_antibioticos aa
       JOIN atendimentos a ON a.id = aa.atendimento_id
       JOIN antibioticos_catalogo ab ON ab.id = aa.antibiotico_id
       WHERE a.data_atendimento BETWEEN $1 AND $2
       GROUP BY ab.nome ORDER BY total DESC LIMIT 8`,
      [de, ate]
    );

    const summaryQ = pool.query(
      `SELECT count(*)::int AS periodo_count,
              COALESCE(avg(total_criterios), 0) AS avg_criteria
       FROM vw_atendimentos_resumo
       WHERE data_atendimento BETWEEN $1 AND $2`,
      [de, ate]
    );

    const [byDay, byFoco, byAtb, summary] = await Promise.all([byDayQ, byFocoQ, byAtbQ, summaryQ]);

    res.json({
      periodoCount: summary.rows[0].periodo_count,
      avgCriteria: Number(summary.rows[0].avg_criteria).toFixed(1),
      focosDistintos: byFoco.rows.length,
      byDay: byDay.rows.map((r) => ({
        data: r.data.split("-").reverse().join("/"),
        total: r.total,
      })),
      byFoco: byFoco.rows,
      byAtb: byAtb.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

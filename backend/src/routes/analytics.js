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

    // KPI porta-antibiotico no periodo (meta institucional: <= 60 min)
    const kpiQ = pool.query(
      `SELECT count(*) FILTER (WHERE porta_atb_min IS NOT NULL)::int              AS com_atb,
              count(*) FILTER (WHERE porta_atb_min <= 60)::int                    AS dentro_meta,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY porta_atb_min)          AS mediana_min
       FROM vw_atendimentos_resumo
       WHERE data_atendimento BETWEEN $1 AND $2 AND porta_atb_min IS NOT NULL`,
      [de, ate]
    );

    // Tendencia mensal (ultimos 6 meses, independente do filtro de periodo)
    const byMonthQ = pool.query(
      `SELECT to_char(date_trunc('month', data_atendimento), 'YYYY-MM')           AS mes,
              count(*)::int                                                       AS total,
              count(*) FILTER (WHERE porta_atb_min IS NOT NULL)::int              AS com_atb,
              count(*) FILTER (WHERE porta_atb_min <= 60)::int                    AS dentro_meta
       FROM vw_atendimentos_resumo
       WHERE data_atendimento >= date_trunc('month', now()) - interval '5 months'
       GROUP BY 1 ORDER BY 1`
    );

    // Distribuicao por classificacao no periodo
    const byClassifQ = pool.query(
      `SELECT COALESCE(classificacao, 'nao_classificado') AS name, count(*)::int AS value
       FROM vw_atendimentos_resumo
       WHERE data_atendimento BETWEEN $1 AND $2
       GROUP BY 1 ORDER BY value DESC`,
      [de, ate]
    );

    // Status dos casos no periodo (fila de acompanhamento)
    const statusQ = pool.query(
      `SELECT status AS name, count(*)::int AS value
       FROM vw_atendimentos_resumo
       WHERE data_atendimento BETWEEN $1 AND $2
       GROUP BY 1`,
      [de, ate]
    );

    // Desfechos: classificacao final e destino dos casos encerrados no periodo
    const byClassifFinalQ = pool.query(
      `SELECT classificacao_final AS name, count(*)::int AS value
       FROM vw_atendimentos_resumo
       WHERE data_atendimento BETWEEN $1 AND $2 AND classificacao_final IS NOT NULL
       GROUP BY 1 ORDER BY value DESC`,
      [de, ate]
    );
    const byDestinoQ = pool.query(
      `SELECT destino AS name, count(*)::int AS value
       FROM vw_atendimentos_resumo
       WHERE data_atendimento BETWEEN $1 AND $2 AND destino IS NOT NULL
       GROUP BY 1 ORDER BY value DESC`,
      [de, ate]
    );

    const [byDay, byFoco, byAtb, summary, kpi, byMonth, byClassif, byStatus, byClassifFinal, byDestino] = await Promise.all([
      byDayQ, byFocoQ, byAtbQ, summaryQ, kpiQ, byMonthQ, byClassifQ, statusQ, byClassifFinalQ, byDestinoQ,
    ]);

    const encerrados = byClassifFinal.rows.reduce((s, r) => s + r.value, 0);
    const confirmados = byClassifFinal.rows
      .filter((r) => r.name === "sepse_confirmada" || r.name === "choque_septico")
      .reduce((s, r) => s + r.value, 0);
    const obitos = byDestino.rows.find((r) => r.name === "obito")?.value ?? 0;

    const k = kpi.rows[0];
    res.json({
      periodoCount: summary.rows[0].periodo_count,
      avgCriteria: Number(summary.rows[0].avg_criteria).toFixed(1),
      focosDistintos: byFoco.rows.length,
      kpi: {
        comAtb: k.com_atb,
        dentroMeta: k.dentro_meta,
        pctDentroMeta: k.com_atb ? Math.round((100 * k.dentro_meta) / k.com_atb) : null,
        medianaMin: k.mediana_min == null ? null : Math.round(Number(k.mediana_min)),
      },
      byMonth: byMonth.rows.map((r) => ({
        mes: r.mes,
        total: r.total,
        pctMeta: r.com_atb ? Math.round((100 * r.dentro_meta) / r.com_atb) : null,
      })),
      byClassif: byClassif.rows,
      byStatus: byStatus.rows,
      desfechos: {
        encerrados,
        taxaConfirmacao: encerrados ? Math.round((100 * confirmados) / encerrados) : null,
        mortalidade: encerrados ? Math.round((100 * obitos) / encerrados) : null,
        byClassifFinal: byClassifFinal.rows,
        byDestino: byDestino.rows,
      },
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

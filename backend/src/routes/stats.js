import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM atendimentos WHERE data_atendimento = current_date) AS today_count,
        (SELECT count(*)::int FROM atendimentos WHERE date_trunc('month', data_atendimento) = date_trunc('month', current_date)) AS month_count,
        (SELECT count(*)::int FROM atendimentos) AS total_fichas,
        (SELECT count(*)::int FROM medicos WHERE active) AS active_medicos
    `);
    const r = rows[0];
    res.json({
      todayCount: r.today_count,
      monthCount: r.month_count,
      totalFichas: r.total_fichas,
      activeMedicos: r.active_medicos,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

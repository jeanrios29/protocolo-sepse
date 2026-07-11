import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/criterios", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, label, ordem, categoria FROM sirs_criterios_catalogo ORDER BY ordem");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/focos", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, nome FROM focos_infeccao_catalogo ORDER BY nome");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/antibioticos", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, nome FROM antibioticos_catalogo ORDER BY nome");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      dataAtendimento, horaAtendimento, nomePaciente, numeroAtendimento,
      sirs = {}, focoInfeccao = [], antibioticos = [],
      horaAntibiotico = null, classificacao = null,
    } = req.body || {};

    if (!nomePaciente?.trim() || !numeroAtendimento?.trim() || !dataAtendimento || !horaAtendimento) {
      return res.status(400).json({ error: "Preencha data, hora, paciente e número do atendimento." });
    }
    if (classificacao && !["sirs", "sepse", "choque_septico"].includes(classificacao)) {
      return res.status(400).json({ error: "Classificação inválida." });
    }
    if (horaAntibiotico && !/^\d{2}:\d{2}(:\d{2})?$/.test(horaAntibiotico)) {
      return res.status(400).json({ error: "Hora de administração do antibiótico inválida." });
    }

    const criterioIds = Object.keys(sirs).filter((k) => sirs[k]);

    const atendimento = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO atendimentos (paciente_nome, numero_atendimento, data_atendimento, hora_atendimento,
                                   hora_administracao_atb, classificacao, medico_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
        [nomePaciente.trim(), numeroAtendimento.trim(), dataAtendimento, horaAtendimento,
         horaAntibiotico || null, classificacao || null, req.user.sub]
      );
      const atendimentoId = rows[0].id;

      for (const criterioId of criterioIds) {
        await client.query(
          "INSERT INTO atendimento_criterios (atendimento_id, criterio_id) VALUES ($1, $2)",
          [atendimentoId, criterioId]
        );
      }

      if (focoInfeccao.length) {
        await client.query(
          `INSERT INTO atendimento_focos (atendimento_id, foco_id)
           SELECT $1, id FROM focos_infeccao_catalogo WHERE nome = ANY($2::text[])`,
          [atendimentoId, focoInfeccao]
        );
      }

      if (antibioticos.length) {
        await client.query(
          `INSERT INTO atendimento_antibioticos (atendimento_id, antibiotico_id)
           SELECT $1, id FROM antibioticos_catalogo WHERE nome = ANY($2::text[])`,
          [atendimentoId, antibioticos]
        );
      }

      await client.query(
        `INSERT INTO audit_log (medico_id, acao, entidade, entidade_id, ip)
         VALUES ($1, 'criar_ficha', 'atendimento', $2, $3)`,
        [req.user.sub, atendimentoId, req.ip]
      );

      return { id: atendimentoId, createdAt: rows[0].created_at };
    });

    res.status(201).json(atendimento);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { nome, numero, de, ate, page = "1", perPage = "10", all } = req.query;
    const conditions = [];
    const params = [];

    if (nome) { params.push(`%${nome.toLowerCase()}%`); conditions.push(`lower(r.paciente_nome) LIKE $${params.length}`); }
    if (numero) { params.push(`%${numero.toLowerCase()}%`); conditions.push(`lower(r.numero_atendimento) LIKE $${params.length}`); }
    if (de) { params.push(de); conditions.push(`r.data_atendimento >= $${params.length}`); }
    if (ate) { params.push(ate); conditions.push(`r.data_atendimento <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT count(*)::int AS total FROM vw_atendimentos_resumo r ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    let limitClause = "";
    if (all !== "true") {
      const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10) || 10));
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const offset = (pageNum - 1) * perPageNum;
      params.push(perPageNum, offset);
      limitClause = `ORDER BY r.data_atendimento DESC, r.hora_atendimento DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    } else {
      limitClause = "ORDER BY r.data_atendimento DESC, r.hora_atendimento DESC";
    }

    const { rows } = await pool.query(
      `SELECT r.id, r.paciente_nome, r.numero_atendimento, r.data_atendimento, r.hora_atendimento,
              r.hora_administracao_atb, r.porta_atb_min, r.classificacao,
              r.medico_nome, r.medico_crm, r.total_criterios, r.created_at
       FROM vw_atendimentos_resumo r ${where} ${limitClause}`,
      params
    );

    res.json({ total, items: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/export/data", async (req, res, next) => {
  try {
    const { nome, numero, de, ate } = req.query;
    const conditions = [];
    const params = [];

    if (nome) { params.push(`%${nome.toLowerCase()}%`); conditions.push(`lower(r.paciente_nome) LIKE $${params.length}`); }
    if (numero) { params.push(`%${numero.toLowerCase()}%`); conditions.push(`lower(r.numero_atendimento) LIKE $${params.length}`); }
    if (de) { params.push(de); conditions.push(`r.data_atendimento >= $${params.length}`); }
    if (ate) { params.push(ate); conditions.push(`r.data_atendimento <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT r.data_atendimento, r.hora_atendimento, r.paciente_nome, r.numero_atendimento,
              r.hora_administracao_atb, r.porta_atb_min, r.classificacao,
              r.total_criterios, r.medico_nome, r.medico_crm, r.created_at,
              (SELECT string_agg(c.label, '; ' ORDER BY c.ordem)
                 FROM atendimento_criterios ac JOIN sirs_criterios_catalogo c ON c.id = ac.criterio_id
                 WHERE ac.atendimento_id = r.id) AS criterios_detalhe,
              (SELECT string_agg(f.nome, '; ' ORDER BY f.nome)
                 FROM atendimento_focos af JOIN focos_infeccao_catalogo f ON f.id = af.foco_id
                 WHERE af.atendimento_id = r.id) AS focos,
              (SELECT string_agg(a.nome, '; ' ORDER BY a.nome)
                 FROM atendimento_antibioticos aa JOIN antibioticos_catalogo a ON a.id = aa.antibiotico_id
                 WHERE aa.atendimento_id = r.id) AS antibioticos
       FROM vw_atendimentos_resumo r ${where}
       ORDER BY r.data_atendimento DESC, r.hora_atendimento DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM vw_atendimentos_resumo WHERE id = $1", [id]);
    if (!rows[0]) return res.status(404).json({ error: "Ficha não encontrada." });

    const [criterios, focos, antibioticos] = await Promise.all([
      pool.query(
        `SELECT c.id, c.label FROM atendimento_criterios ac
         JOIN sirs_criterios_catalogo c ON c.id = ac.criterio_id
         WHERE ac.atendimento_id = $1 ORDER BY c.ordem`,
        [id]
      ),
      pool.query(
        `SELECT f.nome FROM atendimento_focos af
         JOIN focos_infeccao_catalogo f ON f.id = af.foco_id
         WHERE af.atendimento_id = $1 ORDER BY f.nome`,
        [id]
      ),
      pool.query(
        `SELECT a.nome FROM atendimento_antibioticos aa
         JOIN antibioticos_catalogo a ON a.id = aa.antibiotico_id
         WHERE aa.atendimento_id = $1 ORDER BY a.nome`,
        [id]
      ),
    ]);

    res.json({
      ...rows[0],
      criterios: criterios.rows,
      focoInfeccao: focos.rows.map((r) => r.nome),
      antibioticos: antibioticos.rows.map((r) => r.nome),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

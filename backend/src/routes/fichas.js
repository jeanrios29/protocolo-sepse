import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

const EXPORT_MAX_ROWS = 10000;

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
      horaPrescricao = null, horaAntibiotico = null, classificacao = null,
    } = req.body || {};

    if (!nomePaciente?.trim() || !numeroAtendimento?.trim() || !dataAtendimento || !horaAtendimento) {
      return res.status(400).json({ error: "Preencha data, hora, paciente e número do atendimento." });
    }
    if (classificacao && !["sirs", "sepse", "choque_septico"].includes(classificacao)) {
      return res.status(400).json({ error: "Classificação inválida." });
    }
    for (const [nome, valor] of [["prescrição", horaPrescricao], ["administração", horaAntibiotico]]) {
      if (valor && !/^\d{2}:\d{2}(:\d{2})?$/.test(valor)) {
        return res.status(400).json({ error: `Hora de ${nome} do antibiótico inválida.` });
      }
    }

    const criterioIds = Object.keys(sirs).filter((k) => sirs[k]);

    const atendimento = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO atendimentos (paciente_nome, numero_atendimento, data_atendimento, hora_atendimento,
                                   hora_prescricao_atb, hora_administracao_atb, classificacao, medico_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
        [nomePaciente.trim(), numeroAtendimento.trim(), dataAtendimento, horaAtendimento,
         horaPrescricao || null, horaAntibiotico || null, classificacao || null, req.user.sub]
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
    const { nome, numero, de, ate, status, page = "1", perPage = "10", all } = req.query;
    const conditions = [];
    const params = [];

    if (nome) { params.push(`%${nome.toLowerCase()}%`); conditions.push(`lower(r.paciente_nome) LIKE $${params.length}`); }
    if (numero) { params.push(`%${numero.toLowerCase()}%`); conditions.push(`lower(r.numero_atendimento) LIKE $${params.length}`); }
    if (de) { params.push(de); conditions.push(`r.data_atendimento >= $${params.length}`); }
    if (ate) { params.push(ate); conditions.push(`r.data_atendimento <= $${params.length}`); }
    if (status === "aberto") {
      conditions.push(`r.status <> 'encerrado'`);
    } else if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }

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
              r.hora_prescricao_atb, r.hora_administracao_atb, r.porta_atb_min, r.classificacao,
              r.status, r.classificacao_final, r.destino, r.data_desfecho,
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
              r.hora_prescricao_atb, r.hora_administracao_atb, r.porta_atb_min, r.classificacao,
              r.status, r.classificacao_final, r.indicacao_adequada, r.foco_confirmado,
              r.culturas_colhidas, r.cultura_positiva, r.destino, r.data_desfecho,
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
       ORDER BY r.data_atendimento DESC, r.hora_atendimento DESC
       LIMIT ${EXPORT_MAX_ROWS + 1}`,
      params
    );
    // Teto de segurança: com anos de dados a exportação sem limite pode
    // sobrecarregar o servidor. Sinaliza truncamento para o cliente avisar.
    const truncated = rows.length > EXPORT_MAX_ROWS;
    res.json({ rows: truncated ? rows.slice(0, EXPORT_MAX_ROWS) : rows, truncated, max: EXPORT_MAX_ROWS });
  } catch (err) {
    next(err);
  }
});

// Lançamento posterior de dados do caso: tempos do ATB, classificação e desfecho.
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      horaPrescricao, horaAntibiotico, classificacao,
      desfecho, // { classificacaoFinal, destino, indicacaoAdequada, focoConfirmado, culturasColhidas, culturaPositiva, dataDesfecho, observacoes }
    } = req.body || {};

    for (const [nome, valor] of [["prescrição", horaPrescricao], ["administração", horaAntibiotico]]) {
      if (valor && !/^\d{2}:\d{2}(:\d{2})?$/.test(valor)) {
        return res.status(400).json({ error: `Hora de ${nome} do antibiótico inválida.` });
      }
    }
    if (classificacao && !["sirs", "sepse", "choque_septico"].includes(classificacao)) {
      return res.status(400).json({ error: "Classificação inválida." });
    }
    if (desfecho) {
      if (!["sepse_confirmada", "choque_septico", "infeccao_sem_sepse", "descartado"].includes(desfecho.classificacaoFinal)) {
        return res.status(400).json({ error: "Classificação final do desfecho inválida." });
      }
      if (!["alta", "enfermaria", "uti", "obito", "transferencia"].includes(desfecho.destino)) {
        return res.status(400).json({ error: "Destino do desfecho inválido." });
      }
    }

    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query("SELECT id FROM atendimentos WHERE id = $1 FOR UPDATE", [id]);
      if (!rows[0]) return null;

      await client.query(
        `UPDATE atendimentos SET
           hora_prescricao_atb    = COALESCE($2, hora_prescricao_atb),
           hora_administracao_atb = COALESCE($3, hora_administracao_atb),
           classificacao          = COALESCE($4, classificacao)
         WHERE id = $1`,
        [id, horaPrescricao || null, horaAntibiotico || null, classificacao || null]
      );

      if (desfecho) {
        await client.query(
          `INSERT INTO atendimento_desfechos
             (atendimento_id, classificacao_final, destino, indicacao_adequada, foco_confirmado,
              culturas_colhidas, cultura_positiva, data_desfecho, observacoes, revisado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (atendimento_id) DO UPDATE SET
             classificacao_final = EXCLUDED.classificacao_final,
             destino             = EXCLUDED.destino,
             indicacao_adequada  = EXCLUDED.indicacao_adequada,
             foco_confirmado     = EXCLUDED.foco_confirmado,
             culturas_colhidas   = EXCLUDED.culturas_colhidas,
             cultura_positiva    = EXCLUDED.cultura_positiva,
             data_desfecho       = EXCLUDED.data_desfecho,
             observacoes         = EXCLUDED.observacoes,
             revisado_por        = EXCLUDED.revisado_por,
             revisado_em         = now()`,
          [id, desfecho.classificacaoFinal, desfecho.destino,
           desfecho.indicacaoAdequada ?? null, desfecho.focoConfirmado ?? null,
           desfecho.culturasColhidas ?? null, desfecho.culturaPositiva ?? null,
           desfecho.dataDesfecho || null, desfecho.observacoes?.trim() || null, req.user.sub]
        );
      }

      await client.query(
        `INSERT INTO audit_log (medico_id, acao, entidade, entidade_id, ip)
         VALUES ($1, $2, 'atendimento', $3, $4)`,
        [req.user.sub, desfecho ? "encerrar_ficha" : "atualizar_ficha", id, req.ip]
      );
      return true;
    });

    if (!updated) return res.status(404).json({ error: "Ficha não encontrada." });
    const { rows } = await pool.query("SELECT * FROM vw_atendimentos_resumo WHERE id = $1", [id]);
    res.json(rows[0]);
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

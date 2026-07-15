import { Router } from "express";
import { pool } from "../db.js";
import { hashPassword, requireAuth, requireMaster, normalizarCrm } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", requireMaster, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT nome, crm, email, role, active, created_at FROM medicos ORDER BY created_at"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireMaster, async (req, res, next) => {
  try {
    const { nome, crm, email = "", senha } = req.body || {};
    if (!nome?.trim() || !crm?.trim() || !senha?.trim()) {
      return res.status(400).json({ error: "Preencha nome, registro (CRM ou COREN) e senha." });
    }
    // Duplicidade comparada pelos dígitos, não pelo texto: "12.345" e "12345"
    // são o mesmo registro e virariam ambiguidade no login se coexistissem.
    const digitos = normalizarCrm(crm);
    if (!digitos) {
      return res.status(400).json({ error: "O registro (CRM ou COREN) precisa conter números." });
    }
    const { rows: dup } = await pool.query(
      "SELECT 1 FROM medicos WHERE regexp_replace(crm, '\\D', '', 'g') = $1",
      [digitos]
    );
    if (dup.length) return res.status(409).json({ error: "Já existe um profissional com esse registro." });

    const hash = await hashPassword(senha);
    await pool.query(
      `INSERT INTO medicos (nome, crm, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, 'medico', true)`,
      [nome.trim(), crm.trim(), email.trim(), hash]
    );
    await pool.query(
      `INSERT INTO audit_log (medico_id, acao, entidade, entidade_id, ip)
       VALUES ($1, 'criar_medico', 'medico', $2, $3)`,
      [req.user.sub, crm.trim(), req.ip]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:crm/active", requireMaster, async (req, res, next) => {
  try {
    const { crm } = req.params;
    const { rows } = await pool.query(
      "UPDATE medicos SET active = NOT active, updated_at = now() WHERE crm = $1 AND role <> 'master' RETURNING active",
      [crm]
    );
    if (!rows[0]) return res.status(404).json({ error: "Profissional não encontrado." });
    await pool.query(
      `INSERT INTO audit_log (medico_id, acao, entidade, entidade_id, detalhes, ip)
       VALUES ($1, 'toggle_active', 'medico', $2, $3, $4)`,
      [req.user.sub, crm, JSON.stringify({ active: rows[0].active }), req.ip]
    );
    res.json({ active: rows[0].active });
  } catch (err) {
    next(err);
  }
});

router.patch("/:crm/password", requireMaster, async (req, res, next) => {
  try {
    const { crm } = req.params;
    const { novaSenha } = req.body || {};
    if (!novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ error: "A senha precisa ter ao menos 6 caracteres." });
    }
    const hash = await hashPassword(novaSenha);
    const { rows } = await pool.query(
      "UPDATE medicos SET password_hash = $1, updated_at = now() WHERE crm = $2 RETURNING crm",
      [hash, crm]
    );
    if (!rows[0]) return res.status(404).json({ error: "Profissional não encontrado." });
    await pool.query(
      `INSERT INTO audit_log (medico_id, acao, entidade, entidade_id, ip)
       VALUES ($1, 'redefinir_senha', 'medico', $2, $3)`,
      [req.user.sub, crm, req.ip]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

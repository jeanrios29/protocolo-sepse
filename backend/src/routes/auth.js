import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../db.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../auth.js";

const router = Router();

// Identidade do usuário master definida por ambiente (não versionada em código).
const MASTER_CRM = process.env.MASTER_CRM || "32.394";
const MASTER_NAME = process.env.MASTER_NAME || "Administrador";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});

// Bootstrap é público e só vale enquanto não há usuários — protege contra
// tentativas repetidas enquanto a janela de inicialização está aberta.
const bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." },
});

async function logAudit(client, { medicoId, acao, entidade, entidadeId, detalhes, ip }) {
  await client.query(
    `INSERT INTO audit_log (medico_id, acao, entidade, entidade_id, detalhes, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [medicoId || null, acao, entidade || null, entidadeId || null, detalhes ? JSON.stringify(detalhes) : null, ip || null]
  );
}

router.get("/status", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT count(*)::int AS total FROM medicos");
    res.json({ needsBootstrap: rows[0].total === 0 });
  } catch (err) {
    next(err);
  }
});

router.post("/bootstrap", bootstrapLimiter, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "A senha precisa ter ao menos 6 caracteres." });
    }
    const hash = await hashPassword(password);
    // Inserção condicional atômica: só cria o master se a tabela estiver vazia.
    // Evita a corrida (TOCTOU) entre checar count(*) e inserir — dois pedidos
    // simultâneos não conseguem criar dois masters.
    const { rows } = await pool.query(
      `INSERT INTO medicos (nome, crm, email, password_hash, role, active)
       SELECT $1, $2, '', $3, 'master', true
       WHERE NOT EXISTS (SELECT 1 FROM medicos)
       RETURNING id, nome, crm, role`,
      [MASTER_NAME, MASTER_CRM, hash]
    );
    if (!rows[0]) {
      return res.status(409).json({ error: "O sistema já foi inicializado." });
    }
    const master = rows[0];
    await logAudit(pool, { medicoId: master.id, acao: "bootstrap_master", ip: req.ip });
    const token = signToken({ id: master.id, crm: master.crm, role: master.role, nome: master.nome });
    res.json({ token, user: { name: master.nome, crm: master.crm, role: master.role } });
  } catch (err) {
    // Corrida extrema: dois pedidos passam pelo WHERE NOT EXISTS antes de
    // qualquer commit; o UNIQUE do CRM barra o segundo (23505). Responde 409
    // limpo em vez de 500 — a invariante "um único master" é mantida pelo banco.
    if (err.code === "23505") {
      return res.status(409).json({ error: "O sistema já foi inicializado." });
    }
    next(err);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { crm, senha } = req.body || {};
    if (!crm || !senha) return res.status(400).json({ error: "Informe CRM e senha." });

    const { rows } = await pool.query("SELECT * FROM medicos WHERE crm = $1", [crm.trim()]);
    const medico = rows[0];

    if (!medico) {
      await logAudit(pool, { acao: "login_falhou", detalhes: { crm, motivo: "crm_nao_encontrado" }, ip: req.ip });
      return res.status(401).json({ error: "CRM não encontrado." });
    }
    if (!medico.active) {
      await logAudit(pool, { medicoId: medico.id, acao: "login_falhou", detalhes: { motivo: "usuario_inativo" }, ip: req.ip });
      return res.status(403).json({ error: "Este usuário está desativado. Fale com o administrador." });
    }
    const ok = await verifyPassword(senha, medico.password_hash);
    if (!ok) {
      await logAudit(pool, { medicoId: medico.id, acao: "login_falhou", detalhes: { motivo: "senha_incorreta" }, ip: req.ip });
      return res.status(401).json({ error: "Senha incorreta." });
    }

    await logAudit(pool, { medicoId: medico.id, acao: "login", ip: req.ip });
    const token = signToken({ id: medico.id, crm: medico.crm, role: medico.role, nome: medico.nome });
    res.json({ token, user: { name: medico.nome, crm: medico.crm, role: medico.role } });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT nome, crm, role, active FROM medicos WHERE id = $1",
      [req.user.sub]
    );
    if (!rows[0] || !rows[0].active) return res.status(401).json({ error: "Sessão inválida." });
    res.json({ user: { name: rows[0].nome, crm: rows[0].crm, role: rows[0].role } });
  } catch (err) {
    next(err);
  }
});

export default router;

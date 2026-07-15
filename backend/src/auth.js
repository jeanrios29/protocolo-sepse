import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const BCRYPT_ROUNDS = 12;

// Normaliza um registro profissional (CRM ou COREN) para comparação tolerante
// a formatação: mantém só os dígitos. Assim "32.394", "32394", "32-394",
// "32 394" e "COREN-BA 32.394" viram "32394" e são tratados como o mesmo
// registro (evita a pegadinha do ponto/prefixo no login).
export function normalizarCrm(valor) {
  return String(valor || "").replace(/\D/g, "");
}

// Heurística simples: um identificador de login é e-mail se contém "@";
// caso contrário é tratado como registro profissional (CRM ou COREN).
export function pareceEmail(valor) {
  return String(valor || "").includes("@");
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(medico) {
  return jwt.sign(
    { sub: medico.id, crm: medico.crm, role: medico.role, nome: medico.nome },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "14h" }
  );
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }

  // Valida o token contra o estado ATUAL do usuário no banco: um token
  // continua criptograficamente válido até expirar, mas o médico pode ter
  // sido desativado ou ter tido a senha redefinida nesse meio-tempo.
  try {
    const { rows } = await pool.query(
      "SELECT active, extract(epoch FROM updated_at)::float8 AS updated_epoch FROM medicos WHERE id = $1",
      [payload.sub]
    );
    const medico = rows[0];
    if (!medico || !medico.active) {
      return res.status(401).json({ error: "Usuário desativado ou inexistente." });
    }
    // Revogação sem blocklist: qualquer alteração de credenciais/status
    // (redefinir senha, desativar/reativar) bumpa updated_at e invalida
    // tokens emitidos antes disso. Tolerância de 1s para arredondamento do iat.
    if (payload.iat && medico.updated_epoch > payload.iat + 1) {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireMaster(req, res, next) {
  if (req.user?.role !== "master") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}

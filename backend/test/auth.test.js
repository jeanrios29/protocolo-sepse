import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-suficientemente-longo";

// Importado após definir JWT_SECRET para não disparar a validação do config.
const { signToken } = await import("../src/auth.js");

test("signToken emite um JWT com os claims do médico", () => {
  const token = signToken({ id: "abc-123", crm: "12.345", role: "medico", nome: "Dra. Teste" });
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.sub, "abc-123");
  assert.equal(payload.crm, "12.345");
  assert.equal(payload.role, "medico");
  assert.ok(payload.iat, "deve conter iat para invalidação por updated_at");
});

test("jwt.verify rejeita token assinado com outro segredo", () => {
  const forjado = jwt.sign({ sub: "x" }, "outro-segredo");
  assert.throws(() => jwt.verify(forjado, process.env.JWT_SECRET));
});

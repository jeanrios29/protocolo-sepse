import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-suficientemente-longo";

// Importado após definir JWT_SECRET para não disparar a validação do config.
const { hashPassword, verifyPassword } = await import("../src/auth.js");

// Valida o núcleo de segurança da troca de senha: a senha atual precisa bater
// contra o hash armazenado, e o novo hash precisa validar a nova senha (e só ela).
test("troca de senha: senha atual válida, nova senha passa a valer e a antiga não", async () => {
  const antiga = "123456";
  const nova = "nova-senha-forte";

  const hashAntigo = await hashPassword(antiga);
  assert.ok(await verifyPassword(antiga, hashAntigo), "senha atual deve validar contra o hash armazenado");
  assert.equal(await verifyPassword("errada", hashAntigo), false, "senha errada não deve validar");

  const hashNovo = await hashPassword(nova);
  assert.ok(await verifyPassword(nova, hashNovo), "nova senha deve validar contra o novo hash");
  assert.equal(await verifyPassword(antiga, hashNovo), false, "senha antiga não deve mais valer após a troca");
});

test("hashPassword gera hashes distintos (salt) para a mesma senha", async () => {
  const a = await hashPassword("123456");
  const b = await hashPassword("123456");
  assert.notEqual(a, b, "salts diferentes → hashes diferentes");
  assert.ok(await verifyPassword("123456", a) && await verifyPassword("123456", b));
});

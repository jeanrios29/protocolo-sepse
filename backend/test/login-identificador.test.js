import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-suficientemente-longo";

const { normalizarCrm, pareceEmail } = await import("../src/auth.js");

test("normalizarCrm mantém só os dígitos (tolerante a formatação)", () => {
  assert.equal(normalizarCrm("32.394"), "32394");
  assert.equal(normalizarCrm("32394"), "32394");
  assert.equal(normalizarCrm("32-394"), "32394");
  assert.equal(normalizarCrm(" 32 394 "), "32394");
  // Variantes de formatação convergem para o mesmo valor canônico:
  assert.equal(normalizarCrm("32.394"), normalizarCrm("32394"));
});

test("normalizarCrm lida com vazio/entrada inválida", () => {
  assert.equal(normalizarCrm(""), "");
  assert.equal(normalizarCrm(null), "");
  assert.equal(normalizarCrm(undefined), "");
  assert.equal(normalizarCrm("abc"), ""); // sem dígitos → vazio (não identifica ninguém)
});

test("pareceEmail distingue e-mail de CRM", () => {
  assert.equal(pareceEmail("nome@hospital.com"), true);
  assert.equal(pareceEmail("32.394"), false);
  assert.equal(pareceEmail("32394"), false);
  assert.equal(pareceEmail(""), false);
});

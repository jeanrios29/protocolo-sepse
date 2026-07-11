import "dotenv/config";

// Valida as variáveis de ambiente obrigatórias no boot: sem isto, a falta de
// JWT_SECRET só estouraria no primeiro login (500 silencioso em produção).
const REQUIRED = ["DATABASE_URL", "JWT_SECRET"];

const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(
    `\n[config] Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}.\n` +
    `Defina-as (veja backend/.env.example) antes de iniciar o servidor.\n`
  );
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 16) {
  console.error("[config] JWT_SECRET muito curto — use um segredo com ao menos 16 caracteres.");
  process.exit(1);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "14h",
  port: Number(process.env.PORT) || 4000,
};

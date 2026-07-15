import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A aplicação é servida sob /sepse/ (apimed.com.br/sepse) — a raiz do domínio
// fica com a landing institucional da APIMED. O base garante que os assets do
// build apontem para /sepse/... e o dev server espelhe o mesmo caminho.
export default defineConfig({
  plugins: [react()],
  base: "/sepse/",
  server: {
    proxy: {
      // Em produção o nginx mapeia /sepse/api/ -> backend /api/; em dev o
      // proxy do Vite faz a mesma reescrita para o comportamento ser idêntico.
      "/sepse/api": {
        target: "http://127.0.0.1:4000",
        rewrite: (path) => path.replace(/^\/sepse\/api/, "/api"),
      },
    },
  },
});

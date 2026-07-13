-- 000_bootstrap_privileges
-- As tabelas sao criadas pelo role de migracao (postgres). Para que o app
-- (sepse_app) continue com acesso DML sem precisar de GRANT manual a cada
-- nova tabela/sequence, definimos privilegios padrao + reforcamos os grants
-- nos objetos ja existentes. Tudo idempotente. Roda primeiro (nome 000).

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sepse_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sepse_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sepse_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sepse_app;

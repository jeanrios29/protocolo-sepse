-- Protocolo Sepse — schema Postgres
-- Convencao: chaves primarias uuid (gen_random_uuid), timestamps timestamptz.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------
-- Medicos (usuarios do sistema)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicos (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          text NOT NULL,
    crm           text NOT NULL UNIQUE,
    email         text,
    password_hash text NOT NULL,
    role          text NOT NULL DEFAULT 'medico' CHECK (role IN ('medico', 'master')),
    active        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- Catalogos de referencia clinica (permite evoluir o protocolo sem
-- alterar a estrutura das tabelas de fato)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sirs_criterios_catalogo (
    id     text PRIMARY KEY,       -- ex: 'fc90', 'temp', ...
    label  text NOT NULL,
    ordem  integer NOT NULL
);

CREATE TABLE IF NOT EXISTS focos_infeccao_catalogo (
    id    smallserial PRIMARY KEY,
    nome  text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS antibioticos_catalogo (
    id    smallserial PRIMARY KEY,
    nome  text NOT NULL UNIQUE
);

-- ------------------------------------------------------------------
-- Atendimentos (fichas de sepse)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atendimentos (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_nome       text NOT NULL,
    numero_atendimento  text NOT NULL,
    data_atendimento    date NOT NULL,
    hora_atendimento    time NOT NULL,
    medico_id           uuid NOT NULL REFERENCES medicos(id),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_data ON atendimentos (data_atendimento);
CREATE INDEX IF NOT EXISTS idx_atendimentos_medico ON atendimentos (medico_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_numero ON atendimentos (numero_atendimento);
CREATE INDEX IF NOT EXISTS idx_atendimentos_paciente ON atendimentos (lower(paciente_nome));

-- Criterios SIRS/Sepse marcados numa ficha (so guarda os marcados)
CREATE TABLE IF NOT EXISTS atendimento_criterios (
    atendimento_id  uuid NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
    criterio_id     text NOT NULL REFERENCES sirs_criterios_catalogo(id),
    PRIMARY KEY (atendimento_id, criterio_id)
);

-- Focos de infeccao selecionados (N:N)
CREATE TABLE IF NOT EXISTS atendimento_focos (
    atendimento_id  uuid NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
    foco_id         smallint NOT NULL REFERENCES focos_infeccao_catalogo(id),
    PRIMARY KEY (atendimento_id, foco_id)
);

-- Antibioticos prescritos (N:N)
CREATE TABLE IF NOT EXISTS atendimento_antibioticos (
    atendimento_id   uuid NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
    antibiotico_id   smallint NOT NULL REFERENCES antibioticos_catalogo(id),
    PRIMARY KEY (atendimento_id, antibiotico_id)
);

CREATE INDEX IF NOT EXISTS idx_atend_criterios_criterio ON atendimento_criterios (criterio_id);
CREATE INDEX IF NOT EXISTS idx_atend_focos_foco ON atendimento_focos (foco_id);
CREATE INDEX IF NOT EXISTS idx_atend_atb_atb ON atendimento_antibioticos (antibiotico_id);

-- ------------------------------------------------------------------
-- Trilha de auditoria (LGPD / rastreabilidade de dados de saude)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id          bigserial PRIMARY KEY,
    medico_id   uuid REFERENCES medicos(id),
    acao        text NOT NULL,        -- 'login', 'login_falhou', 'criar_ficha', 'criar_medico', etc.
    entidade    text,                 -- 'atendimento', 'medico'
    entidade_id text,
    detalhes    jsonb,
    ip          text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_medico ON audit_log (medico_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at);

-- ------------------------------------------------------------------
-- View de apoio a analytics: uma linha por atendimento com contagem
-- de criterios SIRS/Sepse (facilita consultas de evolucao/analise)
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_atendimentos_resumo AS
SELECT
    a.id,
    a.paciente_nome,
    a.numero_atendimento,
    a.data_atendimento,
    a.hora_atendimento,
    a.medico_id,
    m.nome  AS medico_nome,
    m.crm   AS medico_crm,
    COALESCE(c.total_criterios, 0) AS total_criterios,
    a.created_at
FROM atendimentos a
JOIN medicos m ON m.id = a.medico_id
LEFT JOIN (
    SELECT atendimento_id, count(*) AS total_criterios
    FROM atendimento_criterios
    GROUP BY atendimento_id
) c ON c.atendimento_id = a.id;

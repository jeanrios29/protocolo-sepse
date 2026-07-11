-- Migração 001 — habilita o KPI porta-antibiótico (meta institucional: ATB <= 1h)
-- e a classificação diagnóstica do caso (base do BI de indicação correta).
-- Idempotente: pode rodar mais de uma vez.

-- ------------------------------------------------------------------
-- Tempos do protocolo e classificação do caso
-- ------------------------------------------------------------------
ALTER TABLE atendimentos
    ADD COLUMN IF NOT EXISTS hora_administracao_atb time,
    ADD COLUMN IF NOT EXISTS classificacao text
        CHECK (classificacao IN ('sirs', 'sepse', 'choque_septico'));

COMMENT ON COLUMN atendimentos.hora_administracao_atb IS
    'Hora em que o antibiótico foi efetivamente administrado (não a prescrição). Base do KPI porta-antibiótico.';
COMMENT ON COLUMN atendimentos.classificacao IS
    'Classificação do caso na abertura: sirs (SIRS sem disfunção), sepse (infecção + disfunção orgânica), choque_septico.';

-- ------------------------------------------------------------------
-- Categorização dos critérios: SIRS clássico vs disfunção orgânica.
-- O checklist original misturava os dois grupos numa contagem única
-- rotulada (incorretamente) de qSOFA.
-- ------------------------------------------------------------------
ALTER TABLE sirs_criterios_catalogo
    ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'sirs'
        CHECK (categoria IN ('sirs', 'disfuncao'));

UPDATE sirs_criterios_catalogo SET categoria = 'sirs'
 WHERE id IN ('fc90', 'temp', 'fr20', 'leucocitos');
UPDATE sirs_criterios_catalogo SET categoria = 'disfuncao'
 WHERE id IN ('hipoxemia', 'consciencia', 'oliguria', 'hipotensao',
              'acidose', 'coagulopatia', 'trombocitopenia', 'hiperbilirrubinemia');

-- ------------------------------------------------------------------
-- Catálogos: focos e antibióticos que faltavam ao protocolo
-- ------------------------------------------------------------------
INSERT INTO focos_infeccao_catalogo (nome) VALUES
    ('Corrente sanguínea / cateter (CVC)'),
    ('Indeterminado / a esclarecer')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO antibioticos_catalogo (nome) VALUES
    ('Amicacina'), ('Ampicilina'), ('Clindamicina'), ('Fluconazol'),
    ('Gentamicina'), ('Linezolida')
ON CONFLICT (nome) DO NOTHING;

-- ------------------------------------------------------------------
-- View de resumo: expõe o tempo porta-antibiótico em minutos.
-- Regra de virada de dia: se a administração é "antes" da abertura,
-- assume-se que cruzou a meia-noite (+24h).
-- ------------------------------------------------------------------
DROP VIEW IF EXISTS vw_atendimentos_resumo;
CREATE VIEW vw_atendimentos_resumo AS
SELECT
    a.id,
    a.paciente_nome,
    a.numero_atendimento,
    a.data_atendimento,
    a.hora_atendimento,
    a.hora_administracao_atb,
    a.classificacao,
    CASE
        WHEN a.hora_administracao_atb IS NOT NULL THEN
            (EXTRACT(EPOCH FROM (a.hora_administracao_atb - a.hora_atendimento)) / 60
             + CASE WHEN a.hora_administracao_atb < a.hora_atendimento THEN 1440 ELSE 0 END)::int
    END AS porta_atb_min,
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

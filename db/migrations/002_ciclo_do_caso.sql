-- Migração 002 — ciclo de vida do caso: prescrição separada da administração,
-- desfecho/encerramento e status derivado para a fila de acompanhamento.
-- Idempotente: pode rodar mais de uma vez.

-- ------------------------------------------------------------------
-- Hora da PRESCRIÇÃO do antibiótico (a administração já existe: 001)
-- ------------------------------------------------------------------
ALTER TABLE atendimentos
    ADD COLUMN IF NOT EXISTS hora_prescricao_atb time;

COMMENT ON COLUMN atendimentos.hora_prescricao_atb IS
    'Hora da prescrição do antibiótico. A administração (hora_administracao_atb) é o marco do KPI de 1h.';

-- ------------------------------------------------------------------
-- Desfecho do caso (preenchido depois, na revisão/encerramento).
-- Habilita o BI retrospectivo: era mesmo sepse? indicação correta?
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atendimento_desfechos (
    atendimento_id       uuid PRIMARY KEY REFERENCES atendimentos(id) ON DELETE CASCADE,
    classificacao_final  text NOT NULL CHECK (classificacao_final IN
        ('sepse_confirmada', 'choque_septico', 'infeccao_sem_sepse', 'descartado')),
    indicacao_adequada   boolean,
    foco_confirmado      boolean,
    culturas_colhidas    boolean,
    cultura_positiva     boolean,
    destino              text NOT NULL CHECK (destino IN
        ('alta', 'enfermaria', 'uti', 'obito', 'transferencia')),
    data_desfecho        date,
    observacoes          text,
    revisado_por         uuid REFERENCES medicos(id),
    revisado_em          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- View de resumo: tempos, desfecho e status derivado do caso.
--   pendente_atb        -> antibiótico ainda não administrado (crítico)
--   aguardando_desfecho -> ATB ok, caso aberto sem encerramento
--   encerrado           -> desfecho lançado
-- ------------------------------------------------------------------
DROP VIEW IF EXISTS vw_atendimentos_resumo;
CREATE VIEW vw_atendimentos_resumo AS
SELECT
    a.id,
    a.paciente_nome,
    a.numero_atendimento,
    a.data_atendimento,
    a.hora_atendimento,
    a.hora_prescricao_atb,
    a.hora_administracao_atb,
    a.classificacao,
    CASE
        WHEN a.hora_administracao_atb IS NOT NULL THEN
            (EXTRACT(EPOCH FROM (a.hora_administracao_atb - a.hora_atendimento)) / 60
             + CASE WHEN a.hora_administracao_atb < a.hora_atendimento THEN 1440 ELSE 0 END)::int
    END AS porta_atb_min,
    CASE
        WHEN d.atendimento_id IS NOT NULL THEN 'encerrado'
        WHEN a.hora_administracao_atb IS NULL THEN 'pendente_atb'
        ELSE 'aguardando_desfecho'
    END AS status,
    d.classificacao_final,
    d.indicacao_adequada,
    d.foco_confirmado,
    d.culturas_colhidas,
    d.cultura_positiva,
    d.destino,
    d.data_desfecho,
    a.medico_id,
    m.nome  AS medico_nome,
    m.crm   AS medico_crm,
    COALESCE(c.total_criterios, 0) AS total_criterios,
    a.created_at
FROM atendimentos a
JOIN medicos m ON m.id = a.medico_id
LEFT JOIN atendimento_desfechos d ON d.atendimento_id = a.id
LEFT JOIN (
    SELECT atendimento_id, count(*) AS total_criterios
    FROM atendimento_criterios
    GROUP BY atendimento_id
) c ON c.atendimento_id = a.id;

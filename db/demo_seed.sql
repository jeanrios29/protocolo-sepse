-- Dados FICTÍCIOS de demonstração — apenas para ambiente local/apresentação.
-- Cria médicos de teste (senha: demo123) e ~150 fichas nos últimos 90 dias
-- com tendência de melhora no KPI porta-antibiótico.

INSERT INTO medicos (nome, crm, password_hash, role) VALUES
    ('Jean Rios Novaes Silva', '32.394', '$2a$10$GVFLJz9hDbd5KWo3nYEjY.YRKuq9nIFz3TPJeK6nOTCSMJfbsmC6e', 'master'),
    ('Ana Beatriz Sampaio',    '41.208', '$2a$10$GVFLJz9hDbd5KWo3nYEjY.YRKuq9nIFz3TPJeK6nOTCSMJfbsmC6e', 'medico'),
    ('Carlos Eduardo Menezes', '38.771', '$2a$10$GVFLJz9hDbd5KWo3nYEjY.YRKuq9nIFz3TPJeK6nOTCSMJfbsmC6e', 'medico')
ON CONFLICT (crm) DO NOTHING;

DO $$
DECLARE
    nomes text[] := ARRAY[
        'Maria das Graças Oliveira','José Roberto Santana','Antônia Ferreira Lima','Francisco das Chagas Souza',
        'Adriana Castro Nunes','Paulo Henrique Gomes','Luciana Barros Andrade','Raimundo Nonato Silva',
        'Vera Lúcia Cardoso','Sebastião Alves Pinto','Rita de Cássia Moreira','João Batista Fonseca',
        'Marlene Souza Duarte','Geraldo Magela Costa','Terezinha de Jesus Ramos','Edvaldo Nascimento Rocha',
        'Ivone Aparecida Teles','Manoel Messias Correia','Neusa Maria Bittencourt','Osvaldo Cruz Peixoto',
        'Dalva Regina Siqueira','Expedito Fernandes Leal','Zilda Carvalho Matos','Waldir Assunção Prado',
        'Creusa Santos Furtado','Lourival Dias Campos','Aparecida Fátima Borges','Benedito Silvério Cunha',
        'Iracema Vasconcelos Reis','Durval Pacheco Amorim'
    ];
    med_ids uuid[];
    a_id uuid;
    d date;
    n_dia int;
    i int;
    hh int; mm int;
    abertura time;
    delta int;
    idade_dias int;
    classif text;
    n_crit int;
    crit_ids text[];
    foco_id_pick smallint;
    atb_id_pick smallint;
    r double precision;
BEGIN
    SELECT array_agg(id) INTO med_ids FROM medicos;

    FOR d IN SELECT generate_series(current_date - 89, current_date, '1 day')::date LOOP
        idade_dias := current_date - d;
        -- 0 a 3 fichas por dia
        n_dia := floor(random() * 3.4)::int;
        FOR i IN 1..n_dia LOOP
            hh := 6 + floor(random() * 17)::int;
            mm := floor(random() * 60)::int;
            abertura := make_time(hh, mm, 0);

            -- Tempo porta-ATB: melhora ao longo do tempo (meses antigos piores).
            -- Fichas recentes: ~85% dentro de 60 min; antigas: ~60%.
            r := random();
            IF r < 0.05 THEN
                delta := NULL;                                  -- ATB ainda não administrado/registrado
            ELSIF r < 0.05 + 0.60 + (0.25 * (1 - idade_dias / 90.0)) THEN
                delta := 18 + floor(random() * 42)::int;        -- 18–59 min (dentro da meta)
            ELSIF r < 0.90 THEN
                delta := 61 + floor(random() * 35)::int;        -- 61–95 min
            ELSE
                delta := 96 + floor(random() * 60)::int;        -- 96–155 min
            END IF;

            r := random();
            classif := CASE
                WHEN r < 0.30 THEN 'sirs'
                WHEN r < 0.82 THEN 'sepse'
                WHEN r < 0.95 THEN 'choque_septico'
                ELSE NULL
            END;

            INSERT INTO atendimentos (paciente_nome, numero_atendimento, data_atendimento, hora_atendimento,
                                      hora_administracao_atb, classificacao, medico_id)
            VALUES (
                nomes[1 + floor(random() * array_length(nomes, 1))::int],
                to_char(d, 'YYYY') || lpad(floor(random() * 999999)::text, 6, '0'),
                d, abertura,
                CASE WHEN delta IS NULL THEN NULL
                     ELSE (abertura + (delta || ' minutes')::interval)::time END,
                classif,
                med_ids[1 + floor(random() * array_length(med_ids, 1))::int]
            ) RETURNING id INTO a_id;

            -- Critérios coerentes com a classificação
            n_crit := CASE classif
                WHEN 'sirs' THEN 2 + floor(random() * 2)::int
                WHEN 'sepse' THEN 3 + floor(random() * 3)::int
                WHEN 'choque_septico' THEN 4 + floor(random() * 4)::int
                ELSE 1 + floor(random() * 2)::int
            END;
            SELECT array_agg(id) INTO crit_ids FROM (
                SELECT id FROM sirs_criterios_catalogo
                WHERE classif IS NULL OR classif = 'sirs' IS FALSE OR categoria = 'sirs'
                ORDER BY random() LIMIT n_crit
            ) s;
            INSERT INTO atendimento_criterios (atendimento_id, criterio_id)
            SELECT a_id, unnest(crit_ids);

            -- 1 foco (às vezes 2)
            SELECT id INTO foco_id_pick FROM focos_infeccao_catalogo ORDER BY random() LIMIT 1;
            INSERT INTO atendimento_focos VALUES (a_id, foco_id_pick);
            IF random() < 0.18 THEN
                INSERT INTO atendimento_focos
                SELECT a_id, id FROM focos_infeccao_catalogo WHERE id <> foco_id_pick ORDER BY random() LIMIT 1;
            END IF;

            -- 1–2 antibióticos (com viés para os mais comuns na prática)
            SELECT id INTO atb_id_pick FROM antibioticos_catalogo
            WHERE nome = ANY (CASE WHEN random() < 0.65
                THEN ARRAY['Ceftriaxona','Piperacilina-Tazobactam','Meropenem','Cefepima','Vancomicina','Azitromicina']
                ELSE ARRAY(SELECT nome FROM antibioticos_catalogo) END)
            ORDER BY random() LIMIT 1;
            INSERT INTO atendimento_antibioticos VALUES (a_id, atb_id_pick);
            IF random() < 0.30 THEN
                INSERT INTO atendimento_antibioticos
                SELECT a_id, id FROM antibioticos_catalogo WHERE id <> atb_id_pick ORDER BY random() LIMIT 1;
            END IF;
        END LOOP;
    END LOOP;
END $$;

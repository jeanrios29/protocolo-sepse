-- Seeds dos catalogos clinicos fixos do protocolo.
-- Idempotente: pode rodar mais de uma vez sem duplicar.

INSERT INTO sirs_criterios_catalogo (id, label, ordem) VALUES
    ('fc90',                'FC > 90 bpm', 1),
    ('temp',                'Temperatura > 37,5ºC ou < 35ºC', 2),
    ('fr20',                'FR > 20 irpm ou PaCO2 < 32 mmHg', 3),
    ('leucocitos',          'Leucócitos totais > 12.000 ou < 4.000, ou formas jovens ≥ 10%', 4),
    ('hipoxemia',           'Hipoxemia — SpO2 < 90% ou PaO2/FiO2 < 300', 5),
    ('consciencia',         'Alteração do nível/conteúdo de consciência (delirium)', 6),
    ('oliguria',            'Oligúria — débito urinário < 0,5 mL/kg/h por 2h, ou creatinina > 2 mg/dL', 7),
    ('hipotensao',          'Hipotensão arterial — PAS < 90 mmHg, queda de PAS > 40 mmHg, ou PAM ≤ 65 mmHg', 8),
    ('acidose',             'Acidose metabólica inexplicada — déficit de bases ≤ 5 mEq/L e lactato ≥ 2 mmol/L', 9),
    ('coagulopatia',        'Coagulopatia — RNI > 1,5 ou TTPa > 60s', 10),
    ('trombocitopenia',     'Trombocitopenia — plaquetas < 100.000, ou queda ≥ 50% (últimos 3 dias)', 11),
    ('hiperbilirrubinemia', 'Hiperbilirrubinemia — bilirrubina > 2x o valor de referência', 12)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, ordem = EXCLUDED.ordem;

INSERT INTO focos_infeccao_catalogo (nome) VALUES
    ('Trato respiratório inferior/superior'),
    ('Trato urinário'),
    ('Trato gastrointestinal'),
    ('Cutâneo/partes moles'),
    ('Sistema nervoso'),
    ('Ginecológico'),
    ('Urológico'),
    ('Hematológico'),
    ('Cardíaco (Endocardite)'),
    ('Dentário')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO antibioticos_catalogo (nome) VALUES
    ('Amoxicilina'), ('Amoxicilina + Clavulanato'), ('Azitromicina'), ('Cefazolina'),
    ('Cefepima'), ('Ceftriaxona'), ('Ciprofloxacino'), ('Claritromicina'), ('Doxiciclina'),
    ('Eritromicina'), ('Ertapenem'), ('Levofloxacino'), ('Metronidazol'), ('Nitrofurantoína'),
    ('Piperacilina-Tazobactam'), ('Meropenem'), ('Oxacilina'), ('Polimixina'),
    ('Teicoplanina'), ('Trimetoprima-Sulfametoxazol'), ('Vancomicina')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- FASE 3 — Alterar inscricoes + trigger calcular_valor_inscricao
-- Execute este script no Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Adicionar colunas à tabela inscricoes
-- ============================================================
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS pacote_id UUID REFERENCES pacotes(id);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS codigo_parceria_usado TEXT REFERENCES codigos_parceria(codigo);

-- ============================================================
-- 2. Criar função + trigger que recalcula valor_total
--    SEMPRE no servidor, ignorando o que vier no INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_valor_inscricao()
RETURNS TRIGGER AS $$
DECLARE
    pac pacotes%ROWTYPE;
    cod codigos_parceria%ROWTYPE;
    valor_final NUMERIC(12,2);
BEGIN
    SELECT * INTO pac FROM pacotes WHERE id = NEW.pacote_id AND ativo = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pacote inválido';
    END IF;

    valor_final := pac.valor;

    IF NEW.codigo_parceria_usado IS NOT NULL THEN
        SELECT * INTO cod FROM codigos_parceria
        WHERE codigo = NEW.codigo_parceria_usado AND ativo = true
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Código de parceria inválido';
        END IF;
        IF cod.limite_usos IS NOT NULL AND cod.usos_atuais >= cod.limite_usos THEN
            RAISE EXCEPTION 'Código de parceria esgotado';
        END IF;

        valor_final := ROUND(valor_final * (1 - cod.percentual_desconto / 100), 2);

        UPDATE codigos_parceria SET usos_atuais = usos_atuais + 1
        WHERE codigo = NEW.codigo_parceria_usado;
    END IF;

    NEW.valor_total := valor_final;
    NEW.numero_parcelas := pac.parcelas;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_calcular_valor_inscricao ON inscricoes;
CREATE TRIGGER trg_calcular_valor_inscricao
    BEFORE INSERT ON inscricoes
    FOR EACH ROW
    EXECUTE FUNCTION calcular_valor_inscricao();

-- ============================================================
-- 3. Popular pacote_id nas inscrições existentes (legado)
--    e só DEPOIS tornar obrigatório
-- ============================================================
UPDATE inscricoes
SET pacote_id = (SELECT id FROM pacotes WHERE slug = 'normal')
WHERE pacote_id IS NULL;

ALTER TABLE inscricoes ALTER COLUMN pacote_id SET NOT NULL;

-- ============================================================
-- FIM DA FASE 3
-- ============================================================

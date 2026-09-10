-- ============================================================
-- FASE 2 — Schema: tabela codigos_parceria + RPC validação
-- Execute este script no Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Criar tabela codigos_parceria
-- ============================================================
CREATE TABLE IF NOT EXISTS codigos_parceria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    nome_parceiro TEXT NOT NULL,
    percentual_desconto NUMERIC(5,2) NOT NULL CHECK (percentual_desconto > 0 AND percentual_desconto <= 100),
    limite_usos INTEGER,
    usos_atuais INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_por UUID REFERENCES utilizadores(id),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Ativar RLS
-- ============================================================
ALTER TABLE codigos_parceria ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Policies — NENHUMA leitura pública direta
--    (código validado só via RPC, nunca por SELECT)
-- ============================================================
-- Staff pode ler (gestão no admin)
CREATE POLICY "admin_ve_codigos"
    ON codigos_parceria FOR SELECT TO authenticated
    USING (public.is_staff());

-- Só admin pode escrever
CREATE POLICY "admin_gere_codigos"
    ON codigos_parceria FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Função de validação pública (RPC)
--    Única forma de "ver" um código de fora
--    Devolve só válido/inválido + percentual — nunca
--    nome_parceiro nem usos_atuais
-- ============================================================
CREATE OR REPLACE FUNCTION validar_codigo_parceria(p_codigo TEXT)
RETURNS JSONB AS $$
DECLARE
    reg codigos_parceria%ROWTYPE;
BEGIN
    SELECT * INTO reg FROM codigos_parceria
    WHERE codigo = p_codigo AND ativo = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valido', false);
    END IF;

    IF reg.limite_usos IS NOT NULL AND reg.usos_atuais >= reg.limite_usos THEN
        RETURN jsonb_build_object('valido', false);
    END IF;

    RETURN jsonb_build_object('valido', true, 'percentual', reg.percentual_desconto);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION validar_codigo_parceria(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validar_codigo_parceria(TEXT) TO anon, authenticated;

-- ============================================================
-- FIM DA FASE 2
-- ============================================================

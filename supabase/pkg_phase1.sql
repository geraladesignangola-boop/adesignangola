-- ============================================================
-- FASE 1 — Schema: tabela pacotes
-- Execute este script no Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Criar tabela pacotes
-- ============================================================
CREATE TABLE IF NOT EXISTS pacotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL CHECK (slug IN ('normal', 'pro')),
    nome TEXT NOT NULL,
    valor NUMERIC(12,2) NOT NULL,
    parcelas INTEGER NOT NULL DEFAULT 3,
    valor_parcela NUMERIC(12,2) NOT NULL,
    inclui_mentoria BOOLEAN NOT NULL DEFAULT false,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Ativar RLS
-- ============================================================
ALTER TABLE pacotes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Policies
-- ============================================================
-- Leitura pública (landing page precisa de mostrar pacotes)
CREATE POLICY "leitura_publica_pacotes"
    ON pacotes FOR SELECT
    USING (true);

-- Escrita só admin
CREATE POLICY "admin_gere_pacotes"
    ON pacotes FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Popula os dois pacotes iniciais
-- ============================================================
INSERT INTO pacotes (slug, nome, valor, parcelas, valor_parcela, inclui_mentoria, descricao)
VALUES
    ('normal', 'Normal', 40000.00, 3, 13333.33, false, 'Curso completo de Design Gráfico — 18 módulos, 30 dias.'),
    ('pro', 'Pro', 55000.00, 3, 18333.33, true, 'Curso completo + mentoria individualizada com profissionais do mercado.')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- FIM DA FASE 1
-- ============================================================

-- ============================================================
-- Pacote Online — Zoom / Google Meet
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Alterar CHECK constraint para aceitar 'online'
ALTER TABLE pacotes DROP CONSTRAINT IF EXISTS pacotes_slug_check;
ALTER TABLE pacotes ADD CONSTRAINT pacotes_slug_check CHECK (slug IN ('normal', 'pro', 'online'));

-- 2. Inserir pacote online
INSERT INTO pacotes (slug, nome, valor, parcelas, valor_parcela, inclui_mentoria, descricao)
VALUES ('online', 'Online', 35000.00, 3, 11666.67, false, 'Curso completo via Zoom e Google Meet — ao vivo, interativo, sem precisar sair de casa.')
ON CONFLICT (slug) DO UPDATE SET
    valor = EXCLUDED.valor,
    parcelas = EXCLUDED.parcelas,
    valor_parcela = EXCLUDED.valor_parcela,
    inclui_mentoria = EXCLUDED.inclui_mentoria,
    descricao = EXCLUDED.descricao;

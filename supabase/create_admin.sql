-- ============================================================
-- CRIAR PRIMEIRO ADMIN - Execute após a migration principal
-- ============================================================
-- IMPORTANTE: Primeiro crie o utilizador via Supabase Dashboard > Auth > Users
-- Depois execute este SQL para inserir na tabela utilizadores
-- ============================================================

-- Substitua 'ADMIN_USER_ID' pelo ID do utilizador criado no Auth
-- Encontre o ID em: Supabase Dashboard > Auth > Users > copie o UUID

INSERT INTO utilizadores (id, nome, email, role, ativo)
VALUES (
    'ADMIN_USER_ID'::UUID,  -- SUBSTITUA pelo ID real do Auth
    'Adilson',
    'admin@aacademy.ao',
    'admin',
    true
) ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    role = EXCLUDED.role,
    ativo = EXCLUDED.ativo;

-- ============================================================
-- OPCIONAL: Criar um operador de exemplo
-- ============================================================
-- Crie primeiro o utilizador no Auth, depois execute:
--
-- INSERT INTO utilizadores (id, nome, email, role, ativo)
-- VALUES (
--     'OPERATOR_USER_ID'::UUID,
--     'Operador',
--     'operador@aacademy.ao',
--     'operador',
--     true
-- );

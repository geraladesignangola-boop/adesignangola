-- ============================================================
-- FIX DEFINITIVO - UTILIZADORES RLS
-- Execute no SQL Editor
-- ============================================================

-- Remover todas as policies antigas
DROP POLICY IF EXISTS "Admin pode ver utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Utilizador ve proprio perfil" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode ver todos utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode criar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode atualizar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "autenticado le utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "admin escreve utilizadores" ON utilizadores;

-- Política simples: qualquer autenticado pode ler
CREATE POLICY "lecitura_autenticada"
    ON utilizadores FOR SELECT
    TO authenticated
    USING (true);

-- Admin pode escrever (via service role no backend, bypassa RLS)

-- ============================================================
-- CORREÇÃO DAS RLS POLICIES - UTILIZADORES
-- Execute este script no SQL Editor
-- ============================================================

-- Remover policies antigas com referência circular
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.utilizadores
        WHERE id = auth.uid() AND role = 'admin' AND ativo = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.utilizadores
        WHERE id = auth.uid() AND role IN ('admin', 'operador') AND ativo = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

DROP POLICY IF EXISTS "Admin pode ver utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode ver todos utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode ver utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Utilizador ve proprio perfil" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode criar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode atualizar utilizadores" ON utilizadores;

-- Policies simplificadas para UTILIZADORES
-- Qualquer utilizador autenticado pode ver o próprio perfil
CREATE POLICY "Utilizador ve proprio perfil"
    ON utilizadores FOR SELECT
    USING (id = auth.uid());

-- Admin pode ver todos (usa auth.users para verificar)
CREATE POLICY "Admin pode ver todos utilizadores"
    ON utilizadores FOR SELECT
    USING (public.is_admin());

-- Admin pode criar utilizadores
CREATE POLICY "Admin pode criar utilizadores"
    ON utilizadores FOR INSERT
    WITH CHECK (public.is_admin());

-- Admin pode atualizar utilizadores
CREATE POLICY "Admin pode atualizar utilizadores"
    ON utilizadores FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- CORREÇÃO DAS RLS POLICIES - INSCRICOES
-- ============================================================
DROP POLICY IF EXISTS "Consulta publica por codigo" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode ver todas inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode atualizar inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode eliminar inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Qualquer pessoa pode criar inscricao" ON inscricoes;

CREATE POLICY "Qualquer pessoa pode criar inscricao"
    ON inscricoes FOR INSERT
    WITH CHECK (public.inscricoes_estao_ativas());

CREATE POLICY "Admin pode ver todas inscricoes"
    ON inscricoes FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Admin pode atualizar inscricoes"
    ON inscricoes FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admin pode eliminar inscricoes"
    ON inscricoes FOR DELETE
    USING (public.is_admin());

-- ============================================================
-- CORREÇÃO DAS RLS POLICIES - CONFIGURACOES
-- ============================================================
DROP POLICY IF EXISTS "Admin pode atualizar configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "Admin pode inserir configuracoes" ON configuracoes;

CREATE POLICY "Admin pode atualizar configuracoes"
    ON configuracoes FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admin pode inserir configuracoes"
    ON configuracoes FOR INSERT
    WITH CHECK (public.is_admin());

-- ============================================================
-- CORREÇÃO DAS RLS POLICIES - PRESENCAS
-- ============================================================
DROP POLICY IF EXISTS "Admin pode ver sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode criar sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode eliminar sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode ver registos presenca" ON presencas_registos;
DROP POLICY IF EXISTS "Admin pode gerir registos presenca" ON presencas_registos;

CREATE POLICY "Admin pode ver sessoes"
    ON presencas_sessoes FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Admin pode criar sessoes"
    ON presencas_sessoes FOR INSERT
    WITH CHECK (public.is_staff());

CREATE POLICY "Admin pode eliminar sessoes"
    ON presencas_sessoes FOR DELETE
    USING (public.is_admin());

CREATE POLICY "Admin pode ver registos presenca"
    ON presencas_registos FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Admin pode gerir registos presenca"
    ON presencas_registos FOR ALL
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- ============================================================
-- CORREÇÃO DAS RLS POLICIES - NOTIFICACOES
-- ============================================================
DROP POLICY IF EXISTS "Admin pode ver notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Admin pode atualizar notificacoes" ON notificacoes;

CREATE POLICY "Admin pode ver notificacoes"
    ON notificacoes FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Admin pode atualizar notificacoes"
    ON notificacoes FOR UPDATE
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- ============================================================
-- CORREÇÃO DAS RLS POLICIES - AUDIT_LOG
-- ============================================================
DROP POLICY IF EXISTS "Admin pode ver audit log" ON audit_log;

CREATE POLICY "Admin pode ver audit log"
    ON audit_log FOR SELECT
    USING (public.is_admin());

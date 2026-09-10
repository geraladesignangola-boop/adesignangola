-- ============================================================
-- FIX DEFINITIVO — A.Academy (Academia de Design Gráfico)
-- ============================================================
-- Script consolidado de correções RLS + funções
-- Execute este script no Supabase SQL Editor
--
-- Contém:
--   1. DROP POLICY (todas as policies antigas)
--   2. DROP FUNCTION (funções a redefinir)
--   3. CREATE FUNCTION (is_admin, is_staff, inscricoes_estao_ativas, etc.)
--   4. CREATE POLICY (estado final correcto)
--   5. REVOKE/GRANT (permissões de execução)
-- ============================================================


-- ============================================================
-- PARTE 0: DROP TODAS AS POLICIES (antes de DROP functions)
-- ============================================================
-- Isto liberta dependências para poder fazer DROP FUNCTION

-- UTILIZADORES
DROP POLICY IF EXISTS "Admin pode ver utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Utilizador ve proprio perfil" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode ver todos utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode criar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode atualizar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "lecitura_autenticada" ON utilizadores;
DROP POLICY IF EXISTS "admin escreve utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_todos_admin" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_proprio_perfil" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_insert_admin" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_update_admin" ON utilizadores;
DROP POLICY IF EXISTS "admin_gere_utilizadores_insert" ON utilizadores;
DROP POLICY IF EXISTS "admin_gere_utilizadores_update" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_admin_select" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_insert" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_update" ON utilizadores;
DROP POLICY IF EXISTS "staff_le_utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "utilizadores_select" ON utilizadores;

-- INSCRICOES
DROP POLICY IF EXISTS "Qualquer pessoa pode criar inscricao" ON inscricoes;
DROP POLICY IF EXISTS "Consulta publica por codigo" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode ver todas inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode atualizar inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode eliminar inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode eliminar inscrices" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_insert_publico" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_select_staff" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_update_admin" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_delete_admin" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_insert_quando_ativas" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_insert" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_select" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_update" ON inscricoes;
DROP POLICY IF EXISTS "inscricoes_delete" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode eliminar inscricoes" ON inscricoes;

-- CONFIGURACOES
DROP POLICY IF EXISTS "Leitura publica de configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "Admin pode atualizar configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "Admin pode inserir configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "configuracoes_leitura_todos" ON configuracoes;
DROP POLICY IF EXISTS "configuracoes_admin_all" ON configuracoes;
DROP POLICY IF EXISTS "configuracoes_select_all" ON configuracoes;
DROP POLICY IF EXISTS "configuracoes_insert" ON configuracoes;
DROP POLICY IF EXISTS "configuracoes_update" ON configuracoes;

-- PACOTES
DROP POLICY IF EXISTS "leitura_publica_pacotes" ON pacotes;
DROP POLICY IF EXISTS "admin_gere_pacotes" ON pacotes;
DROP POLICY IF EXISTS "Admins can delete pacotes" ON pacotes;
DROP POLICY IF EXISTS "pacotes_leitura_todos" ON pacotes;
DROP POLICY IF EXISTS "pacotes_admin_all" ON pacotes;
DROP POLICY IF EXISTS "pacotes_select_all" ON pacotes;
DROP POLICY IF EXISTS "pacotes_insert" ON pacotes;
DROP POLICY IF EXISTS "pacotes_update" ON pacotes;
DROP POLICY IF EXISTS "pacotes_delete" ON pacotes;
DROP POLICY IF EXISTS "configuracoes_select_all" ON configuracoes;

-- PACOTES
DROP POLICY IF EXISTS "leitura_publica_pacotes" ON pacotes;
DROP POLICY IF EXISTS "admin_gere_pacotes" ON pacotes;
DROP POLICY IF EXISTS "Admins can delete pacotes" ON pacotes;
DROP POLICY IF EXISTS "pacotes_leitura_todos" ON pacotes;
DROP POLICY IF EXISTS "pacotes_admin_all" ON pacotes;
DROP POLICY IF EXISTS "pacotes_select_all" ON pacotes;

-- CODIGOS_PARCERIA / PARCERIAS (pode existir tabela "parcerias" em algum script)
DROP POLICY IF EXISTS "admin_ve_codigos" ON codigos_parceria;
DROP POLICY IF EXISTS "admin_gere_codigos" ON codigos_parceria;
DROP POLICY IF EXISTS "Admins can delete codigos_parceria" ON codigos_parceria;
DROP POLICY IF EXISTS "codigos_parceria_select_staff" ON codigos_parceria;
DROP POLICY IF EXISTS "codigos_parceria_admin_all" ON codigos_parceria;
DROP POLICY IF EXISTS "parcerias_admin_all" ON codigos_parceria;
DROP POLICY IF EXISTS "parcerias_select_staff" ON codigos_parceria;
DROP POLICY IF EXISTS "parcerias_admin_all" ON parcerias;
DROP POLICY IF EXISTS "parcerias_select_staff" ON parcerias;
DROP POLICY IF EXISTS "parcerias_select" ON parcerias;
DROP POLICY IF EXISTS "parcerias_insert" ON parcerias;
DROP POLICY IF EXISTS "parcerias_update" ON parcerias;
DROP POLICY IF EXISTS "parcerias_delete" ON parcerias;

-- MODULOS_CURSO
DROP POLICY IF EXISTS "modulos_leitura_todos" ON modulos_curso;
DROP POLICY IF EXISTS "modulos_admin_all" ON modulos_curso;
DROP POLICY IF EXISTS "Admin gere modulos" ON modulos_curso;
DROP POLICY IF EXISTS "modulos_select_all" ON modulos_curso;
DROP POLICY IF EXISTS "codigos_parceria_select_staff" ON codigos_parceria;
DROP POLICY IF EXISTS "codigos_parceria_admin_all" ON codigos_parceria;

-- MODULOS_CURSO
DROP POLICY IF EXISTS "modulos_leitura_todos" ON modulos_curso;
DROP POLICY IF EXISTS "modulos_admin_all" ON modulos_curso;
DROP POLICY IF EXISTS "Admin gere modulos" ON modulos_curso;
DROP POLICY IF EXISTS "Leitura publica modulos" ON modulos_curso;
DROP POLICY IF EXISTS "modulos_select_all" ON modulos_curso;

-- PRESENCAS_SESSOES
DROP POLICY IF EXISTS "Admin pode ver sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode criar sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode eliminar sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_select_staff" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_insert_staff" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_delete_admin" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_update_staff" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_select" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_insert" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_update" ON presencas_sessoes;
DROP POLICY IF EXISTS "presencas_sessoes_delete" ON presencas_sessoes;

-- PRESENCAS_REGISTOS
DROP POLICY IF EXISTS "Admin pode ver registos presenca" ON presencas_registos;
DROP POLICY IF EXISTS "Admin pode gerir registos presenca" ON presencas_registos;
DROP POLICY IF EXISTS "presencas_registos_select_staff" ON presencas_registos;
DROP POLICY IF EXISTS "presencas_registos_all_staff" ON presencas_registos;
DROP POLICY IF EXISTS "presencas_registos_select" ON presencas_registos;
DROP POLICY IF EXISTS "presencas_registos_insert" ON presencas_registos;
DROP POLICY IF EXISTS "presencas_registos_update" ON presencas_registos;
DROP POLICY IF EXISTS "presencas_registos_delete" ON presencas_registos;

-- NOTIFICACOES
DROP POLICY IF EXISTS "Admin pode ver notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Admin pode atualizar notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Sistema pode criar notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_select_staff" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_update_staff" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_insert_sistema" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_insert_system" ON notificacoes;
DROP POLICY IF EXISTS "Staff ou trigger cria notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_insert_staff" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_select" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_insert" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_update" ON notificacoes;

-- AUDIT_LOG
DROP POLICY IF EXISTS "Admin pode ver audit log" ON audit_log;
DROP POLICY IF EXISTS "Sistema pode criar audit log" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_system" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_system" ON audit_log;
DROP POLICY IF EXISTS "Staff ou trigger cria audit log" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_admin" ON audit_log;


-- ============================================================
-- PARTE 1: DROP DAS FUNÇÕES ANTIGAS
-- ============================================================
-- Agora que não há dependências de policies, podemos droppar

-- Usar CASCADE para remover policies que dependem destas funções
-- (mesmo que não tenham sido droppadas acima por terem outros nomes)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_staff() CASCADE;


-- ============================================================
-- PARTE 2: CREATE FUNÇÕES CORE (is_admin, is_staff)
-- ============================================================

-- 2.1 is_admin() — verifica se o utilizador atual é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.utilizadores
        WHERE id = auth.uid() AND role = 'admin' AND ativo = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- 2.2 is_staff() — verifica se o utilizador é admin ou operador
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.utilizadores
        WHERE id = auth.uid() AND role IN ('admin', 'operador') AND ativo = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, anon, service_role;


-- ============================================================
-- PARTE 3: CREATE FUNÇÕES RPC
-- ============================================================

-- 3.1 inscricoes_estao_ativas() — verifica se inscrições estão abertas
DROP FUNCTION IF EXISTS public.inscricoes_estao_ativas();

CREATE OR REPLACE FUNCTION public.inscricoes_estao_ativas()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT inscricoes_ativas FROM public.configuracoes LIMIT 1), true);
$$;

GRANT EXECUTE ON FUNCTION public.inscricoes_estao_ativas() TO anon, authenticated;

-- 3.2 definir_inscricoes_ativas(BOOLEAN) — admin alterna inscrições
DROP FUNCTION IF EXISTS public.definir_inscricoes_ativas(BOOLEAN);

CREATE OR REPLACE FUNCTION public.definir_inscricoes_ativas(p_ativas BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    estado BOOLEAN;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.utilizadores
        WHERE id = auth.uid()
          AND role = 'admin'
          AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar o estado das inscricoes';
    END IF;

    UPDATE public.configuracoes
    SET inscricoes_ativas = p_ativas
    WHERE id = (SELECT id FROM public.configuracoes ORDER BY criado_em LIMIT 1)
    RETURNING inscricoes_ativas INTO estado;

    IF estado IS NULL THEN
        RAISE EXCEPTION 'Configuracao do curso nao encontrada';
    END IF;

    RETURN estado;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_inscricoes_ativas(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_inscricoes_ativas(BOOLEAN) TO authenticated;

-- 3.3 consultar_inscricao_publica(TEXT) — consulta pública por código
DROP FUNCTION IF EXISTS public.consultar_inscricao_publica(TEXT);

CREATE OR REPLACE FUNCTION public.consultar_inscricao_publica(codigo TEXT)
RETURNS TABLE (
    id UUID,
    nome_completo TEXT,
    estado TEXT,
    perfil TEXT,
    perfil_label TEXT,
    modalidade_pagamento TEXT,
    codigo_conclusao TEXT,
    data_inscricao TIMESTAMPTZ,
    data_confirmacao TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.nome_completo,
        i.estado,
        i.perfil,
        i.perfil_label,
        i.modalidade_pagamento,
        i.codigo_conclusao,
        i.data_inscricao,
        i.data_confirmacao
    FROM inscricoes i
    WHERE i.codigo_referencia = UPPER(TRIM(codigo));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.consultar_inscricao_publica(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_inscricao_publica(TEXT) TO anon, authenticated;

-- 3.4 validar_codigo_parceria(TEXT) — valida código de parceria (RPC pública)
DROP FUNCTION IF EXISTS public.validar_codigo_parceria(TEXT);

CREATE OR REPLACE FUNCTION public.validar_codigo_parceria(p_codigo TEXT)
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

REVOKE ALL ON FUNCTION public.validar_codigo_parceria(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_codigo_parceria(TEXT) TO anon, authenticated;

-- 3.5 reset_all_data() — apaga todos os dados (mantém config/utilizadores)
DROP FUNCTION IF EXISTS public.reset_all_data();

CREATE OR REPLACE FUNCTION public.reset_all_data()
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem apagar todos os dados';
    END IF;
    TRUNCATE TABLE presencas_registos CASCADE;
    TRUNCATE TABLE presencas_sessoes CASCADE;
    TRUNCATE TABLE inscricoes CASCADE;
    TRUNCATE TABLE modulos_curso CASCADE;
    TRUNCATE TABLE pacotes CASCADE;
    TRUNCATE TABLE codigos_parceria CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reset_all_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_all_data() TO authenticated;

-- 3.6 reset_inscritos_data() — apaga inscrições e presenças (mantém tudo o resto)
DROP FUNCTION IF EXISTS public.reset_inscritos_data();

CREATE OR REPLACE FUNCTION public.reset_inscritos_data()
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem apagar dados dos inscritos';
    END IF;
    TRUNCATE TABLE presencas_registos CASCADE;
    TRUNCATE TABLE presencas_sessoes CASCADE;
    TRUNCATE TABLE inscricoes CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reset_inscritos_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_inscritos_data() TO authenticated;


-- ============================================================
-- PARTE 4: POLICIES — UTILIZADORES
-- ============================================================

ALTER TABLE utilizadores ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todos os utilizadores
CREATE POLICY "utilizadores_admin_select"
    ON utilizadores FOR SELECT
    USING (public.is_admin());

-- Utilizador vê o próprio perfil
CREATE POLICY "utilizadores_proprio_perfil"
    ON utilizadores FOR SELECT
    USING (id = auth.uid());

-- Apenas admin pode criar utilizadores
CREATE POLICY "utilizadores_insert"
    ON utilizadores FOR INSERT
    WITH CHECK (public.is_admin());

-- Apenas admin pode atualizar utilizadores
CREATE POLICY "utilizadores_update"
    ON utilizadores FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ============================================================
-- PARTE 5: POLICIES — INSCRICOES
-- ============================================================

ALTER TABLE inscricoes ENABLE ROW LEVEL SECURITY;

-- INSERT: qualquer pessoa pode criar inscrição (se inscrições estiverem ativas)
CREATE POLICY "inscricoes_insert_quando_ativas"
    ON inscricoes FOR INSERT
    WITH CHECK (public.inscricoes_estao_ativas());

-- SELECT: staff pode ver todas as inscrições
CREATE POLICY "inscricoes_select_staff"
    ON inscricoes FOR SELECT
    USING (public.is_staff());

-- UPDATE: apenas admin pode atualizar inscrições
CREATE POLICY "inscricoes_update_admin"
    ON inscricoes FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- DELETE: apenas admin pode eliminar inscrições
CREATE POLICY "inscricoes_delete_admin"
    ON inscricoes FOR DELETE
    USING (public.is_admin());


-- ============================================================
-- PARTE 6: POLICIES — CONFIGURACOES
-- ============================================================

-- SELECT: todos podem ler (landing page precisa)
CREATE POLICY "configuracoes_select_all"
    ON configuracoes FOR SELECT
    USING (true);

-- ALL: apenas admin pode gerir
CREATE POLICY "configuracoes_admin_all"
    ON configuracoes FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ============================================================
-- PARTE 7: POLICIES — PACOTES
-- ============================================================

ALTER TABLE pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacotes FORCE ROW LEVEL SECURITY;

-- SELECT: todos podem ler (landing page mostra pacotes)
CREATE POLICY "pacotes_select_all"
    ON pacotes FOR SELECT
    USING (true);

-- ALL: apenas admin pode gerir
CREATE POLICY "pacotes_admin_all"
    ON pacotes FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ============================================================
-- PARTE 8: POLICIES — CODIGOS_PARCERIA
-- ============================================================

ALTER TABLE codigos_parceria ENABLE ROW LEVEL SECURITY;

-- SELECT: staff pode ver (gestão no admin)
CREATE POLICY "codigos_parceria_select_staff"
    ON codigos_parceria FOR SELECT
    USING (public.is_staff());

-- ALL: apenas admin pode gerir
CREATE POLICY "codigos_parceria_admin_all"
    ON codigos_parceria FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ============================================================
-- PARTE 9: POLICIES — MODULOS_CURSO
-- ============================================================

ALTER TABLE modulos_curso ENABLE ROW LEVEL SECURITY;

-- SELECT: todos podem ler (landing page e curso precisam)
CREATE POLICY "modulos_select_all"
    ON modulos_curso FOR SELECT
    USING (true);

-- ALL: apenas admin pode gerir
CREATE POLICY "modulos_admin_all"
    ON modulos_curso FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ============================================================
-- PARTE 10: POLICIES — PRESENCAS_SESSOES
-- ============================================================

ALTER TABLE presencas_sessoes ENABLE ROW LEVEL SECURITY;

-- SELECT: staff pode ver sessões
CREATE POLICY "presencas_sessoes_select_staff"
    ON presencas_sessoes FOR SELECT
    USING (public.is_staff());

-- INSERT: staff pode criar sessões
CREATE POLICY "presencas_sessoes_insert_staff"
    ON presencas_sessoes FOR INSERT
    WITH CHECK (public.is_staff());

-- UPDATE: staff pode atualizar sessões
CREATE POLICY "presencas_sessoes_update_staff"
    ON presencas_sessoes FOR UPDATE
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- DELETE: apenas admin pode eliminar sessões
CREATE POLICY "presencas_sessoes_delete_admin"
    ON presencas_sessoes FOR DELETE
    USING (public.is_admin());


-- ============================================================
-- PARTE 11: POLICIES — PRESENCAS_REGISTOS
-- ============================================================

ALTER TABLE presencas_registos ENABLE ROW LEVEL SECURITY;

-- SELECT: staff pode ver registos
CREATE POLICY "presencas_registos_select_staff"
    ON presencas_registos FOR SELECT
    USING (public.is_staff());

-- ALL: staff pode gerir registos
CREATE POLICY "presencas_registos_all_staff"
    ON presencas_registos FOR ALL
    USING (public.is_staff())
    WITH CHECK (public.is_staff());


-- ============================================================
-- PARTE 12: POLICIES — NOTIFICACOES
-- ============================================================

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: staff pode ver notificações
CREATE POLICY "notificacoes_select_staff"
    ON notificacoes FOR SELECT
    USING (public.is_staff());

-- UPDATE: staff pode atualizar notificações (marcar como lidas)
CREATE POLICY "notificacoes_update_staff"
    ON notificacoes FOR UPDATE
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- INSERT: staff pode criar notificações (triggers usam SECURITY DEFINER)
CREATE POLICY "notificacoes_insert_staff"
    ON notificacoes FOR INSERT
    WITH CHECK (public.is_staff());


-- ============================================================
-- PARTE 13: POLICIES — AUDIT_LOG
-- ============================================================

-- SELECT: apenas admin pode ver logs
CREATE POLICY "audit_log_select_admin"
    ON audit_log FOR SELECT
    USING (public.is_admin());

-- INSERT: apenas admin pode criar logs
CREATE POLICY "audit_log_insert_admin"
    ON audit_log FOR INSERT
    WITH CHECK (public.is_admin());


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
-- Resumo do que foi aplicado:
--
-- Funções:
--   - is_admin(): SECURITY DEFINER, search_path=public, role='admin' AND ativo=true
--   - is_staff(): SECURITY DEFINER, search_path=public, role IN ('admin','operador') AND ativo=true
--   - inscricoes_estao_ativas(): SECURITY DEFINER, GRANT TO anon, authenticated
--   - definir_inscricoes_ativas(BOOLEAN): SECURITY DEFINER, GRANT TO authenticated
--   - consultar_inscricao_publica(TEXT): SECURITY DEFINER, GRANT TO anon, authenticated
--   - validar_codigo_parceria(TEXT): SECURITY DEFINER, GRANT TO anon, authenticated
--   - reset_all_data(): SECURITY DEFINER, is_admin() check, REVOKE FROM PUBLIC, GRANT TO authenticated
--   - reset_inscritos_data(): SECURITY DEFINER, is_admin() check, REVOKE FROM PUBLIC, GRANT TO authenticated
--
-- Policies por tabela:
--   utilizadores: admin_select, proprio_perfil, insert, update (sem leitura_autenticada)
--   inscricoes: insert (estao_ativas), select (staff), update (admin), delete (admin)
--   configuracoes: select_all (true), admin_all (admin)
--   pacotes: select_all (true), admin_all (admin)
--   codigos_parceria: select_staff (staff), admin_all (admin)
--   modulos_curso: select_all (true), admin_all (admin)
--   presencas_sessoes: select_staff, insert_staff, update_staff, delete_admin
--   presencas_registos: select_staff, all_staff
--   notificacoes: select_staff, update_staff, insert_staff (NÃO insert true)
--   audit_log: select_admin, insert_admin (NÃO insert true)
-- ============================================================

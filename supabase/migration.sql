-- ============================================================
-- ACADEMIA DE DESIGN GRÁFICO - MIGRAÇÃO COMPLETA PARA SUPABASE
-- ============================================================
-- Execute este script no Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. EXTENSÕES NECESSÁRIAS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. TABELAS
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 TABELA: utilizadores (Admin users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilizadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operador', 'viewer')),
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.2 TABELA: configuracoes (System settings - singleton)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_curso TEXT DEFAULT 'Design Gráfico',
    data_inicio DATE,
    num_modulos INTEGER DEFAULT 18,
    duracao TEXT DEFAULT '30 dias',
    valor_total NUMERIC(12,2) DEFAULT 45000.00,
    parcelas INTEGER DEFAULT 3,
    valor_parcela NUMERIC(12,2) DEFAULT 15000.00,
    regra_liberacao_codigo TEXT DEFAULT 'primeira_parcela' CHECK (regra_liberacao_codigo IN ('primeira_parcela', 'pagamento_total')),
    iban TEXT,
    titular_iban TEXT,
    whatsapp_comprovativo TEXT,
    link_grupo TEXT,
    textos_landing JSONB DEFAULT '{}',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.3 TABELA: inscricoes (Enrollments - tabela principal)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscricoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_sequencial SERIAL UNIQUE,
    nome_completo TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    cidade TEXT,
    perfil TEXT NOT NULL CHECK (perfil IN ('igreja', 'empresa', 'freelancer', 'pessoal', 'outro')),
    perfil_label TEXT,
    campos_especificos JSONB DEFAULT '{}',
    valor_total NUMERIC(12,2) DEFAULT 45000.00,
    modalidade_pagamento TEXT DEFAULT 'integral' CHECK (modalidade_pagamento IN ('integral', 'parcelado')),
    numero_parcelas INTEGER DEFAULT 1,
    estado TEXT DEFAULT 'iniciada' CHECK (estado IN ('iniciada', 'aguarda_confirmacao', 'confirmada', 'rejeitada', 'cancelada')),
    codigo_referencia TEXT UNIQUE NOT NULL,
    codigo_conclusao TEXT,
    data_inscricao TIMESTAMPTZ DEFAULT NOW(),
    data_confirmacao TIMESTAMPTZ,
    canal TEXT,
    notas_internas JSONB DEFAULT '[]',
    historico_estados JSONB DEFAULT '[]',
    parcelas JSONB DEFAULT '[]',
    tipo_inscricao TEXT DEFAULT 'nova' CHECK (tipo_inscricao IN ('nova', 'renovacao')),
    motivo_rejeicao TEXT,
    renovacao_de UUID REFERENCES inscricoes(id),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.4 TABELA: presencas_sessoes (Attendance sessions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presencas_sessoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    data DATE NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    criado_por UUID REFERENCES utilizadores(id)
);

-- ------------------------------------------------------------
-- 2.5 TABELA: presencas_registos (Attendance records per session)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presencas_registos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES presencas_sessoes(id) ON DELETE CASCADE,
    inscricao_id UUID NOT NULL REFERENCES inscricoes(id) ON DELETE CASCADE,
    presente BOOLEAN DEFAULT false,
    registrado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sessao_id, inscricao_id)
);

-- ------------------------------------------------------------
-- 2.6 TABELA: notificacoes (Notifications)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo TEXT NOT NULL CHECK (tipo IN ('nova_inscricao', 'pagamento_confirmado', 'pagamento_rejeitado', 'sistema')),
    titulo TEXT NOT NULL,
    mensagem TEXT,
    inscricao_id UUID REFERENCES inscricoes(id) ON DELETE SET NULL,
    lida BOOLEAN DEFAULT false,
    criada_em TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.7 TABELA: audit_log (Audit trail for admin actions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilizador_id UUID REFERENCES utilizadores(id),
    acao TEXT NOT NULL,
    detalhes JSONB DEFAULT '{}',
    ip_address INET,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inscricoes_estado ON inscricoes(estado);
CREATE INDEX IF NOT EXISTS idx_inscricoes_perfil ON inscricoes(perfil);
CREATE INDEX IF NOT EXISTS idx_inscricoes_codigo_ref ON inscricoes(codigo_referencia);
CREATE INDEX IF NOT EXISTS idx_inscricoes_codigo_conclusao ON inscricoes(codigo_conclusao);
CREATE INDEX IF NOT EXISTS idx_inscricoes_email ON inscricoes(email);
CREATE INDEX IF NOT EXISTS idx_inscricoes_telefone ON inscricoes(telefone);
CREATE INDEX IF NOT EXISTS idx_inscricoes_data_inscricao ON inscricoes(data_inscricao);
CREATE INDEX IF NOT EXISTS idx_inscricoes_tipo ON inscricoes(tipo_inscricao);
CREATE INDEX IF NOT EXISTS idx_presencas_sessao ON presencas_registos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_presencas_inscricao ON presencas_registos(inscricao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_audit_log_utilizador ON audit_log(utilizador_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_acao ON audit_log(acao);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 Gerar código de referência (ADG-YYYY-XXXX)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION gerar_codigo_referencia()
RETURNS TRIGGER AS $$
DECLARE
    ano TEXT;
    seq INTEGER;
    codigo TEXT;
BEGIN
    ano := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(numero_sequencial FROM 1 FOR LENGTH(numero_sequencial::TEXT)) AS INTEGER)
    ), 0) + 1 INTO seq
    FROM inscricoes
    WHERE EXTRACT(YEAR FROM data_inscricao) = EXTRACT(YEAR FROM NOW());

    -- Fallback: use the sequence value
    IF seq <= 0 OR seq IS NULL THEN
        seq := 1;
    END IF;

    codigo := 'ADG-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
    NEW.codigo_referencia := codigo;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_codigo_referencia ON inscricoes;
CREATE TRIGGER trg_gerar_codigo_referencia
    BEFORE INSERT ON inscricoes
    FOR EACH ROW
    WHEN (NEW.codigo_referencia IS NULL OR NEW.codigo_referencia = '')
    EXECUTE FUNCTION gerar_codigo_referencia();

-- ------------------------------------------------------------
-- 4.2 Gerar código de confirmação (8 caracteres alfanuméricos)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION gerar_codigo_conclusao()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'confirmada' AND OLD.estado != 'confirmada' THEN
        NEW.codigo_conclusao := UPPER(
            SUBSTRING(
                encode(gen_random_bytes(4), 'hex'),
                1, 8
            )
        );
        NEW.data_confirmacao := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_codigo_conclusao ON inscricoes;
CREATE TRIGGER trg_gerar_codigo_conclusao
    BEFORE UPDATE ON inscricoes
    FOR EACH ROW
    EXECUTE FUNCTION gerar_codigo_conclusao();

-- ------------------------------------------------------------
-- 4.3 Auto-atualizar timestamp atualizado_em
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inscricoes_updated_at ON inscricoes;
CREATE TRIGGER trg_inscricoes_updated_at
    BEFORE UPDATE ON inscricoes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_utilizadores_updated_at ON utilizadores;
CREATE TRIGGER trg_utilizadores_updated_at
    BEFORE UPDATE ON utilizadores
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_configuracoes_updated_at ON configuracoes;
CREATE TRIGGER trg_configuracoes_updated_at
    BEFORE UPDATE ON configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

-- ------------------------------------------------------------
-- 4.4 Registrar histórico de estados automaticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_historico_estado()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        NEW.historico_estados := NEW.historico_estados || jsonb_build_object(
            'estado', NEW.estado,
            'timestamp', NOW()::TEXT,
            'nota', CASE
                WHEN NEW.estado = 'rejeitada' THEN NEW.motivo_rejeicao
                ELSE NULL
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registrar_historico_estado ON inscricoes;
CREATE TRIGGER trg_registrar_historico_estado
    BEFORE UPDATE ON inscricoes
    FOR EACH ROW
    EXECUTE FUNCTION registrar_historico_estado();

-- ------------------------------------------------------------
-- 4.5 Criar notificação automatica ao registar inscrição
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION notificar_nova_inscricao()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notificacoes (tipo, titulo, mensagem, inscricao_id)
    VALUES (
        'nova_inscricao',
        'Nova inscrição recebida',
        NEW.nome_completo || ' (' || NEW.perfil_label || ') inscreveu-se no curso.',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificar_nova_inscricao ON inscricoes;
CREATE TRIGGER trg_notificar_nova_inscricao
    AFTER INSERT ON inscricoes
    FOR EACH ROW
    EXECUTE FUNCTION notificar_nova_inscricao();

-- ------------------------------------------------------------
-- 4.6 Notificar ao confirmar pagamento
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION notificar_pagamento_confirmado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'confirmada' AND OLD.estado != 'confirmada' THEN
        INSERT INTO notificacoes (tipo, titulo, mensagem, inscricao_id)
        VALUES (
            'pagamento_confirmado',
            'Pagamento confirmado',
            'A inscrição de ' || NEW.nome_completo || ' foi confirmada.',
            NEW.id
        );
    ELSIF NEW.estado = 'rejeitada' AND OLD.estado != 'rejeitada' THEN
        INSERT INTO notificacoes (tipo, titulo, mensagem, inscricao_id)
        VALUES (
            'pagamento_rejeitado',
            'Pagamento rejeitado',
            'A inscrição de ' || NEW.nome_completo || ' foi rejeitada.',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificar_pagamento ON inscricoes;
CREATE TRIGGER trg_notificar_pagamento
    AFTER UPDATE ON inscricoes
    FOR EACH ROW
    EXECUTE FUNCTION notificar_pagamento_confirmado();

-- ------------------------------------------------------------
-- 4.7 Função para buscar estatísticas do dashboard
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_inscricoes', (SELECT COUNT(*) FROM inscricoes),
        'total_confirmadas', (SELECT COUNT(*) FROM inscricoes WHERE estado = 'confirmada'),
        'total_pendentes', (SELECT COUNT(*) FROM inscricoes WHERE estado = 'aguarda_confirmacao'),
        'total_rejeitadas', (SELECT COUNT(*) FROM inscricoes WHERE estado = 'rejeitada'),
        'total_novas', (SELECT COUNT(*) FROM inscricoes WHERE tipo_inscricao = 'nova'),
        'total_renovacoes', (SELECT COUNT(*) FROM inscricoes WHERE tipo_inscricao = 'renovacao'),
        'receita_confirmada', COALESCE((SELECT SUM(valor_total) FROM inscricoes WHERE estado = 'confirmada'), 0),
        'receita_pendente', COALESCE((SELECT SUM(valor_total) FROM inscricoes WHERE estado = 'aguarda_confirmacao'), 0),
        'por_perfil', (
            SELECT jsonb_object_agg(perfil, count)
            FROM (
                SELECT perfil, COUNT(*) as count
                FROM inscricoes
                GROUP BY perfil
            ) sub
        ),
        'por_estado', (
            SELECT jsonb_object_agg(estado, count)
            FROM (
                SELECT estado, COUNT(*) as count
                FROM inscricoes
                GROUP BY estado
            ) sub
        ),
        'por_pagamento', (
            SELECT jsonb_object_agg(modalidade_pagamento, count)
            FROM (
                SELECT modalidade_pagamento, COUNT(*) as count
                FROM inscricoes
                GROUP BY modalidade_pagamento
            ) sub
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4.8 Função para obter inscrição por código de referência
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION buscar_por_codigo(codigo TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', id,
        'nome_completo', nome_completo,
        'email', email,
        'telefone', telefone,
        'cidade', cidade,
        'perfil', perfil,
        'perfil_label', perfil_label,
        'estado', estado,
        'codigo_referencia', codigo_referencia,
        'codigo_conclusao', codigo_conclusao,
        'data_inscricao', data_inscricao,
        'data_confirmacao', data_confirmacao,
        'modalidade_pagamento', modalidade_pagamento,
        'numero_parcelas', numero_parcelas,
        'parcelas', parcelas,
        'tipo_inscricao', tipo_inscricao
    ) INTO result
    FROM inscricoes
    WHERE codigo_referencia = UPPER(codigo)
       OR codigo_conclusao = UPPER(codigo);

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4.9 Função para obter estatísticas de presenças
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_presenca_stats(sessao UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_conf INTEGER;
    total_presentes INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_conf
    FROM inscricoes WHERE estado = 'confirmada';

    SELECT COUNT(*) INTO total_presentes
    FROM presencas_registos
    WHERE sessao_id = sessao AND presente = true;

    SELECT jsonb_build_object(
        'total_confirmados', total_conf,
        'total_presentes', total_presentes,
        'total_ausentes', total_conf - total_presentes,
        'taxa_presenca', CASE
            WHEN total_conf > 0 THEN ROUND((total_presentes::NUMERIC / total_conf) * 100, 1)
            ELSE 0
        END
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4.10 Função para obter relatório mensal
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_relatorio_mensal(mes INTEGER, ano INTEGER)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'mes', mes,
        'ano', ano,
        'total_inscricoes', (
            SELECT COUNT(*) FROM inscricoes
            WHERE EXTRACT(MONTH FROM data_inscricao) = mes
              AND EXTRACT(YEAR FROM data_inscricao) = ano
        ),
        'novas', (
            SELECT COUNT(*) FROM inscricoes
            WHERE tipo_inscricao = 'nova'
              AND EXTRACT(MONTH FROM data_inscricao) = mes
              AND EXTRACT(YEAR FROM data_inscricao) = ano
        ),
        'renovacoes', (
            SELECT COUNT(*) FROM inscricoes
            WHERE tipo_inscricao = 'renovacao'
              AND EXTRACT(MONTH FROM data_inscricao) = mes
              AND EXTRACT(YEAR FROM data_inscricao) = ano
        ),
        'confirmadas', (
            SELECT COUNT(*) FROM inscricoes
            WHERE estado = 'confirmada'
              AND EXTRACT(MONTH FROM data_confirmacao) = mes
              AND EXTRACT(YEAR FROM data_confirmacao) = ano
        ),
        'receita_confirmada', COALESCE((
            SELECT SUM(valor_total) FROM inscricoes
            WHERE estado = 'confirmada'
              AND EXTRACT(MONTH FROM data_confirmacao) = mes
              AND EXTRACT(YEAR FROM data_confirmacao) = ano
        ), 0),
        'por_perfil', (
            SELECT COALESCE(jsonb_object_agg(perfil, count), '{}'::jsonb)
            FROM (
                SELECT perfil, COUNT(*) as count
                FROM inscricoes
                WHERE EXTRACT(MONTH FROM data_inscricao) = mes
                  AND EXTRACT(YEAR FROM data_inscricao) = ano
                GROUP BY perfil
            ) sub
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Ativar RLS em todas as tabelas
ALTER TABLE inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilizadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas_registos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5.1 Policies para INSCRICOES
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Qualquer pessoa pode criar inscricao" ON inscricoes;
DROP POLICY IF EXISTS "Consulta publica por codigo" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode ver todas inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode atualizar inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Admin pode eliminar inscricoes" ON inscricoes;
DROP POLICY IF EXISTS "Leitura publica de configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "Admin pode atualizar configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "Admin pode inserir configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "Admin pode ver utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Utilizador ve proprio perfil" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode criar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode atualizar utilizadores" ON utilizadores;
DROP POLICY IF EXISTS "Admin pode ver sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode criar sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode eliminar sessoes" ON presencas_sessoes;
DROP POLICY IF EXISTS "Admin pode ver registos presenca" ON presencas_registos;
DROP POLICY IF EXISTS "Admin pode gerir registos presenca" ON presencas_registos;
DROP POLICY IF EXISTS "Admin pode ver notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Admin pode atualizar notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Sistema pode criar notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Admin pode ver audit log" ON audit_log;
DROP POLICY IF EXISTS "Sistema pode criar audit log" ON audit_log;

-- Qualquer pessoa pode criar uma inscrição (landing page)
CREATE POLICY "Qualquer pessoa pode criar inscricao"
    ON inscricoes FOR INSERT
    WITH CHECK (true);

CREATE OR REPLACE FUNCTION consultar_inscricao_publica(p_codigo TEXT)
RETURNS TABLE (
    nome_completo TEXT,
    perfil TEXT,
    perfil_label TEXT,
    modalidade_pagamento TEXT,
    estado TEXT,
    codigo_referencia TEXT,
    codigo_conclusao TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT i.nome_completo, i.perfil, i.perfil_label, i.modalidade_pagamento,
           i.estado, i.codigo_referencia, i.codigo_conclusao
    FROM inscricoes i
    WHERE i.codigo_referencia = p_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION consultar_inscricao_publica(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consultar_inscricao_publica(TEXT) TO anon, authenticated;

-- Admins e operadores podem ver todas as inscrições
CREATE POLICY "Admin pode ver todas inscricoes"
    ON inscricoes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    );

-- Admin pode atualizar qualquer inscrição
CREATE POLICY "Admin pode atualizar inscricoes"
    ON inscricoes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    )
    WITH CHECK (true);

-- Admin pode eliminar inscrições
CREATE POLICY "Admin pode eliminar inscricoes"
    ON inscricoes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    );

-- ------------------------------------------------------------
-- 5.2 Policies para CONFIGURACOES
-- ------------------------------------------------------------
-- Todos podem ler as configurações (landing page precisa do IBAN, valores, etc.)
CREATE POLICY "Leitura publica de configuracoes"
    ON configuracoes FOR SELECT
    USING (true);

-- Apenas admin pode atualizar
CREATE POLICY "Admin pode atualizar configuracoes"
    ON configuracoes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    )
    WITH CHECK (true);

-- Apenas admin pode inserir
CREATE POLICY "Admin pode inserir configuracoes"
    ON configuracoes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    );

-- ------------------------------------------------------------
-- 5.3 Policies para UTILIZADORES
-- ------------------------------------------------------------
-- Admin pode ver todos os utilizadores
CREATE POLICY "Admin pode ver utilizadores"
    ON utilizadores FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    );

-- Utilizador pode ver o próprio perfil
CREATE POLICY "Utilizador ve proprio perfil"
    ON utilizadores FOR SELECT
    USING (id = auth.uid());

-- Admin pode criar utilizadores
CREATE POLICY "Admin pode criar utilizadores"
    ON utilizadores FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    );

-- Admin pode atualizar utilizadores
CREATE POLICY "Admin pode atualizar utilizadores"
    ON utilizadores FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    )
    WITH CHECK (true);

-- ------------------------------------------------------------
-- 5.4 Policies para PRESENCAS_SESSOES
-- ------------------------------------------------------------
-- Admin e operadores podem ver sessões
CREATE POLICY "Admin pode ver sessoes"
    ON presencas_sessoes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    );

-- Admin e operadores podem criar sessões
CREATE POLICY "Admin pode criar sessoes"
    ON presencas_sessoes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    );

-- Admin pode eliminar sessões
CREATE POLICY "Admin pode eliminar sessoes"
    ON presencas_sessoes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    );

-- ------------------------------------------------------------
-- 5.5 Policies para PRESENCAS_REGISTOS
-- ------------------------------------------------------------
-- Admin e operadores podem ver registos
CREATE POLICY "Admin pode ver registos presenca"
    ON presencas_registos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    );

-- Admin e operadores podem criar/atualizar registos
CREATE POLICY "Admin pode gerir registos presenca"
    ON presencas_registos FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    )
    WITH CHECK (true);

-- ------------------------------------------------------------
-- 5.6 Policies para NOTIFICACOES
-- ------------------------------------------------------------
-- Admin pode ver todas as notificações
CREATE POLICY "Admin pode ver notificacoes"
    ON notificacoes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    );

-- Admin pode atualizar notificações (marcar como lidas)
CREATE POLICY "Admin pode atualizar notificacoes"
    ON notificacoes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role IN ('admin', 'operador')
            AND ativo = true
        )
    )
    WITH CHECK (true);

-- Sistema pode criar notificações (via trigger)
CREATE POLICY "Sistema pode criar notificacoes"
    ON notificacoes FOR INSERT
    WITH CHECK (true);

-- ------------------------------------------------------------
-- 5.7 Policies para AUDIT_LOG
-- ------------------------------------------------------------
-- Apenas admin pode ver logs
CREATE POLICY "Admin pode ver audit log"
    ON audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM utilizadores
            WHERE id = auth.uid()
            AND role = 'admin'
            AND ativo = true
        )
    );

-- Sistema pode criar logs
CREATE POLICY "Sistema pode criar audit log"
    ON audit_log FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 6. DADOS INICIAIS
-- ============================================================

-- Inserir configuração padrão
INSERT INTO configuracoes (
    nome_curso,
    data_inicio,
    num_modulos,
    duracao,
    valor_total,
    parcelas,
    valor_parcela,
    regra_liberacao_codigo,
    iban,
    titular_iban,
    whatsapp_comprovativo,
    link_grupo
) SELECT
    'Design Gráfico',
    CURRENT_DATE + INTERVAL '30 days',
    18,
    '30 dias',
    45000.00,
    3,
    15000.00,
    'primeira_parcela',
    'AO06 0040 0000 1234 5678 1012 3',
    'Academia de Design Gráfico',
    '+244 923 456 789',
    ''
WHERE NOT EXISTS (SELECT 1 FROM configuracoes);

-- ============================================================
-- 7. VIEWS PARA FACILITAR CONSULTAS
-- ============================================================

-- View: Dashboard resumo
CREATE OR REPLACE VIEW vw_dashboard AS
SELECT
    (SELECT COUNT(*) FROM inscricoes) as total_inscricoes,
    (SELECT COUNT(*) FROM inscricoes WHERE estado = 'confirmada') as confirmadas,
    (SELECT COUNT(*) FROM inscricoes WHERE estado = 'aguarda_confirmacao') as pendentes,
    (SELECT COUNT(*) FROM inscricoes WHERE estado = 'rejeitada') as rejeitadas,
    (SELECT COALESCE(SUM(valor_total), 0) FROM inscricoes WHERE estado = 'confirmada') as receita_confirmada,
    (SELECT COALESCE(SUM(valor_total), 0) FROM inscricoes WHERE estado = 'aguarda_confirmacao') as receita_pendente;

-- View: Inscrições com contagem de parcelas pagas
CREATE OR REPLACE VIEW vw_inscricoes_completa AS
SELECT
    i.*,
    COALESCE(
        (SELECT COUNT(*) FROM jsonb_array_elements(i.parcelas) p WHERE p->>'estado' = 'confirmada'),
        0
    ) as parcelas_pagas,
    COALESCE(
        (SELECT SUM((p->>'valor')::NUMERIC) FROM jsonb_array_elements(i.parcelas) p WHERE p->>'estado' = 'confirmada'),
        0
    ) as valor_pago
FROM inscricoes i;

-- View: Presenças por sessão com estatísticas
CREATE OR REPLACE VIEW vw_presencas_resumo AS
SELECT
    s.id as sessao_id,
    s.titulo,
    s.data,
    (SELECT COUNT(*) FROM presencas_registos pr WHERE pr.sessao_id = s.id AND pr.presente = true) as presentes,
    (SELECT COUNT(*) FROM presencas_registos pr WHERE pr.sessao_id = s.id AND pr.presente = false) as ausentes,
    (SELECT COUNT(*) FROM inscricoes WHERE estado = 'confirmada') as total_confirmados,
    s.criado_em
FROM presencas_sessoes s
ORDER BY s.data DESC;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================

-- ============================================================
-- FASE 1 — Curso: schema para gestão de curso
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Novos campos na tabela configuracoes
-- ============================================================

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS localizacao TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS localizacao_link TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS data_confirmada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS descricao_curso TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS publico_alvo TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS ferramentas TEXT DEFAULT 'Illustrator, Photoshop, Affinity Designer';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS carga_horaria TEXT DEFAULT '60 horas';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS certificado TEXT DEFAULT 'Certificado de conclusão';

-- ============================================================
-- 2. Tabela modulos_curso
-- ============================================================

CREATE TABLE IF NOT EXISTS modulos_curso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fase INTEGER NOT NULL CHECK (fase IN (1, 2, 3)),
    fase_nome TEXT NOT NULL,
    numero INTEGER NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para ordenação
CREATE INDEX IF NOT EXISTS idx_modulos_curso_fase_ordem ON modulos_curso(fase, ordem);

-- ============================================================
-- 3. RLS para modulos_curso
-- ============================================================

ALTER TABLE modulos_curso ENABLE ROW LEVEL SECURITY;

-- Leitura pública (landing page e curso.html precisam de ler módulos)
DROP POLICY IF EXISTS "Leitura publica modulos" ON modulos_curso;
CREATE POLICY "Leitura publica modulos"
    ON modulos_curso FOR SELECT
    USING (true);

-- Admin pode gerir tudo
DROP POLICY IF EXISTS "Admin gere modulos" ON modulos_curso;
CREATE POLICY "Admin gere modulos"
    ON modulos_curso FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Permissões
GRANT SELECT ON modulos_curso TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON modulos_curso TO authenticated;

-- ============================================================
-- 4. Seed: 18 módulos do curso (3 fases)
-- ============================================================

-- Fase 1 — Fundamentos e Criação (7 módulos)
INSERT INTO modulos_curso (fase, fase_nome, numero, nome, descricao, ordem) VALUES
(1, 'Fundamentos e Criação', 1, 'Introdução ao Design Gráfico', 'O que é design gráfico, história, principais áreas de atuação e ferramentas do mercado.', 1),
(1, 'Fundamentos e Criação', 2, 'Fundamentos (elementos e princípios)', 'Linha, forma, textura, espaço, equilírio, contraste, ritmo e hierarquia visual.', 2),
(1, 'Fundamentos e Criação', 3, 'Cor', 'Teoria da cor, psicologia das cores, paletas profissionais e aplicações em design.', 3),
(1, 'Fundamentos e Criação', 4, 'Tipografia', 'Classificação de fontes, hierarquia tipográfica, emparelhamento e legibilidade.', 4),
(1, 'Fundamentos e Criação', 5, 'Composição e Layout', 'Regra dos terços, grid, fluxo visual, espaços negativos e composição eficaz.', 5),
(1, 'Fundamentos e Criação', 6, 'Imagem e Fotografia', 'Tipos de imagem, resolução, manipulação básica e uso profissional de fotografias.', 6),
(1, 'Fundamentos e Criação', 7, 'Ferramentas (Photoshop/Illustrator)', 'Interface, ferramentas essenciais, atalhos e fluxo de trabalho em cada aplicação.', 7);

-- Fase 2 — Comunicação e Identidade (5 módulos)
INSERT INTO modulos_curso (fase, fase_nome, numero, nome, descricao, ordem) VALUES
(2, 'Comunicação e Identidade', 8, 'Design para Redes Sociais', 'Criar posts, stories, banners e conteúdos visuais para Instagram, Facebook e LinkedIn.', 8),
(2, 'Comunicação e Identidade', 9, 'Design Publicitário', 'Anúncios, flyers, banners digitais e peças publicitárias de impacto.', 9),
(2, 'Comunicação e Identidade', 10, 'Identidade Visual', 'Conceito de identidade visual, manuais de normas e aplicação consistente.', 10),
(2, 'Comunicação e Identidade', 11, 'Logótipos', 'Processo criativo de criação de logótipos, do esboço ao vector final.', 11),
(2, 'Comunicação e Identidade', 12, 'Branding', 'Branding completo: nome, logo, cores, tipografia, aplicações e apresentação ao cliente.', 12);

-- Fase 3 — Mercado e Projeto Final (6 módulos)
INSERT INTO modulos_curso (fase, fase_nome, numero, nome, descricao, ordem) VALUES
(3, 'Mercado e Projeto Final', 13, 'Design Editorial', 'Livros, revistas, e-books, layouts editoriais e tipografia editorial.', 13),
(3, 'Mercado e Projeto Final', 14, 'Design para Impressão', 'Preparação de ficheiros para impressão, CMYK, Sangria, Perfil de cor.', 14),
(3, 'Mercado e Projeto Final', 15, 'Design para Negócios', 'Apresentações, propostas comerciais, cartões de visita e material corporativo.', 15),
(3, 'Mercado e Projeto Final', 16, 'Carreira e Freelancing', 'Portfolio, precificação, clientes, contrato e gestão de carreira freelance.', 16),
(3, 'Mercado e Projeto Final', 17, 'IA para Designers', 'Ferramentas de IA generativa, automação de workflow e integração no design.', 17),
(3, 'Mercado e Projeto Final', 18, 'Projeto Final Completo', 'Projecto prático real do início ao fim: briefing, conceito, execução e apresentação.', 18)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Atualizar configurações existentes com dados do curso
-- ============================================================

UPDATE configuracoes SET
    descricao_curso = 'Curso completo de Design Gráfico — 30 dias, 18 módulos, 3 fases. Aprende Illustrator, Photoshop e Affinity Designer na prática.',
    publico_alvo = 'Igrejas & Ministérios, Empresas, Freelancers e quem quiser aprender por conta própria.',
    carga_horaria = '60 horas',
    certificado = 'Certificado de conclusão',
    ferramentas = 'Illustrator, Photoshop, Affinity Designer'
WHERE descricao_curso IS NULL;

-- ============================================================
-- FIM
-- ============================================================

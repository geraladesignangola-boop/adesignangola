-- Turmas vinculadas a pacotes (1 pacote = 1 turma)
-- Cada turma tem dia, horário, modalidade e local
-- Vagas ficam na tabela pacotes (já existe)

CREATE TABLE IF NOT EXISTS turmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pacote_id UUID UNIQUE NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('presencial', 'online', 'híbrido')),
  localizacao TEXT DEFAULT '',
  localizacao_link TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turmas_select_public" ON turmas FOR SELECT USING (true);
CREATE POLICY "turmas_insert_auth" ON turmas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "turmas_update_auth" ON turmas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "turmas_delete_auth" ON turmas FOR DELETE USING (auth.uid() IS NOT NULL);

-- Adicionar turma_id á tabela inscricoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inscricoes' AND column_name = 'turma_id'
  ) THEN
    ALTER TABLE inscricoes ADD COLUMN turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Turmas de exemplo (vinculadas a pacotes existentes)
-- Executa APÓS os pacotes existirem, ou ignora erros
DO $$
DECLARE
  pac_normal UUID;
  pac_pro UUID;
  pac_online UUID;
BEGIN
  SELECT id INTO pac_normal FROM pacotes WHERE slug='normal' LIMIT 1;
  SELECT id INTO pac_pro FROM pacotes WHERE slug='pro' LIMIT 1;
  SELECT id INTO pac_online FROM pacotes WHERE slug='online' LIMIT 1;

  IF pac_normal IS NOT NULL THEN
    INSERT INTO turmas (pacote_id, dia_semana, hora_inicio, hora_fim, modalidade, localizacao, ordem)
    VALUES (pac_normal, 'Segunda e Quarta', '19:00', '21:00', 'presencial', 'Luanda, Angola', 1)
    ON CONFLICT (pacote_id) DO NOTHING;
  END IF;

  IF pac_pro IS NOT NULL THEN
    INSERT INTO turmas (pacote_id, dia_semana, hora_inicio, hora_fim, modalidade, localizacao, ordem)
    VALUES (pac_pro, 'Terça e Quinta', '19:00', '21:00', 'presencial', 'Luanda, Angola', 2)
    ON CONFLICT (pacote_id) DO NOTHING;
  END IF;

  IF pac_online IS NOT NULL THEN
    INSERT INTO turmas (pacote_id, dia_semana, hora_inicio, hora_fim, modalidade, localizacao, ordem)
    VALUES (pac_online, 'Sábado', '09:00', '13:00', 'online', 'Zoom/Google Meet', 3)
    ON CONFLICT (pacote_id) DO NOTHING;
  END IF;
END $$;

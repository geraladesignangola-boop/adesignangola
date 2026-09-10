-- Adicionar campos de modalidades de pagamento à tabela configuracoes
-- Express, PayPay e dados de contacto para pagamento

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS express_number TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS express_nome TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS paypal_email TEXT;

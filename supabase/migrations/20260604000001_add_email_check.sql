-- Migration: 20260604000001_add_email_check.sql

-- Adicionar constraint de formato (rejeita o '+')
alter table public.notify_subscribers
  add constraint notify_subscribers_email_format_chk
    check (email ~* '^[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}$');

-- Adicionar constraint de tamanho máximo
alter table public.notify_subscribers
  add constraint notify_subscribers_email_length_chk
    check (char_length(email) <= 254);

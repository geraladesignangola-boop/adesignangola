create table public.notify_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.notify_subscribers enable row level security;

create policy "anon can insert" on public.notify_subscribers
  for insert to anon
  with check (true);

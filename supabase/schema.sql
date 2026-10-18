-- Diário do Inglês: tabelas do Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto (Dashboard > SQL Editor > New query).
-- Cada pessoa só enxerga e altera as próprias linhas (Row Level Security).

-- Aulas concluídas (uma linha por aula, com a data de conclusão)
create table if not exists public.progress (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id    text not null,            -- ex.: "u3l2" = Basic, unidade 3, aula 2; "int-u1l4" = Intermediate
  completed_on date not null default current_date,
  primary key (user_id, lesson_id)
);

-- Dias marcados à mão como "estudei" (dias com aula concluída já contam sozinhos)
create table if not exists public.study_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

-- Anotações de cada unidade, por módulo (HTML do editor)
create table if not exists public.unit_notes (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module     text not null default 'basic',   -- basic, intermediate, independent
  unit       smallint not null check (unit between 1 and 99),
  html       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, module, unit)
);

-- Planejamento: data de início, tempo por dia e dias da semana (0 = domingo … 6 = sábado)
create table if not exists public.settings (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  start_date      date,
  minutes_per_day smallint   not null default 60 check (minutes_per_day between 0 and 720),
  study_weekdays  smallint[] not null default '{1,2,3,4,5}',
  updated_at    timestamptz not null default now()
);

alter table public.progress   enable row level security;
alter table public.study_days enable row level security;
alter table public.unit_notes enable row level security;
alter table public.settings   enable row level security;

drop policy if exists "dono" on public.progress;
drop policy if exists "dono" on public.study_days;
drop policy if exists "dono" on public.unit_notes;
drop policy if exists "dono" on public.settings;

create policy "dono" on public.progress   for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.study_days for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.unit_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono" on public.settings   for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.festivais add column if not exists tipo text not null default 'festival';
alter table public.festivais add column if not exists data_inicio date;
alter table public.festivais add column if not exists data_fim date;
alter table public.festivais add column if not exists cidade text not null default '';

create table public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references public.festivais(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null default auth.uid(),
  autor_nome text not null default '',
  texto text not null,
  criado_em timestamptz not null default now()
);
alter table public.anotacoes enable row level security;
create policy anot_ler on public.anotacoes for select to authenticated using (public.eh_equipe());
create policy anot_criar on public.anotacoes for insert to authenticated with check (public.eh_equipe() and autor_id = auth.uid());
create policy anot_apagar on public.anotacoes for delete to authenticated using (autor_id = auth.uid() or public.eh_master());

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references public.festivais(id) on delete set null,
  tipo text not null check (tipo in ('entrada','saida')),
  descricao text not null,
  categoria text not null default '',
  valor numeric(12,2) not null check (valor >= 0),
  data date not null default current_date,
  pago boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.lancamentos enable row level security;
create policy fin_master on public.lancamentos for all to authenticated using (public.eh_master()) with check (public.eh_master());

alter publication supabase_realtime add table public.anotacoes;
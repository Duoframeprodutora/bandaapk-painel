alter table public.equipe add column if not exists telefone text not null default '';
alter table public.equipe add column if not exists observacao text not null default '';
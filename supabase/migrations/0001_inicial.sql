-- Sistema Banda APK: estrutura inicial

create extension if not exists pgcrypto;

create type papel as enum ('master','vendas','musico');
create type status_inscricao as enum ('pendente','conferida','problema');

-- Perfis dos usuários da banda (ligados ao login)
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  papel papel,               -- null = sem acesso ainda
  funcao text default '',
  criado_em timestamptz not null default now()
);

-- Equipe (músicos e técnicos) para hotel e escalas; pode ou não ter login
create table public.equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  funcao text not null default '',
  tecnica boolean not null default false,
  ativo boolean not null default true,
  perfil_id uuid references public.perfis(id) on delete set null,
  ordem int not null default 0
);

create table public.festivais (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  cidade_datas text not null default '',
  horarios text not null default '',
  qtd_prevista text not null default '',
  prazo text not null default '',
  contato_ajuda text not null default '',
  inscricoes_abertas boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.dias (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivais(id) on delete cascade,
  nome text not null,
  ordem int not null default 0
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references public.dias(id) on delete cascade,
  nome text not null,
  ordem int not null default 0
);

create table public.inscricoes (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivais(id) on delete cascade,
  categoria_id uuid references public.categorias(id) on delete set null,
  nome text not null,
  whatsapp text not null default '',
  musica text not null,
  versao text not null default '',
  tom text not null,
  link text,
  audio_path text,
  observacao text not null default '',
  link_edicao text not null default '',
  status status_inscricao not null default 'pendente',
  problema text not null default '',
  ordem int not null default 0,
  token_edicao uuid not null default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.inscricoes(festival_id);

create table public.hospedagens (
  festival_id uuid primary key references public.festivais(id) on delete cascade,
  hotel text not null default '',
  endereco text not null default '',
  mapa text not null default '',
  contato text not null default '',
  tecnica text not null default '1',     -- 'nao' | '0' | '1' | '2' (dias antes)
  chegada_tecnica text not null default '',
  chegada_musicos text not null default '',
  checkin text not null default '',
  checkout text not null default '',
  combinado text not null default '',
  observacoes text not null default ''
);

create table public.quartos (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivais(id) on delete cascade,
  numero text not null default '',
  capacidade int not null default 2,
  ordem int not null default 0
);

create table public.quarto_pessoas (
  festival_id uuid not null references public.festivais(id) on delete cascade,
  equipe_id uuid not null references public.equipe(id) on delete cascade,
  quarto_id uuid not null references public.quartos(id) on delete cascade,
  primary key (festival_id, equipe_id)
);

create table public.notificacoes (
  id bigint generated always as identity primary key,
  festival_id uuid references public.festivais(id) on delete cascade,
  inscricao_id uuid references public.inscricoes(id) on delete cascade,
  texto text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ===== Funções de permissão =====
create or replace function public.meu_papel() returns papel
language sql stable security definer set search_path = public as
$$ select papel from public.perfis where id = auth.uid() $$;

create or replace function public.eh_equipe() returns boolean
language sql stable as $$ select public.meu_papel() is not null $$;

create or replace function public.eh_gestor() returns boolean
language sql stable as $$ select public.meu_papel() in ('master','vendas') $$;

create or replace function public.eh_master() returns boolean
language sql stable as $$ select public.meu_papel() = 'master' $$;

-- Primeiro usuário cadastrado vira Master; os outros entram sem acesso até o Master liberar
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''),
          case when exists (select 1 from public.perfis where papel = 'master') then null else 'master'::papel end);
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

create or replace function public.existe_master() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfis where papel = 'master') $$;
grant execute on function public.existe_master() to anon, authenticated;

-- ===== RLS =====
alter table public.perfis enable row level security;
alter table public.equipe enable row level security;
alter table public.festivais enable row level security;
alter table public.dias enable row level security;
alter table public.categorias enable row level security;
alter table public.inscricoes enable row level security;
alter table public.hospedagens enable row level security;
alter table public.quartos enable row level security;
alter table public.quarto_pessoas enable row level security;
alter table public.notificacoes enable row level security;

create policy perfis_ler on public.perfis for select to authenticated using (id = auth.uid() or public.eh_equipe());
create policy perfis_master on public.perfis for update to authenticated using (public.eh_master()) with check (public.eh_master());

create policy equipe_ler on public.equipe for select to authenticated using (public.eh_equipe());
create policy equipe_gestor on public.equipe for all to authenticated using (public.eh_master()) with check (public.eh_master());

create policy fest_ler on public.festivais for select to authenticated using (public.eh_equipe());
create policy fest_gestor on public.festivais for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());
create policy dias_ler on public.dias for select to authenticated using (public.eh_equipe());
create policy dias_gestor on public.dias for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());
create policy cat_ler on public.categorias for select to authenticated using (public.eh_equipe());
create policy cat_gestor on public.categorias for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());

create policy insc_ler on public.inscricoes for select to authenticated using (public.eh_equipe());
create policy insc_gestor on public.inscricoes for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());

create policy hosp_ler on public.hospedagens for select to authenticated using (public.eh_equipe());
create policy hosp_gestor on public.hospedagens for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());
create policy quartos_ler on public.quartos for select to authenticated using (public.eh_equipe());
create policy quartos_gestor on public.quartos for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());
create policy qp_ler on public.quarto_pessoas for select to authenticated using (public.eh_equipe());
create policy qp_gestor on public.quarto_pessoas for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());

create policy notif_master on public.notificacoes for all to authenticated using (public.eh_master()) with check (public.eh_master());

-- ===== Formulário público (candidatos, sem login) =====
create or replace function public.festival_publico(p_slug text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', f.id, 'nome', f.nome, 'cidade_datas', f.cidade_datas, 'prazo', f.prazo,
    'contato_ajuda', f.contato_ajuda, 'abertas', f.inscricoes_abertas,
    'opcoes', coalesce((select json_agg(json_build_object('categoria_id', c.id, 'categoria', c.nome, 'dia', d.nome) order by d.ordem, c.ordem)
       from public.dias d join public.categorias c on c.dia_id = d.id where d.festival_id = f.id), '[]'::json))
  from public.festivais f where f.slug = p_slug
$$;

create or replace function public.enviar_inscricao(
  p_slug text, p_categoria uuid, p_nome text, p_whatsapp text, p_musica text, p_versao text,
  p_tom text, p_link text, p_audio_path text, p_observacao text, p_link_edicao text, p_token uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare f public.festivais; t uuid; i public.inscricoes;
begin
  select * into f from public.festivais where slug = p_slug;
  if f.id is null then raise exception 'Festival não encontrado'; end if;
  if not f.inscricoes_abertas then raise exception 'As inscrições deste festival estão encerradas'; end if;
  if coalesce(trim(p_nome),'') = '' or coalesce(trim(p_musica),'') = '' or coalesce(trim(p_tom),'') = '' then
    raise exception 'Preencha nome, música e tom'; end if;
  if coalesce(trim(p_link),'') = '' and coalesce(trim(p_audio_path),'') = '' then
    raise exception 'Envie o link ou o áudio da música'; end if;
  if not exists (select 1 from public.categorias c join public.dias d on d.id = c.dia_id where c.id = p_categoria and d.festival_id = f.id) then
    raise exception 'Escolha o dia e a categoria'; end if;

  if p_token is not null then
    update public.inscricoes set categoria_id = p_categoria, nome = trim(p_nome), whatsapp = coalesce(p_whatsapp,''),
      musica = trim(p_musica), versao = coalesce(p_versao,''), tom = trim(p_tom), link = nullif(trim(p_link),''),
      audio_path = coalesce(nullif(trim(p_audio_path),''), audio_path), observacao = coalesce(p_observacao,''),
      link_edicao = coalesce(p_link_edicao,''), status = 'pendente', atualizado_em = now()
    where token_edicao = p_token and festival_id = f.id returning * into i;
    if i.id is null then raise exception 'Inscrição não encontrada'; end if;
    insert into public.notificacoes (festival_id, inscricao_id, texto)
      values (f.id, i.id, i.nome || ' alterou a inscrição (' || i.musica || ')');
    return i.token_edicao;
  end if;

  insert into public.inscricoes (festival_id, categoria_id, nome, whatsapp, musica, versao, tom, link, audio_path, observacao, link_edicao, ordem)
  values (f.id, p_categoria, trim(p_nome), coalesce(p_whatsapp,''), trim(p_musica), coalesce(p_versao,''), trim(p_tom),
          nullif(trim(p_link),''), nullif(trim(p_audio_path),''), coalesce(p_observacao,''), coalesce(p_link_edicao,''),
          (select coalesce(max(ordem),0)+1 from public.inscricoes where festival_id = f.id))
  returning * into i;
  insert into public.notificacoes (festival_id, inscricao_id, texto)
    values (f.id, i.id, 'Nova inscrição: ' || i.nome || ' · ' || i.musica);
  return i.token_edicao;
end $$;

create or replace function public.minha_inscricao(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('categoria_id', categoria_id, 'nome', nome, 'whatsapp', whatsapp, 'musica', musica,
    'versao', versao, 'tom', tom, 'link', link, 'audio_path', audio_path, 'observacao', observacao, 'link_edicao', link_edicao)
  from public.inscricoes where token_edicao = p_token
$$;

grant execute on function public.festival_publico(text) to anon, authenticated;
grant execute on function public.enviar_inscricao(text, uuid, text, text, text, text, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.minha_inscricao(uuid) to anon, authenticated;

-- Aviso ao Master quando a banda marca problema
create or replace function public.aviso_problema() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'problema' and old.status is distinct from 'problema' then
    insert into public.notificacoes (festival_id, inscricao_id, texto)
      values (new.festival_id, new.id, 'Problema na música de ' || new.nome || ': ' || coalesce(nullif(new.problema,''), new.musica));
  end if;
  return new;
end $$;
create trigger ao_marcar_problema after update of status on public.inscricoes
  for each row execute function public.aviso_problema();

-- ===== Áudios dos candidatos =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 31457280, array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/opus','audio/amr','audio/3gpp'])
on conflict (id) do nothing;

create policy audios_enviar on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'audios');
create policy audios_ouvir on storage.objects for select to authenticated
  using (bucket_id = 'audios' and public.eh_equipe());

-- Equipe inicial (informada pelo Gustavo)
insert into public.equipe (nome, funcao, tecnica, ordem) values
 ('Zequi','bateria',false,1),('Mille','baixo',false,2),('Éder','guitarra e violão',false,3),
 ('Teclado','teclado (a definir)',false,4),('Júlia','backing vocal',false,5),('Eraldo','backing vocal',false,6),
 ('Kiko','motorista',false,7),('Felipe','iluminador',true,8),('Facão','técnico',true,9),
 ('Fumaça','técnico',true,10),('Batata','técnico de som',true,11);

alter publication supabase_realtime add table public.notificacoes, public.inscricoes;

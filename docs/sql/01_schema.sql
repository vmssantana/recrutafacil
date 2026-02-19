-- RecrutaFácil - SQL (Schema)
-- Cole no Supabase > SQL Editor e execute.
-- (Tabelas: perfis, postos, vagas, candidatos, processos, pre_admissoes)

create extension if not exists "uuid-ossp";

create table if not exists public.perfis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  nome text,
  email text,
  perfil text default 'USUARIO',
  created_at timestamp default now()
);

create table if not exists public.postos (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique,
  nome_posto text not null,
  numero text,
  turno text,
  lotacao text,
  cidade text,
  supervisao text,
  ativo boolean default true,
  created_at timestamp default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.vagas (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique,
  posto_id uuid references public.postos(id) on delete cascade,
  motivo text,
  solicitante text,
  data_cadastro timestamp default now(),
  data_inicio date,
  status text default 'RASCUNHO',
  ativo boolean default true,
  created_at timestamp default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.candidatos (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique,
  nome_completo text not null,
  contato text,
  cargo_interesse text,
  cidade_interesse text,
  observacoes text,
  ativo boolean default true,
  created_at timestamp default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.processos (
  id uuid primary key default uuid_generate_v4(),
  vaga_id uuid references public.vagas(id) on delete cascade,
  candidato_id uuid references public.candidatos(id) on delete cascade,
  status text default 'EM ANALISE',
  data_vinculacao timestamp default now(),
  ativo boolean default true,
  created_at timestamp default now()
);

create table if not exists public.pre_admissoes (
  id uuid primary key default uuid_generate_v4(),
  vaga_id uuid references public.vagas(id) on delete cascade,
  candidato_id uuid references public.candidatos(id) on delete cascade,
  data_aprovacao timestamp default now(),
  status text default 'PENDENTE',
  observacoes text,
  created_at timestamp default now()
);

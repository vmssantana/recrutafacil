-- RecrutaFácil - RLS (todos veem tudo) + DELETE apenas ADMIN
-- 1) Execute este arquivo após criar as tabelas.

-- Ativar RLS
alter table public.perfis enable row level security;
alter table public.postos enable row level security;
alter table public.vagas enable row level security;
alter table public.candidatos enable row level security;
alter table public.processos enable row level security;
alter table public.pre_admissoes enable row level security;

-- Função: usuário é ADMIN?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.perfis
    where user_id = auth.uid() and perfil = 'ADMIN'
  );
$$;

-- Helper: políticas padrão (SELECT/INSERT/UPDATE para authenticated)
-- PERFIS
drop policy if exists rf_select_all on public.perfis;
create policy rf_select_all on public.perfis
for select to authenticated using (true);

drop policy if exists rf_insert_all on public.perfis;
create policy rf_insert_all on public.perfis
for insert to authenticated with check (true);

drop policy if exists rf_update_all on public.perfis;
create policy rf_update_all on public.perfis
for update to authenticated using (true) with check (true);

drop policy if exists rf_delete_admin on public.perfis;
create policy rf_delete_admin on public.perfis
for delete to authenticated using (public.is_admin());

-- POSTOS
drop policy if exists rf_select_all on public.postos;
create policy rf_select_all on public.postos
for select to authenticated using (true);

drop policy if exists rf_insert_all on public.postos;
create policy rf_insert_all on public.postos
for insert to authenticated with check (true);

drop policy if exists rf_update_all on public.postos;
create policy rf_update_all on public.postos
for update to authenticated using (true) with check (true);

drop policy if exists rf_delete_admin on public.postos;
create policy rf_delete_admin on public.postos
for delete to authenticated using (public.is_admin());

-- VAGAS
drop policy if exists rf_select_all on public.vagas;
create policy rf_select_all on public.vagas
for select to authenticated using (true);

drop policy if exists rf_insert_all on public.vagas;
create policy rf_insert_all on public.vagas
for insert to authenticated with check (true);

drop policy if exists rf_update_all on public.vagas;
create policy rf_update_all on public.vagas
for update to authenticated using (true) with check (true);

drop policy if exists rf_delete_admin on public.vagas;
create policy rf_delete_admin on public.vagas
for delete to authenticated using (public.is_admin());

-- CANDIDATOS
drop policy if exists rf_select_all on public.candidatos;
create policy rf_select_all on public.candidatos
for select to authenticated using (true);

drop policy if exists rf_insert_all on public.candidatos;
create policy rf_insert_all on public.candidatos
for insert to authenticated with check (true);

drop policy if exists rf_update_all on public.candidatos;
create policy rf_update_all on public.candidatos
for update to authenticated using (true) with check (true);

drop policy if exists rf_delete_admin on public.candidatos;
create policy rf_delete_admin on public.candidatos
for delete to authenticated using (public.is_admin());

-- PROCESSOS
drop policy if exists rf_select_all on public.processos;
create policy rf_select_all on public.processos
for select to authenticated using (true);

drop policy if exists rf_insert_all on public.processos;
create policy rf_insert_all on public.processos
for insert to authenticated with check (true);

drop policy if exists rf_update_all on public.processos;
create policy rf_update_all on public.processos
for update to authenticated using (true) with check (true);

drop policy if exists rf_delete_admin on public.processos;
create policy rf_delete_admin on public.processos
for delete to authenticated using (public.is_admin());

-- PRE_ADMISSOES
drop policy if exists rf_select_all on public.pre_admissoes;
create policy rf_select_all on public.pre_admissoes
for select to authenticated using (true);

drop policy if exists rf_insert_all on public.pre_admissoes;
create policy rf_insert_all on public.pre_admissoes
for insert to authenticated with check (true);

drop policy if exists rf_update_all on public.pre_admissoes;
create policy rf_update_all on public.pre_admissoes
for update to authenticated using (true) with check (true);

drop policy if exists rf_delete_admin on public.pre_admissoes;
create policy rf_delete_admin on public.pre_admissoes
for delete to authenticated using (public.is_admin());

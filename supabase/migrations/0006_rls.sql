-- 0006: Row Level Security
-- 원칙:
--   anon           : 정책 없음 → 전면 차단 (참여자는 Supabase 키로 DB를 직접 치지 않는다)
--   authenticated  : admin_users allowlist 에 있는 관리자만 SELECT 허용
--   service_role   : RLS 우회. 모든 쓰기는 서버 코드(requireAdmin/requireParticipant 이후)에서 수행
--   도메인 함수    : anon/authenticated 실행 권한 회수 (서버 전용)

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users a where a.id = auth.uid() and a.active)
$$;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_select on public.%I', t);
    execute format('create policy admin_select on public.%I for select to authenticated using (is_admin())', t);
  end loop;
end $$;

-- 관리자 본인 행 조회 (allowlist 확인용)
create policy self_select on admin_users for select to authenticated using (id = auth.uid());

-- 명시적 권한 (환경별 기본 ACL 차이에 의존하지 않는다)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from authenticated;

grant usage on schema public to authenticated, service_role;
grant select on all tables in schema public to authenticated;            -- RLS(is_admin) 가 행 단위로 제한
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on function is_admin() to authenticated;

-- 앞으로 생성되는 객체에도 동일 적용
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select, update on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

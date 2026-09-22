-- 0011: Claim Coding 초안 레이어 (연구자 지시 2026-09-22)
--
-- 연구자가 코딩을 처음부터 입력하는 대신, 사전 생성된 초안(claim 분할 + 코딩값)을 화면에서
-- 하나씩 확인·수정 후 저장하는 워크플로를 지원한다.
--
-- 규칙:
--   claim_codings.draft_source  : 초안 생성 주체(예: 'claude-fable-5-1/draft-v1'). null = 코더가 직접 입력.
--   claim_codings.draft_values  : 초안 원본값 스냅샷(jsonb). 코더가 값을 바꿔도 보존되어 초안-확정 일치율을 산출할 수 있다.
--   claim_codings.reviewed_at   : 코더가 화면에서 확인·저장한 시각. 초안 행은 null 로 생성되고 저장 시 채워진다.
--   coding_sessions.draft_source / draft_generated_at : 세션 단위 초안 출처·생성 시각.
--   확인되지 않은 초안(draft_source not null and reviewed_at is null)이 남아 있는 세션은 확정(finalized)할 수 없다 (트리거).
--   지표 뷰는 finalized 세션만 사용하므로 미확인 초안은 분석에 반영되지 않는다.

alter table claim_codings add column draft_source text null;
alter table claim_codings add column draft_values jsonb null;
alter table claim_codings add column reviewed_at timestamptz null;
comment on column claim_codings.draft_source is '초안 생성 주체. null = 코더 직접 입력';
comment on column claim_codings.draft_values is '초안 원본값 스냅샷 (코더 수정 전)';
comment on column claim_codings.reviewed_at is '코더가 확인·저장한 시각. 초안은 null 로 생성';

alter table coding_sessions add column draft_source text null;
alter table coding_sessions add column draft_generated_at timestamptz null;
comment on column coding_sessions.draft_source is '세션 초안 생성 주체';
comment on column coding_sessions.draft_generated_at is '세션 초안 생성 시각';

create index claim_codings_unreviewed_idx on claim_codings(claim_id) where draft_source is not null and reviewed_at is null;

create or replace function coding_sessions_guard_drafts() returns trigger
language plpgsql as $$
declare
  unreviewed int;
begin
  if new.status = 'finalized' and old.status is distinct from 'finalized' then
    select count(*) into unreviewed
    from claim_codings cc
    join response_claims c on c.id = cc.claim_id
    where c.coding_session_id = new.id
      and cc.coder_id = new.coder_id
      and cc.draft_source is not null
      and cc.reviewed_at is null;
    if unreviewed > 0 then
      raise exception 'UNREVIEWED_DRAFTS: 확인되지 않은 초안 코딩이 % 개 있어 확정할 수 없습니다', unreviewed
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger coding_sessions_guard_drafts before update on coding_sessions
  for each row execute function coding_sessions_guard_drafts();

-- 0003: 연구 무결성 트리거
-- RLS는 "누가"를 막고, 트리거는 "무엇을"을 막는다. service_role은 RLS를 우회하므로 불변성은 반드시 여기서 강제한다.
-- 세션 설정(트랜잭션 로컬)으로 예외를 허용한다:
--   app.admin_override        = 'on'  : 시작 후 순서그룹 변경, active 상태의 실험조건 변경
--   app.allow_structure_reset = 'on'  : 순서그룹 재생성(시작 전 배정 구조 삭제)
--   app.admin_id              = uuid  : 변경 주체 (study_settings / reference_event_versions 에 기록)
--   app.change_reason         = text  : 변경 사유

create or replace function app_setting(p_key text) returns text
language sql stable as $$
  select nullif(current_setting(p_key, true), '')
$$;

create or replace function app_admin_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.admin_id', true), '')::uuid
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function raise_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'APPEND_ONLY: % 테이블은 수정/삭제할 수 없습니다', tg_table_name using errcode = 'P0001';
end $$;

-- updated_at 자동 갱신
create trigger studies_updated_at before update on studies for each row execute function set_updated_at();
create trigger videos_updated_at before update on videos for each row execute function set_updated_at();
create trigger participants_updated_at before update on participants for each row execute function set_updated_at();
create trigger participant_demographics_updated_at before update on participant_demographics for each row execute function set_updated_at();
create trigger observations_updated_at before update on observations for each row execute function set_updated_at();
create trigger reference_events_updated_at before update on reference_events for each row execute function set_updated_at();
create trigger coding_sessions_updated_at before update on coding_sessions for each row execute function set_updated_at();
create trigger response_claims_updated_at before update on response_claims for each row execute function set_updated_at();
create trigger claim_codings_updated_at before update on claim_codings for each row execute function set_updated_at();

-- append-only 테이블
create trigger audit_logs_append_only before update or delete on audit_logs for each row execute function raise_append_only();
create trigger study_settings_append_only before update or delete on study_settings for each row execute function raise_append_only();
create trigger participant_consents_append_only before update or delete on participant_consents for each row execute function raise_append_only();
create trigger reference_event_versions_append_only before update or delete on reference_event_versions for each row execute function raise_append_only();

-- ---------------------------------------------------------------------------
-- 텍스트 통계 (TS lib/text-stats.ts 와 동일 규칙)
--   character_count : 공백·개행 제외 글자 수
--   word_count      : 공백 기준 토큰 수
--   sentence_count  : [.!?。] 또는 개행으로 분리한 비어 있지 않은 조각 수
-- ---------------------------------------------------------------------------
create or replace function compute_text_stats(p_text text)
returns table (character_count int, word_count int, sentence_count int)
language plpgsql immutable as $$
declare
  t text := coalesce(p_text, '');
begin
  character_count := char_length(regexp_replace(t, '\s', '', 'g'));
  word_count := (select count(*) from regexp_split_to_table(btrim(t), '\s+') w where w <> '');
  sentence_count := (select count(*) from regexp_split_to_table(t, '[.!?。]+|\n+') s where btrim(s) <> '');
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- observations 보호
-- ---------------------------------------------------------------------------
create or replace function observations_guard() returns trigger
language plpgsql as $$
declare
  allowed text[] := array['status','invalidated','invalidated_reason','invalidated_at','invalidated_by','technical_issue','updated_at'];
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  k text;
  stats record;
begin
  -- 무효화된 기록은 어떤 변경도 금지
  if old.invalidated then
    raise exception 'INVALIDATED_IMMUTABLE: 무효화된 관찰기록은 변경할 수 없습니다';
  end if;

  -- 식별 컬럼 불변
  if new.study_id <> old.study_id or new.participant_id <> old.participant_id or new.video_id <> old.video_id
     or new.attempt_number <> old.attempt_number or new.is_practice <> old.is_practice
     or new.presentation_order is distinct from old.presentation_order
     or new.order_group_id is distinct from old.order_group_id then
    raise exception 'IDENTITY_IMMUTABLE: 관찰기록의 식별 컬럼은 변경할 수 없습니다';
  end if;

  -- started_at 은 1회만 설정 (리프레시로 타이머 리셋 금지)
  if old.started_at is not null and new.started_at is distinct from old.started_at then
    raise exception 'STARTED_AT_IMMUTABLE: 타이머 시작 시각은 변경할 수 없습니다';
  end if;
  if old.first_watch_completed_at is not null and new.first_watch_completed_at is distinct from old.first_watch_completed_at then
    raise exception 'FIRST_WATCH_IMMUTABLE';
  end if;

  -- 무효화 전환
  if new.invalidated and not old.invalidated then
    if new.invalidated_reason is null or btrim(new.invalidated_reason) = '' then
      raise exception 'INVALIDATION_REASON_REQUIRED';
    end if;
    new.invalidated_at := coalesce(new.invalidated_at, now());
    new.status := 'invalidated';
  elsif new.status = 'invalidated' then
    raise exception 'INVALIDATED_FLAG_REQUIRED: status=invalidated 는 invalidated=true 와 함께만 가능합니다';
  end if;

  -- 제출된 기록: 무효화/기술오류 플래그 외 변경 금지
  if old.status = 'submitted' then
    for k in select jsonb_object_keys(new_j) loop
      if not (k = any(allowed)) and (new_j -> k) is distinct from (old_j -> k) then
        raise exception 'SUBMITTED_IMMUTABLE: 제출된 관찰기록의 % 컬럼은 변경할 수 없습니다', k;
      end if;
    end loop;
    if new.status not in ('submitted', 'invalidated') then
      raise exception 'SUBMITTED_IMMUTABLE: 제출 상태는 되돌릴 수 없습니다';
    end if;
    return new;
  end if;

  -- 제출 전환: 작업본을 제출본으로 동결, 통계 계산
  if new.status = 'submitted' then
    if new.submission_type is null then
      raise exception 'SUBMISSION_TYPE_REQUIRED';
    end if;
    if new.started_at is null then
      raise exception 'NOT_STARTED: 시작되지 않은 관찰은 제출할 수 없습니다';
    end if;
    new.observation_text := coalesce(new.draft_text, '');
    new.submitted_at := coalesce(new.submitted_at, now());
    new.timed_out := (new.submission_type = 'timeout');
    select * into stats from compute_text_stats(new.observation_text);
    new.character_count := stats.character_count;
    new.word_count := stats.word_count;
    new.sentence_count := stats.sentence_count;
  end if;

  -- 상태 전이 유효성
  if old.status = 'pending' and new.status = 'in_progress' and new.started_at is null then
    raise exception 'STARTED_AT_REQUIRED: in_progress 전환에는 started_at 이 필요합니다';
  end if;
  if new.started_at is not null and old.started_at is null then
    new.status := case when new.status = 'submitted' then 'submitted' else 'in_progress' end;
    new.deadline_at := coalesce(new.deadline_at,
      new.started_at + make_interval(secs => (select max_observation_seconds from studies where id = new.study_id)));
  end if;

  return new;
end $$;

create trigger observations_guard before update on observations for each row execute function observations_guard();

create or replace function observations_no_delete() returns trigger
language plpgsql as $$
begin
  -- 시작 전 배정 구조 재생성 시에만, 미시작 pending 행 삭제 허용
  if app_setting('app.allow_structure_reset') = 'on' and old.status = 'pending' and old.started_at is null then
    return old;
  end if;
  raise exception 'NO_DELETE: 관찰기록은 삭제할 수 없습니다. 무효화(invalidated)를 사용하세요';
end $$;

create trigger observations_no_delete before delete on observations for each row execute function observations_no_delete();

-- 첫 본 관찰 시작 → 연구 구조 잠금
create or replace function observations_lock_structure() returns trigger
language plpgsql as $$
begin
  if new.started_at is not null and old.started_at is null and not new.is_practice then
    update studies set structure_locked_at = coalesce(structure_locked_at, now()) where id = new.study_id;
    update participants set started_at = coalesce(started_at, new.started_at),
      status = case when status in ('completed','withdrawn','technical_issue') then status else 'in_progress' end
      where id = new.participant_id;
  end if;
  return new;
end $$;

create trigger observations_lock_structure after update on observations for each row execute function observations_lock_structure();

-- ---------------------------------------------------------------------------
-- observation_events: append-only + 제출 후 유예 30초
-- ---------------------------------------------------------------------------
create or replace function observation_events_before_insert() returns trigger
language plpgsql as $$
declare
  o record;
begin
  select participant_id, video_id, status, invalidated, submitted_at into o from observations where id = new.observation_id;
  if not found then
    raise exception 'OBSERVATION_NOT_FOUND';
  end if;
  new.participant_id := o.participant_id;
  new.video_id := o.video_id;
  new.event_timestamp := coalesce(new.event_timestamp, now());
  if o.invalidated then
    raise exception 'OBSERVATION_CLOSED: 무효화된 관찰에는 이벤트를 추가할 수 없습니다';
  end if;
  if o.status = 'submitted' and new.event_type not in ('observation_submitted', 'timeout_submitted', 'draft_saved') then
    if now() > o.submitted_at + interval '30 seconds' then
      raise exception 'OBSERVATION_CLOSED: 제출 후 30초가 지난 이벤트는 저장하지 않습니다';
    end if;
    new.metadata_json := new.metadata_json || jsonb_build_object('late', true);
  end if;
  return new;
end $$;

create trigger observation_events_before_insert before insert on observation_events for each row execute function observation_events_before_insert();
create trigger observation_events_append_only before update or delete on observation_events for each row execute function raise_append_only();

-- ---------------------------------------------------------------------------
-- studies: 설정 변경 이력 + active 잠금 + 구조 잠금
-- ---------------------------------------------------------------------------
create or replace function studies_guard() returns trigger
language plpgsql as $$
declare
  experimental text[] := array['max_observation_seconds','first_watch_seek_enabled','first_watch_pause_enabled',
    'first_watch_text_enabled','replay_enabled','playback_rate','timer_mode','research_video_count'];
  settings_keys text[] := experimental || array['participant_target','practice_video_id','ai_runs_per_video',
    'mobile_allowed','watermark_enabled','consent_version','security_notice_version'];
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  k text;
  override boolean := app_setting('app.admin_override') = 'on';
begin
  if old.structure_locked_at is not null and new.structure_locked_at is distinct from old.structure_locked_at then
    raise exception 'STRUCTURE_LOCK_IMMUTABLE: 구조 잠금은 해제할 수 없습니다';
  end if;
  if old.structure_locked_at is not null and new.research_video_count <> old.research_video_count then
    raise exception 'STRUCTURE_LOCKED: 관찰이 시작된 뒤에는 영상 편수를 변경할 수 없습니다';
  end if;

  foreach k in array settings_keys loop
    if (new_j -> k) is distinct from (old_j -> k) then
      if old.status = 'active' and k = any(experimental) and not override then
        raise exception 'ACTIVE_STUDY_LOCKED: 진행 중인 연구의 실험조건(%)은 관리자 override 와 사유 없이 변경할 수 없습니다', k;
      end if;
      insert into study_settings (study_id, setting_key, old_value, new_value, changed_by, reason)
      values (old.id, k, old_j -> k, new_j -> k, app_admin_id(), app_setting('app.change_reason'));
    end if;
  end loop;

  if new.status = 'active' and old.status <> 'active' then
    new.settings_locked_at := coalesce(new.settings_locked_at, now());
  end if;
  return new;
end $$;

create trigger studies_guard before update on studies for each row execute function studies_guard();

create or replace function study_is_locked(p_study_id uuid) returns boolean
language sql stable as $$
  select structure_locked_at is not null from studies where id = p_study_id
$$;

-- ---------------------------------------------------------------------------
-- videos: 잠금 후 연구영상 집합 변경 금지, 제출 기록 있는 영상 파일 교체 금지
-- ---------------------------------------------------------------------------
create or replace function videos_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'research' and study_is_locked(old.study_id) then
      raise exception 'STRUCTURE_LOCKED: 관찰이 시작된 뒤에는 연구영상을 삭제할 수 없습니다';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.kind = 'research' and study_is_locked(new.study_id) then
      raise exception 'STRUCTURE_LOCKED: 관찰이 시작된 뒤에는 연구영상을 추가할 수 없습니다';
    end if;
    return new;
  end if;
  -- UPDATE
  if new.study_id <> old.study_id then
    raise exception 'IDENTITY_IMMUTABLE';
  end if;
  if study_is_locked(old.study_id) and (new.kind <> old.kind or new.active <> old.active) and old.kind = 'research' then
    raise exception 'STRUCTURE_LOCKED: 관찰이 시작된 뒤에는 연구영상 구성을 변경할 수 없습니다';
  end if;
  if new.storage_path is distinct from old.storage_path and old.storage_path is not null
     and exists (select 1 from observations where video_id = old.id and status = 'submitted') then
    raise exception 'VIDEO_IN_USE: 제출된 관찰기록이 있는 영상 파일은 교체할 수 없습니다. 새 영상으로 등록하세요';
  end if;
  return new;
end $$;

create trigger videos_guard before insert or update or delete on videos for each row execute function videos_guard();

-- ---------------------------------------------------------------------------
-- order_groups / items / assignments: 잠금 후 구조 변경 금지, position 범위, 그룹 일치
-- ---------------------------------------------------------------------------
create or replace function order_structure_guard() returns trigger
language plpgsql as $$
declare
  sid uuid;
begin
  if tg_table_name = 'order_groups' then
    sid := coalesce(new.study_id, old.study_id);
    -- 그룹당 목표 인원(P 파생값) 동기화는 잠금과 무관하게 허용
    if tg_op = 'UPDATE' and new.study_id = old.study_id and new.code = old.code
       and new.group_index = old.group_index and new.generation = old.generation then
      return new;
    end if;
  else
    select study_id into sid from order_groups where id = coalesce(new.order_group_id, old.order_group_id);
  end if;
  if study_is_locked(sid) then
    raise exception 'STRUCTURE_LOCKED: 관찰이 시작된 뒤에는 순서그룹 구조를 변경할 수 없습니다';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger order_groups_guard before insert or update or delete on order_groups for each row execute function order_structure_guard();
create trigger order_group_items_guard before insert or update or delete on order_group_items for each row execute function order_structure_guard();

create or replace function order_group_items_range() returns trigger
language plpgsql as $$
declare
  n int;
begin
  select s.research_video_count into n from order_groups g join studies s on s.id = g.study_id where g.id = new.order_group_id;
  if new.position > n then
    raise exception 'POSITION_OUT_OF_RANGE: position % 는 영상 편수 % 를 초과합니다', new.position, n;
  end if;
  return new;
end $$;

create trigger order_group_items_range before insert or update on order_group_items for each row execute function order_group_items_range();

create or replace function assignments_guard() returns trigger
language plpgsql as $$
declare
  n int;
  pg uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'ASSIGNMENT_IMMUTABLE: 배정은 수정할 수 없습니다. 재배정 함수를 사용하세요';
  end if;
  if tg_op = 'DELETE' then
    if app_setting('app.allow_structure_reset') = 'on' then
      return old;
    end if;
    raise exception 'ASSIGNMENT_IMMUTABLE: 배정은 삭제할 수 없습니다';
  end if;
  select research_video_count into n from studies where id = new.study_id;
  if new.presentation_order > n then
    raise exception 'POSITION_OUT_OF_RANGE';
  end if;
  select order_group_id into pg from participants where id = new.participant_id;
  if pg <> new.order_group_id then
    raise exception 'GROUP_MISMATCH: 참여자의 순서그룹과 배정 그룹이 다릅니다';
  end if;
  if not exists (
    select 1 from order_group_items i
    where i.order_group_id = new.order_group_id and i.position = new.presentation_order and i.video_id = new.video_id
  ) then
    raise exception 'GROUP_MISMATCH: 배정이 순서그룹 정의와 일치하지 않습니다';
  end if;
  return new;
end $$;

create trigger assignments_guard before insert or update or delete on participant_order_assignments for each row execute function assignments_guard();

create or replace function observations_before_insert() returns trigger
language plpgsql as $$
declare
  n int;
begin
  select research_video_count into n from studies where id = new.study_id;
  if not new.is_practice then
    if new.presentation_order > n then
      raise exception 'POSITION_OUT_OF_RANGE';
    end if;
    if not exists (
      select 1 from participant_order_assignments a
      where a.participant_id = new.participant_id and a.video_id = new.video_id and a.presentation_order = new.presentation_order
    ) then
      raise exception 'ASSIGNMENT_REQUIRED: 배정표에 없는 관찰은 생성할 수 없습니다';
    end if;
  end if;
  return new;
end $$;

create trigger observations_before_insert before insert on observations for each row execute function observations_before_insert();

-- ---------------------------------------------------------------------------
-- participants: 시작 후 순서그룹 변경은 override 필요, 삭제 금지
-- ---------------------------------------------------------------------------
create or replace function participants_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'NO_DELETE: 참여자는 삭제할 수 없습니다. withdrawn 처리하세요';
  end if;
  if new.study_id <> old.study_id or new.participant_code <> old.participant_code then
    raise exception 'IDENTITY_IMMUTABLE';
  end if;
  if new.order_group_id <> old.order_group_id then
    if old.started_at is not null then
      raise exception 'PARTICIPANT_STARTED: 관찰을 시작한 참여자의 순서그룹은 변경할 수 없습니다';
    end if;
    if app_setting('app.admin_override') is distinct from 'on' and app_setting('app.allow_structure_reset') is distinct from 'on' then
      raise exception 'ADMIN_OVERRIDE_REQUIRED: 순서그룹 변경은 관리자 함수(change_order_group)로만 가능합니다';
    end if;
  end if;
  return new;
end $$;

create trigger participants_guard before update or delete on participants for each row execute function participants_guard();

-- ---------------------------------------------------------------------------
-- ai_runs: 생성 결과 불변, 삭제 금지
-- ---------------------------------------------------------------------------
create or replace function ai_runs_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'NO_DELETE: AI 기술문은 삭제할 수 없습니다. 새 run 으로 대체(superseded_by)하세요';
  end if;
  if new.generated_text <> old.generated_text or new.prompt_text_snapshot <> old.prompt_text_snapshot
     or new.prompt_version_id <> old.prompt_version_id or new.video_id <> old.video_id
     or new.run_number <> old.run_number or new.generated_at is distinct from old.generated_at then
    raise exception 'AI_RUN_IMMUTABLE: AI 생성 결과는 변경할 수 없습니다';
  end if;
  return new;
end $$;

create trigger ai_runs_guard before update or delete on ai_runs for each row execute function ai_runs_guard();

-- ---------------------------------------------------------------------------
-- reference_events: 변경 전 스냅샷, 물리 삭제 금지(soft delete)
-- ---------------------------------------------------------------------------
create or replace function reference_events_version() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'USE_SOFT_DELETE: reference_events 는 deleted_at 으로 삭제 처리합니다';
  end if;
  insert into reference_event_versions (reference_event_id, operation, snapshot, changed_by)
  values (old.id, case when new.deleted_at is not null and old.deleted_at is null then 'delete' else 'update' end, to_jsonb(old), app_admin_id());
  return new;
end $$;

create trigger reference_events_version before update or delete on reference_events for each row execute function reference_events_version();

-- ---------------------------------------------------------------------------
-- response_claims: polymorphic 참조 검증
-- ---------------------------------------------------------------------------
create or replace function response_claims_source_check() returns trigger
language plpgsql as $$
begin
  if new.source_type = 'teacher' then
    if not exists (select 1 from observations where id = new.source_record_id and status = 'submitted' and not invalidated and not is_practice) then
      raise exception 'SOURCE_NOT_FOUND: 유효한 제출 관찰기록이 아닙니다';
    end if;
  else
    if not exists (select 1 from ai_runs where id = new.source_record_id) then
      raise exception 'SOURCE_NOT_FOUND: AI run 이 없습니다';
    end if;
  end if;
  return new;
end $$;

create trigger response_claims_source_check before insert or update on response_claims for each row execute function response_claims_source_check();
create trigger coding_sessions_source_check before insert or update on coding_sessions for each row execute function response_claims_source_check();

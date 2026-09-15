-- 0010: 참여자 전체 제한시간 도입 + 영상별 제한시간 선택화 (연구자 지시 2026-09-15)
--
-- 규칙:
--   studies.max_observation_seconds  : 영상 1편당 제한(초). null = 영상별 제한 없음.
--   studies.total_time_limit_seconds : 본 관찰 전체 제한(초, wall time). null = 전체 제한 없음.
--   participants.main_deadline_at    : 첫 본 관찰 started_at + total_time_limit_seconds (시작 시점 설정값 스냅샷, 1회 설정).
--   observations.deadline_at         : least(영상별 마감, 전체 마감). 둘 다 없으면 null (제한 없음).
--   전체 마감이 지난 뒤 시작한 관찰에는 전체 제한을 적용하지 않는다 (남은 영상은 계속 진행 허용,
--   started_after_total_deadline 플래그로 분석 시 구분). 연습 관찰에는 전체 제한을 적용하지 않는다.
--   전체 제한은 wall time 기준이다 (timer_mode 의 buffering 차감은 영상별 제한에만 적용).

-- ---------------------------------------------------------------------------
-- 1. 스키마
-- ---------------------------------------------------------------------------
alter table studies alter column max_observation_seconds drop not null;
alter table studies drop constraint studies_max_observation_seconds_check;
alter table studies add constraint studies_max_observation_seconds_check
  check (max_observation_seconds is null or max_observation_seconds between 30 and 3600);
alter table studies add column total_time_limit_seconds int null
  check (total_time_limit_seconds is null or total_time_limit_seconds between 60 and 86400);
comment on column studies.max_observation_seconds is '영상 1편당 제한시간(초). null = 영상별 제한 없음';
comment on column studies.total_time_limit_seconds is '본 관찰 전체 제한시간(초, wall time). 첫 본 관찰 첫 재생부터. null = 전체 제한 없음';

alter table participants add column main_deadline_at timestamptz null;
comment on column participants.main_deadline_at is '본 관찰 전체 마감 시각 = 첫 본 관찰 started_at + total_time_limit_seconds. 1회 설정';

-- ---------------------------------------------------------------------------
-- 2. studies_guard : 실험조건 목록에 total_time_limit_seconds 추가 + override NULL 처리 버그 수정
-- ---------------------------------------------------------------------------
create or replace function studies_guard() returns trigger
language plpgsql as $$
declare
  experimental text[] := array['max_observation_seconds','total_time_limit_seconds','first_watch_seek_enabled','first_watch_pause_enabled',
    'first_watch_text_enabled','replay_enabled','playback_rate','timer_mode','research_video_count'];
  settings_keys text[] := experimental || array['participant_target','practice_video_id','ai_runs_per_video',
    'mobile_allowed','watermark_enabled','consent_version','security_notice_version'];
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  k text;
  -- 설정이 한 번도 안 된 세션에서는 app_setting 이 NULL 이라 (NULL = 'on') 이 NULL 이 되어 잠금 검사가 건너뛰어졌다 → coalesce 로 고정
  override boolean := coalesce(app_setting('app.admin_override'), '') = 'on';
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

-- ---------------------------------------------------------------------------
-- 3. 관찰 시작 시 전체 마감 반영 (observations_guard 다음에 실행: 이름순 'g' < 't')
--    observations_guard 는 deadline_at = started_at + max_observation_seconds (null 이면 null) 를 넣는다.
-- ---------------------------------------------------------------------------
create or replace function observations_total_deadline() returns trigger
language plpgsql as $$
declare
  v_total int;
  v_deadline timestamptz;
  v_existing timestamptz;
  v_participant_started timestamptz;
begin
  if new.started_at is null or old.started_at is not null or new.is_practice then
    return new;
  end if;
  select total_time_limit_seconds into v_total from studies where id = new.study_id;
  if v_total is null then
    return new;
  end if;
  select main_deadline_at, started_at into v_existing, v_participant_started from participants where id = new.participant_id;
  -- 첫 본 관찰 started_at 기준. 이미 시작한 참여자(마감 미설정)는 participants.started_at 을 기준으로 한다.
  v_deadline := coalesce(v_existing, coalesce(v_participant_started, new.started_at) + make_interval(secs => v_total));
  if v_existing is null then
    update participants set main_deadline_at = v_deadline where id = new.participant_id;
  end if;
  -- 전체 마감 이후 시작한 관찰에는 전체 제한을 적용하지 않는다 (남은 영상 계속 진행 허용)
  if new.started_at <= v_deadline then
    new.deadline_at := least(new.deadline_at, v_deadline);
  end if;
  return new;
end $$;

create trigger observations_total_deadline before update on observations for each row execute function observations_total_deadline();

-- ---------------------------------------------------------------------------
-- 4. 타이머 상태: 반환 컬럼 추가 (total_deadline_at, total_remaining_seconds, limit_kind, started_after_total_deadline)
--    반환 타입 변경이므로 drop 후 재생성. 의존 뷰 v_observation_metrics 는 아래에서 재생성한다.
-- ---------------------------------------------------------------------------
drop view if exists v_observation_metrics;
drop function if exists observation_timer_state(uuid, timestamptz);

create or replace function observation_timer_state(p_observation_id uuid, p_now timestamptz default now())
returns table (
  started_at timestamptz, max_seconds int, timer_mode timer_mode,
  wall_elapsed_seconds numeric, buffering_seconds numeric, effective_elapsed_seconds numeric,
  remaining_seconds numeric, expired boolean, submitted boolean,
  total_deadline_at timestamptz, total_remaining_seconds numeric, limit_kind text, started_after_total_deadline boolean
)
language plpgsql stable as $$
declare
  o observations;
  v_max int;
  v_mode timer_mode;
  v_total_deadline timestamptz;
  v_total_limit int;
  ref timestamptz;
  per_video numeric;
  total_rem numeric;
begin
  select * into o from observations obs where obs.id = p_observation_id;
  if not found then
    raise exception 'OBSERVATION_NOT_FOUND';
  end if;
  select st.max_observation_seconds, st.timer_mode, st.total_time_limit_seconds into v_max, v_mode, v_total_limit from studies st where st.id = o.study_id;
  if not o.is_practice then
    select p.main_deadline_at into v_total_deadline from participants p where p.id = o.participant_id;
  end if;
  started_at := o.started_at;
  max_seconds := v_max;
  timer_mode := v_mode;
  submitted := o.status = 'submitted';
  total_deadline_at := v_total_deadline;
  started_after_total_deadline := o.started_at is not null and v_total_deadline is not null and o.started_at > v_total_deadline;

  if o.started_at is null then
    wall_elapsed_seconds := 0; buffering_seconds := 0; effective_elapsed_seconds := 0;
    -- 시작 전: 영상별 제한은 전체 시간, 전체 제한은 현재 남은 시간 (다른 영상 진행 중에도 계속 흐른다).
    -- 첫 본 관찰이라 전체 마감이 아직 없으면 설정값 전체를 보여준다. 마감이 이미 지났으면 이 관찰에는 전체 제한이 적용되지 않는다.
    total_rem := case when v_total_deadline is not null then
                        case when v_total_deadline > p_now then round(extract(epoch from (v_total_deadline - p_now))::numeric, 3) else null end
                      when not o.is_practice then v_total_limit::numeric
                      else null end;
    total_remaining_seconds := total_rem;
    remaining_seconds := least(v_max::numeric, total_rem);
    expired := false;
    limit_kind := case when remaining_seconds is null then 'none'
                       when v_max is not null and (total_rem is null or v_max <= total_rem) then 'video' else 'total' end;
    return next; return;
  end if;

  ref := least(coalesce(o.submitted_at, p_now), p_now);
  wall_elapsed_seconds := round(greatest(extract(epoch from (ref - o.started_at)), 0)::numeric, 3);
  buffering_seconds := coalesce(o.buffering_seconds, observation_buffering_seconds(p_observation_id, p_now));
  effective_elapsed_seconds := round(greatest(wall_elapsed_seconds - buffering_seconds, 0), 3);
  per_video := case when v_max is null then null
                    else round(v_max - case when v_mode = 'effective_time' then effective_elapsed_seconds else wall_elapsed_seconds end, 3) end;
  total_rem := case when v_total_deadline is null or started_after_total_deadline then null
                    else round(extract(epoch from (v_total_deadline - ref))::numeric, 3) end;
  total_remaining_seconds := total_rem;
  remaining_seconds := least(per_video, total_rem);
  expired := remaining_seconds is not null and remaining_seconds <= 0;
  limit_kind := case when remaining_seconds is null then 'none'
                     when per_video is not null and (total_rem is null or per_video <= total_rem) then 'video' else 'total' end;
  return next;
end $$;

create view v_observation_metrics with (security_invoker = true) as
select o.id as observation_id, o.study_id, o.participant_id, p.participant_code, p.is_valid as participant_valid,
       o.video_id, v.code as video_code, v.title_admin as video_title, g.code as order_group, o.presentation_order,
       o.attempt_number, o.is_practice, o.status, o.started_at, o.first_watch_completed_at, o.deadline_at, o.submitted_at,
       t.wall_elapsed_seconds, t.buffering_seconds, t.effective_elapsed_seconds, t.remaining_seconds, t.expired,
       o.first_watch_seconds, o.replay_count, o.pause_count, o.seek_count, o.page_hidden_count, o.page_hidden_seconds,
       o.submission_type, o.timed_out, o.technical_issue, o.invalidated, o.invalidated_reason,
       o.character_count, o.word_count, o.sentence_count, o.draft_saved_at, o.device_category, o.browser_category,
       o.created_at, o.updated_at,
       t.total_deadline_at, t.total_remaining_seconds, t.limit_kind, t.started_after_total_deadline
from observations o
join participants p on p.id = o.participant_id
join videos v on v.id = o.video_id
left join order_groups g on g.id = o.order_group_id
cross join lateral observation_timer_state(o.id) t;

-- 분석 마스터·참여자 진행 뷰: 전체 제한 관련 컬럼을 끝에 추가
create or replace view v_research_master with (security_invoker = true) as
select o.id as observation_id, o.study_id, p.participant_code, g.code as order_group, v.code as video_code, o.presentation_order,
       o.attempt_number,
       (o.status = 'submitted' and not o.invalidated and p.is_valid) as is_valid_record,
       o.started_at, o.first_watch_completed_at, o.submitted_at,
       o.wall_elapsed_seconds, o.effective_elapsed_seconds, o.first_watch_seconds, o.buffering_seconds,
       o.replay_count, o.pause_count, o.seek_count, o.page_hidden_count, o.page_hidden_seconds,
       o.submission_type, o.timed_out, o.observation_text, o.character_count, o.word_count, o.sentence_count,
       o.device_category, o.browser_category, o.technical_issue, o.invalidated, o.invalidated_reason,
       p.is_valid as participant_valid, p.status as participant_status,
       p.started_at as participant_started_at, p.main_deadline_at,
       (o.started_at is not null and p.main_deadline_at is not null and o.started_at > p.main_deadline_at) as started_after_total_deadline,
       case when o.started_at is null or p.started_at is null then null
            else round(extract(epoch from (o.started_at - p.started_at))::numeric, 3) end as seconds_since_participant_start
from observations o
join participants p on p.id = o.participant_id
join videos v on v.id = o.video_id
left join order_groups g on g.id = o.order_group_id
where not o.is_practice and o.status in ('submitted', 'invalidated');

create or replace view v_participant_progress with (security_invoker = true) as
select p.id as participant_id, p.study_id, p.participant_code, g.code as order_group, p.order_group_id, p.status, p.is_valid,
       (select count(*) from observations o where o.participant_id = p.id and not o.is_practice and not o.invalidated and o.status = 'submitted')::int as completed_count,
       t.video_count as target_count,
       (select round(avg(o.wall_elapsed_seconds)) from observations o where o.participant_id = p.id and not o.is_practice and not o.invalidated and o.status = 'submitted') as avg_wall_seconds,
       (select round(avg(o.effective_elapsed_seconds)) from observations o where o.participant_id = p.id and not o.is_practice and not o.invalidated and o.status = 'submitted') as avg_effective_seconds,
       exists (select 1 from observations o where o.participant_id = p.id and (o.technical_issue or o.invalidated)) as has_technical_issue,
       exists (select 1 from observations o where o.participant_id = p.id and o.status = 'in_progress') as has_in_progress,
       (select count(*) from participant_consents c where c.participant_id = p.id and c.consented) > 0 as has_consent,
       exists (select 1 from participant_demographics d where d.participant_id = p.id) as has_demographics,
       p.guide_acknowledged_at, p.practice_completed_at, p.started_at, p.completed_at, p.last_seen_at,
       p.replaced_participant_id, p.notes_admin, p.device_category, p.browser_category, p.created_at,
       p.main_deadline_at
from participants p
join order_groups g on g.id = p.order_group_id
join v_study_targets t on t.study_id = p.study_id;

-- ---------------------------------------------------------------------------
-- 5. 제출: timeout 마감 시각 = least(영상별 마감(+effective 모드 buffering), 전체 마감, now)
-- ---------------------------------------------------------------------------
create or replace function submit_observation(p_observation_id uuid, p_type submission_type, p_now timestamptz default now())
returns observations
language plpgsql security definer set search_path = public as $$
declare
  o observations;
  v_submitted_at timestamptz;
  v_buffering numeric;
  v_max int;
  v_mode timer_mode;
  v_total_deadline timestamptz;
  v_video_deadline timestamptz;
  v_replay int; v_pause int; v_seek int; v_hidden int; v_hidden_secs numeric;
  remaining_main int;
begin
  select * into o from observations where id = p_observation_id for update;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  if o.invalidated then raise exception 'OBSERVATION_INVALIDATED'; end if;
  if o.status = 'submitted' then
    return o; -- idempotent
  end if;
  if o.started_at is null then raise exception 'NOT_STARTED'; end if;
  if p_type = 'manual' and o.first_watch_completed_at is null then
    raise exception 'FIRST_WATCH_REQUIRED';
  end if;

  v_buffering := observation_buffering_seconds(p_observation_id, p_now);

  if p_type = 'timeout' then
    if o.deadline_at is null then
      raise exception 'NO_DEADLINE: 제한시간이 없는 관찰은 timeout 제출할 수 없습니다';
    end if;
    select st.max_observation_seconds, st.timer_mode into v_max, v_mode from studies st where st.id = o.study_id;
    if not o.is_practice then
      select p.main_deadline_at into v_total_deadline from participants p where p.id = o.participant_id;
      if v_total_deadline is not null and o.started_at > v_total_deadline then v_total_deadline := null; end if;
    end if;
    v_video_deadline := case when v_max is null then null
      else o.started_at + make_interval(secs => v_max) + case when v_mode = 'effective_time' then make_interval(secs => v_buffering) else interval '0' end end;
    v_submitted_at := least(v_video_deadline, v_total_deadline, p_now);
  else
    v_submitted_at := p_now;
  end if;

  select
    count(*) filter (where event_type = 'video_play' and (metadata_json->>'is_replay')::boolean is true),
    count(*) filter (where event_type = 'video_pause'),
    count(*) filter (where event_type = 'video_seek'),
    count(*) filter (where event_type = 'page_hidden'),
    coalesce(sum((metadata_json->>'hidden_ms')::numeric) filter (where event_type = 'page_visible'), 0) / 1000.0
  into v_replay, v_pause, v_seek, v_hidden, v_hidden_secs
  from observation_events where observation_id = p_observation_id and event_timestamp >= o.started_at;

  update observations set
    status = 'submitted',
    submission_type = p_type,
    submitted_at = v_submitted_at,
    wall_elapsed_seconds = round(extract(epoch from (v_submitted_at - started_at))::numeric, 3),
    buffering_seconds = v_buffering,
    effective_elapsed_seconds = round(greatest(extract(epoch from (v_submitted_at - started_at)) - v_buffering, 0)::numeric, 3),
    first_watch_seconds = case when first_watch_completed_at is null then null
      else round(extract(epoch from (first_watch_completed_at - started_at))::numeric, 3) end,
    replay_count = v_replay, pause_count = v_pause, seek_count = v_seek,
    page_hidden_count = v_hidden, page_hidden_seconds = round(v_hidden_secs, 3)
  where id = p_observation_id returning * into o;

  insert into observation_events (observation_id, participant_id, video_id, event_type, event_timestamp, metadata_json)
  values (o.id, o.participant_id, o.video_id,
    case when p_type = 'timeout' then 'timeout_submitted'::event_type else 'observation_submitted'::event_type end,
    p_now, jsonb_build_object('submission_type', p_type, 'server', true));

  if o.is_practice then
    update participants set status = case when status in ('invited','consented','onboarding') then 'practice_completed' else status end,
      practice_completed_at = coalesce(practice_completed_at, p_now)
    where id = o.participant_id;
  else
    select count(*) into remaining_main from observations
    where participant_id = o.participant_id and not is_practice and not invalidated and status <> 'submitted';
    if remaining_main = 0 then
      -- 세션은 유지한다 (완료 화면 표시). 영상 재열람은 진행단계 판정(complete)이 차단한다.
      update participants set status = 'completed', completed_at = coalesce(completed_at, p_now) where id = o.participant_id
        and status not in ('withdrawn','technical_issue');
    end if;
  end if;
  return o;
end $$;

-- ---------------------------------------------------------------------------
-- 6. 설정 갱신 함수: total_time_limit_seconds 허용
-- ---------------------------------------------------------------------------
create or replace function update_study_settings(p_study_id uuid, p_patch jsonb, p_admin_id uuid, p_reason text default null)
returns studies
language plpgsql security definer set search_path = public as $$
declare
  s studies;
  allowed text[] := array['participant_target','research_video_count','max_observation_seconds','total_time_limit_seconds','first_watch_seek_enabled',
    'first_watch_pause_enabled','first_watch_text_enabled','replay_enabled','playback_rate','practice_video_id',
    'ai_runs_per_video','mobile_allowed','timer_mode','watermark_enabled','consent_version','security_notice_version','name'];
  k text;
begin
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then raise exception 'SETTING_NOT_ALLOWED: %', k; end if;
  end loop;
  perform set_config('app.admin_id', p_admin_id::text, true);
  perform set_config('app.change_reason', coalesce(p_reason, ''), true);
  if p_reason is not null and btrim(p_reason) <> '' then
    perform set_config('app.admin_override', 'on', true);
  end if;
  select * into s from studies where id = p_study_id for update;
  if not found then raise exception 'STUDY_NOT_FOUND'; end if;
  s := jsonb_populate_record(s, p_patch);
  update studies set
    name = s.name, participant_target = s.participant_target, research_video_count = s.research_video_count,
    max_observation_seconds = s.max_observation_seconds, total_time_limit_seconds = s.total_time_limit_seconds,
    first_watch_seek_enabled = s.first_watch_seek_enabled,
    first_watch_pause_enabled = s.first_watch_pause_enabled, first_watch_text_enabled = s.first_watch_text_enabled,
    replay_enabled = s.replay_enabled, playback_rate = s.playback_rate, practice_video_id = s.practice_video_id,
    ai_runs_per_video = s.ai_runs_per_video, mobile_allowed = s.mobile_allowed, timer_mode = s.timer_mode,
    watermark_enabled = s.watermark_enabled, consent_version = s.consent_version, security_notice_version = s.security_notice_version
  where id = p_study_id returning * into s;
  -- 그룹당 목표 인원 동기화
  update order_groups g set target_participants = t.per_group_target from study_targets(p_study_id) t where g.study_id = p_study_id;
  perform record_audit(p_study_id, p_admin_id, 'study_setting_changed', 'study', p_study_id, null,
    jsonb_build_object('patch', p_patch, 'reason', p_reason));
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- 7. 현재 연구에 적용: 영상별 제한 해제, 전체 40분. 변경 이력은 studies_guard 가 study_settings 에 남긴다.
--    이미 본 관찰을 시작한 참여자는 participants.started_at + 40분을 전체 마감으로 두고,
--    진행 중인 관찰의 영상별 마감(5분)은 해제한 뒤 전체 마감을 적용한다.
-- ---------------------------------------------------------------------------
select set_config('app.admin_override', 'on', false);
select set_config('app.change_reason', '연구자 지시(2026-09-15): 영상별 제한시간 해제, 참여자 전체 제한시간 40분 도입', false);

update studies set max_observation_seconds = null, total_time_limit_seconds = 2400;

update participants p set main_deadline_at = p.started_at + make_interval(secs => s.total_time_limit_seconds)
from studies s
where s.id = p.study_id and s.total_time_limit_seconds is not null and p.started_at is not null and p.main_deadline_at is null;

update observations o set deadline_at = case when p.main_deadline_at is not null and o.started_at <= p.main_deadline_at then p.main_deadline_at else null end
from participants p, studies s
where p.id = o.participant_id and s.id = o.study_id and s.max_observation_seconds is null
  and o.status = 'in_progress' and not o.invalidated and not o.is_practice;

update observations o set deadline_at = null
from studies s
where s.id = o.study_id and s.max_observation_seconds is null and o.status = 'in_progress' and not o.invalidated and o.is_practice;

select set_config('app.admin_override', '', false);
select set_config('app.change_reason', '', false);

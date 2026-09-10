-- 0004: 도메인 SQL 함수 (단일 트랜잭션 원자성). 모두 SECURITY DEFINER, 서버(service_role)에서만 호출한다.

-- ---------------------------------------------------------------------------
-- 감사로그 기록 헬퍼
-- ---------------------------------------------------------------------------
create or replace function record_audit(
  p_study_id uuid, p_admin_id uuid, p_action audit_action, p_target_type text, p_target_id uuid,
  p_before jsonb default null, p_after jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into audit_logs (study_id, admin_id, action, target_type, target_id, before_json, after_json)
  values (p_study_id, p_admin_id, p_action, p_target_type, p_target_id, p_before, p_after)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 연구 목표치 (P, N, 그룹당 목표)
-- ---------------------------------------------------------------------------
create or replace function study_targets(p_study_id uuid)
returns table (participant_target int, video_count int, per_group_target int, balanced_possible boolean, total_observation_target int)
language sql stable as $$
  select participant_target, research_video_count,
         ceil(participant_target::numeric / research_video_count)::int,
         participant_target % research_video_count = 0,
         participant_target * research_video_count
  from studies where id = p_study_id
$$;

-- ---------------------------------------------------------------------------
-- 타이머 상태 (TS lib/timer.ts 와 동일 규칙)
--   buffering: buffer_start ~ buffer_end 쌍의 합. 짝 없는 start 는 다음 play/first_play_completed/제출 시각까지.
--   개별 buffering 구간 상한 60초. wall = (submitted_at 또는 now) - started_at.
-- ---------------------------------------------------------------------------
create or replace function observation_buffering_seconds(p_observation_id uuid, p_now timestamptz default now())
returns numeric
language plpgsql stable as $$
declare
  e record;
  open_at timestamptz := null;
  total numeric := 0;
  cap constant numeric := 60;
  end_at timestamptz;
  o record;
begin
  select started_at, submitted_at into o from observations where id = p_observation_id;
  if o.started_at is null then
    return 0;
  end if;
  end_at := least(coalesce(o.submitted_at, p_now), p_now);
  for e in
    select event_type, event_timestamp from observation_events
    where observation_id = p_observation_id
      and event_type in ('video_buffer_start','video_buffer_end','video_play','video_first_play_completed','video_pause','video_ended')
      and event_timestamp >= o.started_at and event_timestamp <= end_at
    order by event_timestamp, id
  loop
    if e.event_type = 'video_buffer_start' then
      if open_at is null then open_at := e.event_timestamp; end if;
    elsif open_at is not null then
      total := total + least(extract(epoch from (e.event_timestamp - open_at)), cap);
      open_at := null;
    end if;
  end loop;
  if open_at is not null then
    total := total + least(greatest(extract(epoch from (end_at - open_at)), 0), cap);
  end if;
  return round(total, 3);
end $$;

create or replace function observation_timer_state(p_observation_id uuid, p_now timestamptz default now())
returns table (
  started_at timestamptz, max_seconds int, timer_mode timer_mode,
  wall_elapsed_seconds numeric, buffering_seconds numeric, effective_elapsed_seconds numeric,
  remaining_seconds numeric, expired boolean, submitted boolean
)
language plpgsql stable as $$
declare
  o observations;
  v_max int;
  v_mode timer_mode;
  ref timestamptz;
begin
  select * into o from observations obs where obs.id = p_observation_id;
  if not found then
    raise exception 'OBSERVATION_NOT_FOUND';
  end if;
  select st.max_observation_seconds, st.timer_mode into v_max, v_mode from studies st where st.id = o.study_id;
  started_at := o.started_at;
  max_seconds := v_max;
  timer_mode := v_mode;
  submitted := o.status = 'submitted';
  if o.started_at is null then
    wall_elapsed_seconds := 0; buffering_seconds := 0; effective_elapsed_seconds := 0;
    remaining_seconds := v_max; expired := false;
    return next; return;
  end if;
  ref := least(coalesce(o.submitted_at, p_now), p_now);
  wall_elapsed_seconds := round(greatest(extract(epoch from (ref - o.started_at)), 0)::numeric, 3);
  buffering_seconds := coalesce(o.buffering_seconds, observation_buffering_seconds(p_observation_id, p_now));
  effective_elapsed_seconds := round(greatest(wall_elapsed_seconds - buffering_seconds, 0), 3);
  remaining_seconds := round(v_max - case when v_mode = 'effective_time' then effective_elapsed_seconds else wall_elapsed_seconds end, 3);
  expired := remaining_seconds <= 0;
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- 관찰 시작 (첫 재생) : started_at 1회 설정. 재호출은 idempotent.
-- ---------------------------------------------------------------------------
create or replace function start_observation(p_observation_id uuid, p_started_at timestamptz default now())
returns observations
language plpgsql security definer set search_path = public as $$
declare
  o observations;
begin
  select * into o from observations where id = p_observation_id for update;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  if o.invalidated then raise exception 'OBSERVATION_INVALIDATED'; end if;
  if o.status = 'submitted' then raise exception 'ALREADY_SUBMITTED'; end if;
  if o.started_at is not null then
    return o;
  end if;
  update observations set started_at = p_started_at, status = 'in_progress'
  where id = p_observation_id returning * into o;
  return o;
end $$;

-- ---------------------------------------------------------------------------
-- 제출 (manual / timeout). 이벤트에서 카운터 파생, 참여자 상태 전이, 세션 revoke.
-- ---------------------------------------------------------------------------
create or replace function submit_observation(p_observation_id uuid, p_type submission_type, p_now timestamptz default now())
returns observations
language plpgsql security definer set search_path = public as $$
declare
  o observations;
  t record;
  v_submitted_at timestamptz;
  v_buffering numeric;
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
    -- 마감 시각 = deadline_at (+ effective 모드면 buffering)
    v_submitted_at := o.deadline_at + case when (select timer_mode from studies where id = o.study_id) = 'effective_time'
      then make_interval(secs => v_buffering) else interval '0' end;
    v_submitted_at := least(v_submitted_at, p_now);
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

-- 만료된 진행 중 관찰을 timeout 제출로 마감 (lazy finalize / cron)
create or replace function finalize_expired_observations(p_participant_id uuid default null, p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  ts record;
begin
  for r in
    select o.id from observations o
    where o.status = 'in_progress' and o.started_at is not null and not o.invalidated
      and (p_participant_id is null or o.participant_id = p_participant_id)
  loop
    select * into ts from observation_timer_state(r.id, p_now);
    if ts.expired then
      perform submit_observation(r.id, 'timeout', p_now);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 순서그룹 생성/재생성 (N개 순환 라틴방진). 구조 잠금 전에만.
-- ---------------------------------------------------------------------------
create or replace function regenerate_order_groups(p_study_id uuid, p_admin_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  s studies;
  vids uuid[];
  n int;
  per_group int;
  g int; p int;
  gid uuid;
  gids uuid[] := '{}';
  before_j jsonb;
  prt record;
  idx int := 0;
  v_gen int;
begin
  select * into s from studies where id = p_study_id for update;
  if not found then raise exception 'STUDY_NOT_FOUND'; end if;
  if s.structure_locked_at is not null then
    raise exception 'STRUCTURE_LOCKED: 관찰이 시작된 뒤에는 순서그룹을 재생성할 수 없습니다';
  end if;
  n := s.research_video_count;
  select array_agg(id order by sort_order, code) into vids from videos where study_id = p_study_id and kind = 'research' and active;
  if coalesce(array_length(vids, 1), 0) <> n then
    raise exception 'VIDEO_COUNT_MISMATCH: 활성 연구영상 %편, 설정 편수 %편', coalesce(array_length(vids, 1), 0), n;
  end if;
  per_group := ceil(s.participant_target::numeric / n)::int;

  select coalesce(jsonb_agg(jsonb_build_object('code', g.code, 'items', (select jsonb_agg(v.code order by i.position) from order_group_items i join videos v on v.id = i.video_id where i.order_group_id = g.id))), '[]'::jsonb)
    into before_j from order_groups g where g.study_id = p_study_id;
  select coalesce(max(generation), 0) + 1 into v_gen from order_groups where study_id = p_study_id;

  perform set_config('app.allow_structure_reset', 'on', true);
  perform set_config('app.admin_id', p_admin_id::text, true);

  delete from observations where study_id = p_study_id and not is_practice and started_at is null and status = 'pending';
  if exists (select 1 from observations where study_id = p_study_id and not is_practice) then
    raise exception 'STRUCTURE_LOCKED: 이미 시작된 본 관찰이 있어 재생성할 수 없습니다';
  end if;
  delete from participant_order_assignments where study_id = p_study_id;
  -- 참여자가 기존 그룹을 참조하므로, 기존 그룹은 이름을 바꿔 두고 재배정 후 삭제한다.
  update order_groups set code = 'old' || generation || '-' || code, group_index = group_index + 1000 * generation
  where study_id = p_study_id and code not like 'old%';

  for g in 1..n loop
    insert into order_groups (study_id, code, group_index, target_participants, generation)
    values (p_study_id, 'O' || g, g, per_group, v_gen) returning id into gid;
    gids := gids || gid;
    for p in 1..n loop
      insert into order_group_items (order_group_id, position, video_id)
      values (gid, p, vids[((g - 1) + (p - 1)) % n + 1]);
    end loop;
  end loop;

  -- 기존 참여자(모두 미시작) 라운드로빈 재배정
  for prt in select id from participants where study_id = p_study_id order by created_at, participant_code loop
    gid := gids[(idx % n) + 1];
    idx := idx + 1;
    update participants set order_group_id = gid where id = prt.id;
    perform create_assignments_for_participant(prt.id);
  end loop;

  delete from order_group_items where order_group_id in (select id from order_groups where study_id = p_study_id and code like 'old%');
  delete from order_groups where study_id = p_study_id and code like 'old%';

  perform record_audit(p_study_id, p_admin_id, 'order_groups_regenerated', 'study', p_study_id,
    before_j, jsonb_build_object('generation', v_gen, 'groups', n, 'per_group_target', per_group, 'reassigned_participants', idx));
  return n;
end $$;

-- 참여자의 배정표 + 본 관찰(attempt 1) 생성 (그룹 정의 기준)
create or replace function create_assignments_for_participant(p_participant_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  prt participants;
  it record;
  cnt int := 0;
begin
  select * into prt from participants where id = p_participant_id;
  for it in select position, video_id from order_group_items where order_group_id = prt.order_group_id order by position loop
    insert into participant_order_assignments (study_id, participant_id, video_id, order_group_id, presentation_order)
    values (prt.study_id, prt.id, it.video_id, prt.order_group_id, it.position);
    insert into observations (study_id, participant_id, video_id, order_group_id, presentation_order, attempt_number, is_practice)
    values (prt.study_id, prt.id, it.video_id, prt.order_group_id, it.position, 1, false);
    cnt := cnt + 1;
  end loop;
  return cnt;
end $$;

-- 연습 관찰 보장 (연습영상이 설정된 경우)
create or replace function ensure_practice_observation(p_participant_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  prt participants;
  pv uuid;
  oid uuid;
begin
  select * into prt from participants where id = p_participant_id;
  select id into oid from observations where participant_id = p_participant_id and is_practice and not invalidated;
  if oid is not null then return oid; end if;
  select practice_video_id into pv from studies where id = prt.study_id;
  if pv is null then return null; end if;
  insert into observations (study_id, participant_id, video_id, is_practice, attempt_number)
  values (prt.study_id, prt.id, pv, true,
    coalesce((select max(attempt_number) from observations where participant_id = prt.id and video_id = pv), 0) + 1)
  returning id into oid;
  return oid;
end $$;

-- ---------------------------------------------------------------------------
-- 참여자 생성 (배정 + 관찰 + 연습 + audit)
-- ---------------------------------------------------------------------------
create or replace function create_participant_with_assignments(
  p_study_id uuid, p_code text, p_pin_hash text, p_order_group_id uuid, p_admin_id uuid,
  p_replaced_participant_id uuid default null, p_notes text default null
) returns participants
language plpgsql security definer set search_path = public as $$
declare
  prt participants;
  g order_groups;
begin
  select * into g from order_groups where id = p_order_group_id and study_id = p_study_id;
  if not found then raise exception 'ORDER_GROUP_NOT_FOUND'; end if;
  if not exists (select 1 from order_group_items where order_group_id = g.id) then
    raise exception 'ORDER_GROUP_EMPTY: 순서그룹에 영상이 배정되어 있지 않습니다. 먼저 순서그룹을 생성하세요';
  end if;
  insert into participants (study_id, participant_code, pin_hash, order_group_id, replaced_participant_id, notes_admin, created_by)
  values (p_study_id, upper(btrim(p_code)), p_pin_hash, p_order_group_id, p_replaced_participant_id, p_notes, p_admin_id)
  returning * into prt;
  perform create_assignments_for_participant(prt.id);
  perform ensure_practice_observation(prt.id);
  perform record_audit(p_study_id, p_admin_id, 'participant_created', 'participant', prt.id, null,
    jsonb_build_object('participant_code', prt.participant_code, 'order_group', g.code));
  return prt;
end $$;

-- 순서그룹 변경 (시작 전 참여자만)
create or replace function change_order_group(p_participant_id uuid, p_new_group_id uuid, p_admin_id uuid, p_reason text)
returns participants
language plpgsql security definer set search_path = public as $$
declare
  prt participants;
  old_code text; new_code text;
begin
  select * into prt from participants where id = p_participant_id for update;
  if not found then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  if prt.started_at is not null or exists (select 1 from observations where participant_id = prt.id and not is_practice and started_at is not null) then
    raise exception 'PARTICIPANT_STARTED: 관찰을 시작한 참여자의 순서그룹은 변경할 수 없습니다';
  end if;
  if prt.order_group_id = p_new_group_id then return prt; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'REASON_REQUIRED'; end if;
  select code into old_code from order_groups where id = prt.order_group_id;
  select code into new_code from order_groups where id = p_new_group_id and study_id = prt.study_id;
  if new_code is null then raise exception 'ORDER_GROUP_NOT_FOUND'; end if;

  perform set_config('app.allow_structure_reset', 'on', true);
  perform set_config('app.admin_override', 'on', true);
  delete from observations where participant_id = prt.id and not is_practice and status = 'pending' and started_at is null;
  delete from participant_order_assignments where participant_id = prt.id;
  update participants set order_group_id = p_new_group_id where id = prt.id returning * into prt;
  perform create_assignments_for_participant(prt.id);
  perform record_audit(prt.study_id, p_admin_id, 'participant_order_group_assigned', 'participant', prt.id,
    jsonb_build_object('order_group', old_code), jsonb_build_object('order_group', new_code, 'reason', p_reason));
  return prt;
end $$;

-- ---------------------------------------------------------------------------
-- 무효화 + 재시도 생성
-- ---------------------------------------------------------------------------
create or replace function invalidate_and_retry(p_observation_id uuid, p_reason text, p_admin_id uuid, p_create_retry boolean default true)
returns observations
language plpgsql security definer set search_path = public as $$
declare
  o observations;
  n observations;
begin
  select * into o from observations where id = p_observation_id for update;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  if o.invalidated then raise exception 'ALREADY_INVALIDATED'; end if;
  update observations set invalidated = true, invalidated_reason = p_reason, invalidated_by = p_admin_id, technical_issue = true
  where id = p_observation_id;
  perform record_audit(o.study_id, p_admin_id, 'observation_invalidated', 'observation', o.id,
    jsonb_build_object('status', o.status, 'attempt_number', o.attempt_number), jsonb_build_object('reason', p_reason));
  if not p_create_retry then
    return (select obs from observations obs where id = p_observation_id);
  end if;
  insert into observations (study_id, participant_id, video_id, order_group_id, presentation_order, attempt_number, is_practice)
  values (o.study_id, o.participant_id, o.video_id, o.order_group_id, o.presentation_order,
    (select max(attempt_number) from observations where participant_id = o.participant_id and video_id = o.video_id) + 1, o.is_practice)
  returning * into n;
  update participants set status = case when status = 'completed' then 'in_progress' else status end, completed_at = null
  where id = o.participant_id;
  perform record_audit(o.study_id, p_admin_id, 'observation_retry_created', 'observation', n.id,
    jsonb_build_object('previous_observation_id', o.id), jsonb_build_object('attempt_number', n.attempt_number));
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 참여자 관리
-- ---------------------------------------------------------------------------
create or replace function reset_participant_pin(p_participant_id uuid, p_pin_hash text, p_admin_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  update participants set pin_hash = p_pin_hash, pin_updated_at = now(), failed_pin_attempts = 0, locked_until = null
  where id = p_participant_id returning study_id into sid;
  if sid is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  update participant_sessions set revoked_at = now() where participant_id = p_participant_id and revoked_at is null;
  perform record_audit(sid, p_admin_id, 'participant_pin_reset', 'participant', p_participant_id);
end $$;

create or replace function withdraw_participant(p_participant_id uuid, p_admin_id uuid, p_reason text, p_status participant_status default 'withdrawn')
returns participants
language plpgsql security definer set search_path = public as $$
declare
  prt participants;
begin
  if p_status not in ('withdrawn', 'technical_issue') then raise exception 'INVALID_STATUS'; end if;
  select * into prt from participants where id = p_participant_id for update;
  if not found then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  update participants set status = p_status, is_valid = false, notes_admin = concat_ws(E'\n', notes_admin, p_reason)
  where id = p_participant_id returning * into prt;
  update participant_sessions set revoked_at = now() where participant_id = p_participant_id and revoked_at is null;
  perform record_audit(prt.study_id, p_admin_id, 'participant_withdrawn', 'participant', prt.id, null,
    jsonb_build_object('status', p_status, 'reason', p_reason));
  return prt;
end $$;

-- ---------------------------------------------------------------------------
-- 연구 설정 / 상태
-- ---------------------------------------------------------------------------
create or replace function update_study_settings(p_study_id uuid, p_patch jsonb, p_admin_id uuid, p_reason text default null)
returns studies
language plpgsql security definer set search_path = public as $$
declare
  s studies;
  allowed text[] := array['participant_target','research_video_count','max_observation_seconds','first_watch_seek_enabled',
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
    max_observation_seconds = s.max_observation_seconds, first_watch_seek_enabled = s.first_watch_seek_enabled,
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

create or replace function set_study_status(p_study_id uuid, p_new_status study_status, p_admin_id uuid, p_reason text default null)
returns studies
language plpgsql security definer set search_path = public as $$
declare
  s studies;
  ok boolean;
begin
  select * into s from studies where id = p_study_id for update;
  if not found then raise exception 'STUDY_NOT_FOUND'; end if;
  ok := case s.status
    when 'draft' then p_new_status in ('pilot','ready')
    when 'pilot' then p_new_status in ('draft','ready')
    when 'ready' then p_new_status in ('draft','pilot','active')
    when 'active' then p_new_status in ('paused','closed')
    when 'paused' then p_new_status in ('active','closed')
    when 'closed' then p_new_status in ('archived','active')
    when 'archived' then false
  end;
  if not ok then raise exception 'INVALID_STATUS_TRANSITION: % -> %', s.status, p_new_status; end if;
  if p_new_status = 'active' then
    if s.practice_video_id is null then raise exception 'PRACTICE_VIDEO_REQUIRED'; end if;
    if (select count(*) from videos where study_id = p_study_id and kind = 'research' and active and storage_path is not null) <> s.research_video_count then
      raise exception 'RESEARCH_VIDEOS_INCOMPLETE: 영상 파일이 등록된 연구영상 수가 설정 편수와 다릅니다';
    end if;
    if (select count(*) from order_groups where study_id = p_study_id) <> s.research_video_count then
      raise exception 'ORDER_GROUPS_INCOMPLETE: 순서그룹을 먼저 생성하세요';
    end if;
  end if;
  perform set_config('app.admin_id', p_admin_id::text, true);
  update studies set status = p_new_status where id = p_study_id returning * into s;
  perform record_audit(p_study_id, p_admin_id, 'study_status_changed', 'study', p_study_id,
    jsonb_build_object('status', s.status), jsonb_build_object('status', p_new_status, 'reason', p_reason));
  return s;
end $$;

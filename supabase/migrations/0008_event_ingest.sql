-- 0008: 이벤트 배치 수집 함수 (재전송 dedupe, 서버 시각 보정)
-- 입력 jsonb 배열 원소: {type, client_session_id, seq, client_timestamp, video_current_time_ms, metadata}
-- p_client_now : 클라이언트가 배치를 보낸 시각. event_timestamp = server_now - (client_now - client_timestamp), 보정 상한 60초.
create or replace function ingest_observation_events(
  p_observation_id uuid,
  p_events jsonb,
  p_client_now timestamptz default null,
  p_server_now timestamptz default now()
) returns int
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  o record;
  inserted int := 0;
  v_client_ts timestamptz;
  v_ts timestamptz;
  v_delta interval;
  v_type event_type;
begin
  select participant_id, video_id into o from observations where id = p_observation_id;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  for e in select * from jsonb_array_elements(p_events) loop
    begin
      v_type := (e->>'type')::event_type;
    exception when others then
      continue; -- 알 수 없는 타입은 무시
    end;
    v_client_ts := nullif(e->>'client_timestamp', '')::timestamptz;
    v_ts := p_server_now;
    if v_client_ts is not null and p_client_now is not null then
      v_delta := p_client_now - v_client_ts;
      if v_delta > interval '60 seconds' then v_delta := interval '60 seconds'; end if;
      if v_delta < interval '0' then v_delta := interval '0'; end if;
      v_ts := p_server_now - v_delta;
    end if;
    insert into observation_events (observation_id, participant_id, video_id, event_type, event_timestamp, client_timestamp,
                                    client_session_id, seq, video_current_time_ms, metadata_json)
    values (p_observation_id, o.participant_id, o.video_id, v_type, v_ts, v_client_ts,
            nullif(e->>'client_session_id', '')::uuid, (e->>'seq')::int, (e->>'video_current_time_ms')::int,
            coalesce(e->'metadata', '{}'::jsonb))
    on conflict (observation_id, client_session_id, seq) where client_session_id is not null do nothing;
    if found then inserted := inserted + 1; end if;
  end loop;
  return inserted;
end $$;

-- 서버가 직접 기록하는 이벤트 (video_first_play_started 등)
create or replace function record_server_event(
  p_observation_id uuid, p_type event_type, p_metadata jsonb default '{}'::jsonb, p_at timestamptz default now(), p_video_ms int default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o record;
  v_id bigint;
begin
  select participant_id, video_id into o from observations where id = p_observation_id;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  insert into observation_events (observation_id, participant_id, video_id, event_type, event_timestamp, video_current_time_ms, metadata_json)
  values (p_observation_id, o.participant_id, o.video_id, p_type, p_at, p_video_ms, p_metadata || '{"server": true}'::jsonb)
  returning id into v_id;
  return v_id;
end $$;

-- 첫 시청 완료 기록 (1회). 서버 검증은 호출자(서비스)가 수행.
create or replace function complete_first_watch(p_observation_id uuid, p_at timestamptz default now(), p_max_watched_ms int default null)
returns observations
language plpgsql security definer set search_path = public as $$
declare
  o observations;
begin
  select * into o from observations where id = p_observation_id for update;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  if o.first_watch_completed_at is not null then return o; end if;
  if o.started_at is null then raise exception 'NOT_STARTED'; end if;
  if o.status = 'submitted' then raise exception 'ALREADY_SUBMITTED'; end if;
  update observations set first_watch_completed_at = p_at where id = p_observation_id returning * into o;
  perform record_server_event(p_observation_id, 'video_first_play_completed', jsonb_build_object('max_watched_ms', p_max_watched_ms), p_at, p_max_watched_ms);
  return o;
end $$;

-- 자동저장 (revision 단조 증가). 반환: 저장된 revision
create or replace function save_observation_draft(p_observation_id uuid, p_text text, p_revision int, p_at timestamptz default now())
returns int
language plpgsql security definer set search_path = public as $$
declare
  o observations;
begin
  select * into o from observations where id = p_observation_id for update;
  if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
  if o.status = 'submitted' or o.invalidated then raise exception 'ALREADY_SUBMITTED'; end if;
  if o.first_watch_completed_at is null then raise exception 'FIRST_WATCH_REQUIRED'; end if;
  if p_revision <= o.draft_revision then return o.draft_revision; end if;
  update observations set draft_text = p_text, draft_revision = p_revision, draft_saved_at = p_at where id = p_observation_id;
  perform record_server_event(p_observation_id, 'draft_saved', jsonb_build_object('revision', p_revision, 'length', char_length(p_text)), p_at);
  return p_revision;
end $$;

grant execute on function ingest_observation_events(uuid, jsonb, timestamptz, timestamptz) to service_role;
grant execute on function record_server_event(uuid, event_type, jsonb, timestamptz, int) to service_role;
grant execute on function complete_first_watch(uuid, timestamptz, int) to service_role;
grant execute on function save_observation_draft(uuid, text, int, timestamptz) to service_role;

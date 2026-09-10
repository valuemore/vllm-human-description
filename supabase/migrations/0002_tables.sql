-- 0002: 테이블 정의 (PRD §35 전부 + 연구 규모 일반화 컬럼)
-- 원칙: 제출 원자료·이벤트·감사로그는 append-only, 목표치(P, N)는 studies 설정값에서 파생한다.

-- ---------------------------------------------------------------------------
-- studies : 연구 1건 + 연구 설정(컬럼형)
-- ---------------------------------------------------------------------------
create table studies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status study_status not null default 'draft',
  participant_target int not null default 20 check (participant_target >= 1),
  research_video_count int not null default 5 check (research_video_count between 2 and 20),
  max_observation_seconds int not null default 300 check (max_observation_seconds between 30 and 3600),
  first_watch_seek_enabled boolean not null default false,
  first_watch_pause_enabled boolean not null default false,
  first_watch_text_enabled boolean not null default false,
  replay_enabled boolean not null default true,
  playback_rate numeric(3,2) not null default 1.0 check (playback_rate > 0),
  practice_video_id uuid null,
  ai_runs_per_video int not null default 3 check (ai_runs_per_video between 1 and 5),
  mobile_allowed boolean not null default false,
  timer_mode timer_mode not null default 'effective_time',
  watermark_enabled boolean not null default true,
  consent_version text not null default 'v1',
  security_notice_version text not null default 'v1',
  settings_locked_at timestamptz null,
  structure_locked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column studies.participant_target is 'P: 목표 참여자 수 (증원은 언제든 가능)';
comment on column studies.research_video_count is 'N: 연구영상 편수 (구조 잠금 전에만 변경 가능)';
comment on column studies.structure_locked_at is '첫 본 관찰이 시작된 시각. 이후 영상 집합·순서그룹 구조 변경 금지';

-- 설정 변경 이력 (append-only)
create table study_settings (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  setting_key text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid null,
  reason text,
  created_at timestamptz not null default now()
);
create index study_settings_study_idx on study_settings(study_id, created_at desc);

-- ---------------------------------------------------------------------------
-- admin_users : Supabase Auth 사용자 allowlist
-- ---------------------------------------------------------------------------
create table admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'admin' check (role in ('admin', 'coder')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  study_id uuid null references studies(id),
  admin_id uuid null references admin_users(id),
  action audit_action not null,
  target_type text not null,
  target_id uuid null,
  before_json jsonb,
  after_json jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_study_idx on audit_logs(study_id, created_at desc);
create index audit_logs_target_idx on audit_logs(target_type, target_id);

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------
create table videos (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  code text not null,
  kind video_kind not null default 'research',
  title_admin text not null,
  storage_path text null unique,
  duration_ms int null check (duration_ms is null or duration_ms > 0),
  width int null,
  height int null,
  has_audio boolean not null default false,
  mime_type text not null default 'video/mp4',
  file_size_bytes bigint null,
  age_group text,
  activity_type text,
  complexity_level text,
  actor_count int,
  object_count int,
  description_admin text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, code)
);
create unique index videos_one_active_practice_idx on videos(study_id) where kind = 'practice' and active;
create index videos_study_kind_idx on videos(study_id, kind, active, sort_order);

alter table studies
  add constraint studies_practice_video_fk foreign key (practice_video_id) references videos(id) deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- order_groups / order_group_items : N개 순환 라틴방진
-- ---------------------------------------------------------------------------
create table order_groups (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  code text not null,
  group_index int not null check (group_index >= 1),
  target_participants int not null check (target_participants >= 1),
  generation int not null default 1,
  created_at timestamptz not null default now(),
  unique (study_id, code),
  unique (study_id, group_index)
);

create table order_group_items (
  id uuid primary key default gen_random_uuid(),
  order_group_id uuid not null references order_groups(id) on delete cascade,
  position int not null check (position >= 1),
  video_id uuid not null references videos(id),
  unique (order_group_id, position),
  unique (order_group_id, video_id)
);

-- ---------------------------------------------------------------------------
-- participants
-- ---------------------------------------------------------------------------
create table participants (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  participant_code text not null,
  pin_hash text not null,
  pin_updated_at timestamptz not null default now(),
  order_group_id uuid not null references order_groups(id),
  status participant_status not null default 'invited',
  is_valid boolean not null default true,
  replaced_participant_id uuid null references participants(id),
  guide_acknowledged_at timestamptz null,
  practice_completed_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  last_seen_at timestamptz null,
  failed_pin_attempts int not null default 0,
  locked_until timestamptz null,
  device_category text,
  browser_category text,
  user_agent_first text,
  notes_admin text,
  created_by uuid null references admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, participant_code)
);
create index participants_group_idx on participants(study_id, order_group_id) where is_valid;

create table participant_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  ip inet,
  user_agent text
);
create index participant_sessions_active_idx on participant_sessions(participant_id) where revoked_at is null;

create table participant_consents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  consent_type text not null check (consent_type in ('research', 'video_security')),
  consent_version text not null,
  items_json jsonb not null default '{}'::jsonb,
  consented boolean not null,
  consented_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index participant_consents_pid_idx on participant_consents(participant_id, consent_type);

create table participant_demographics (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references participants(id),
  teaching_experience_years int not null check (teaching_experience_years between 0 and 60),
  teaching_experience_months int not null check (teaching_experience_months between 0 and 11),
  current_child_age_group text not null,
  observation_record_frequency text not null,
  video_observation_experience text not null,
  generative_ai_experience text not null,
  extra_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 정본 배정표
create table participant_order_assignments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  participant_id uuid not null references participants(id),
  video_id uuid not null references videos(id),
  order_group_id uuid not null references order_groups(id),
  presentation_order int not null check (presentation_order >= 1),
  created_at timestamptz not null default now(),
  unique (participant_id, presentation_order),
  unique (participant_id, video_id)
);
create index poa_video_idx on participant_order_assignments(study_id, video_id, presentation_order);

-- ---------------------------------------------------------------------------
-- observations (PRD §36 + 보강)
-- ---------------------------------------------------------------------------
create table observations (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  participant_id uuid not null references participants(id),
  video_id uuid not null references videos(id),
  order_group_id uuid null references order_groups(id),
  presentation_order int null check (presentation_order is null or presentation_order >= 1),
  attempt_number int not null default 1 check (attempt_number >= 1),
  is_practice boolean not null default false,
  status observation_status not null default 'pending',
  started_at timestamptz null,
  first_watch_completed_at timestamptz null,
  deadline_at timestamptz null,
  submitted_at timestamptz null,
  wall_elapsed_seconds numeric(9,3) null,
  buffering_seconds numeric(9,3) null,
  effective_elapsed_seconds numeric(9,3) null,
  first_watch_seconds numeric(9,3) null,
  replay_count int not null default 0,
  pause_count int not null default 0,
  seek_count int not null default 0,
  page_hidden_count int not null default 0,
  page_hidden_seconds numeric(9,3) null,
  draft_text text not null default '',
  draft_revision int not null default 0,
  draft_saved_at timestamptz null,
  observation_text text null,
  character_count int null,
  word_count int null,
  sentence_count int null,
  submission_type submission_type null,
  timed_out boolean not null default false,
  technical_issue boolean not null default false,
  invalidated boolean not null default false,
  invalidated_reason text null,
  invalidated_at timestamptz null,
  invalidated_by uuid null references admin_users(id),
  device_category text,
  browser_category text,
  client_info jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, video_id, attempt_number),
  check (is_practice or presentation_order is not null),
  check (is_practice or order_group_id is not null),
  check (status <> 'submitted' or (submitted_at is not null and observation_text is not null and submission_type is not null)),
  check (not invalidated or invalidated_reason is not null),
  check (started_at is null or first_watch_completed_at is null or first_watch_completed_at >= started_at)
);
-- 활성(무효화되지 않은) attempt는 참여자×영상당 1개, 참여자×순서당 1개
create unique index observations_active_video_idx on observations(participant_id, video_id) where not invalidated and not is_practice;
create unique index observations_active_order_idx on observations(participant_id, presentation_order) where not invalidated and not is_practice;
create unique index observations_active_practice_idx on observations(participant_id) where not invalidated and is_practice;
create index observations_video_submitted_idx on observations(study_id, video_id) where status = 'submitted' and not invalidated and not is_practice;
create index observations_participant_idx on observations(participant_id, presentation_order);
create index observations_in_progress_idx on observations(study_id) where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- observation_events (append-only)
-- ---------------------------------------------------------------------------
create table observation_events (
  id bigserial primary key,
  observation_id uuid not null references observations(id),
  participant_id uuid not null references participants(id),
  video_id uuid not null references videos(id),
  event_type event_type not null,
  event_timestamp timestamptz not null default now(),
  client_timestamp timestamptz null,
  client_session_id uuid null,
  seq int null,
  video_current_time_ms int null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index observation_events_dedupe_idx on observation_events(observation_id, client_session_id, seq) where client_session_id is not null;
create index observation_events_obs_idx on observation_events(observation_id, event_timestamp, id);
create index observation_events_participant_idx on observation_events(participant_id, event_timestamp);

-- ---------------------------------------------------------------------------
-- AI 기술문 레이어
-- ---------------------------------------------------------------------------
create table ai_prompts (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  prompt_code text not null,
  version int not null check (version >= 1),
  prompt_text text not null,
  active boolean not null default false,
  notes text,
  created_by uuid null references admin_users(id),
  created_at timestamptz not null default now(),
  unique (study_id, prompt_code, version)
);
create unique index ai_prompts_one_active_idx on ai_prompts(study_id, prompt_code) where active;

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  video_id uuid not null references videos(id),
  run_number int not null check (run_number >= 1),
  provider text not null,
  model_name text not null,
  model_version_or_snapshot text,
  prompt_version_id uuid not null references ai_prompts(id),
  prompt_text_snapshot text not null,
  generated_text text not null,
  generated_at timestamptz null,
  generation_settings_json jsonb not null default '{}'::jsonb,
  input_description text,
  character_count int,
  word_count int,
  sentence_count int,
  superseded_by uuid null references ai_runs(id),
  notes text,
  created_by uuid null references admin_users(id),
  created_at timestamptz not null default now(),
  unique (study_id, video_id, prompt_version_id, run_number)
);
create index ai_runs_video_idx on ai_runs(study_id, video_id);

-- ---------------------------------------------------------------------------
-- Reference Annotation 레이어
-- ---------------------------------------------------------------------------
create table reference_events (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  video_id uuid not null references videos(id),
  event_code text not null,
  event_order int not null check (event_order >= 1),
  start_ms int null check (start_ms is null or start_ms >= 0),
  end_ms int null,
  actor text not null,
  action text not null,
  object text,
  body_part_or_tool text,
  relation text,
  previous_event_id uuid null references reference_events(id),
  temporal_relation text,
  reference_sentence text,
  behavior_category text,
  notes text,
  coder_id uuid null references admin_users(id),
  is_consensus boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_ms is null or start_ms is null or end_ms >= start_ms)
);
create unique index reference_events_code_idx on reference_events(video_id, event_code) where deleted_at is null;
create unique index reference_events_order_idx on reference_events(video_id, event_order) where deleted_at is null;

create table reference_event_versions (
  id bigserial primary key,
  reference_event_id uuid not null references reference_events(id),
  operation text not null check (operation in ('update', 'delete')),
  snapshot jsonb not null,
  changed_by uuid null,
  created_at timestamptz not null default now()
);
create index reference_event_versions_idx on reference_event_versions(reference_event_id, created_at desc);

-- Phase 3 확장용 (코더별 원자료)
create table reference_coder_records (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  video_id uuid not null references videos(id),
  coder_id uuid not null references admin_users(id),
  round int not null default 1,
  event_payload jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Claim Coding 레이어
-- ---------------------------------------------------------------------------
create table coding_sessions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id),
  coder_id uuid not null references admin_users(id),
  source_type source_type not null,
  source_record_id uuid not null,
  video_id uuid not null references videos(id),
  status text not null default 'open' check (status in ('open', 'finalized')),
  started_at timestamptz not null default now(),
  finalized_at timestamptz null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_record_id, coder_id)
);

create table response_claims (
  id uuid primary key default gen_random_uuid(),
  coding_session_id uuid not null references coding_sessions(id) on delete cascade,
  source_type source_type not null,
  source_record_id uuid not null,
  claim_order int not null check (claim_order >= 1),
  claim_text text not null,
  char_start int null,
  char_end int null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coding_session_id, claim_order)
);

create table claim_codings (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references response_claims(id) on delete cascade,
  coder_id uuid not null references admin_users(id),
  matched_reference_event_id uuid null references reference_events(id),
  support_type support_type not null,
  actor_accuracy accuracy_level null,
  action_accuracy accuracy_level null,
  object_accuracy accuracy_level null,
  temporal_accuracy accuracy_level null,
  granularity_score int null check (granularity_score is null or granularity_score between 1 and 3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id, coder_id)
);
create index claim_codings_ref_idx on claim_codings(matched_reference_event_id);

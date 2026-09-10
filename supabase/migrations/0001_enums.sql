-- 0001: 확장 및 열거형
create extension if not exists pgcrypto;

create type study_status as enum ('draft', 'pilot', 'ready', 'active', 'paused', 'closed', 'archived');

create type participant_status as enum (
  'invited', 'consented', 'onboarding', 'practice_completed',
  'in_progress', 'completed', 'withdrawn', 'technical_issue'
);

create type observation_status as enum ('pending', 'in_progress', 'submitted', 'invalidated');

create type submission_type as enum ('manual', 'timeout');

create type timer_mode as enum ('wall_time', 'effective_time');

create type video_kind as enum ('research', 'practice');

create type event_type as enum (
  'observation_started',
  'video_first_play_started',
  'video_first_play_completed',
  'video_play',
  'video_pause',
  'video_seek',
  'video_ended',
  'video_buffer_start',
  'video_buffer_end',
  'video_error',
  'page_hidden',
  'page_visible',
  'network_offline',
  'network_online',
  'draft_saved',
  'observation_submitted',
  'timeout_submitted',
  'first_watch_blocked_action',
  'first_watch_restarted'
);

create type source_type as enum ('teacher', 'ai');

create type support_type as enum (
  'observed', 'inference_supported', 'inference_unsupported', 'hallucination', 'unclear'
);

create type accuracy_level as enum ('correct', 'partial', 'incorrect', 'not_applicable');

create type audit_action as enum (
  'study_setting_changed',
  'study_status_changed',
  'video_uploaded',
  'video_replaced',
  'video_updated',
  'participant_created',
  'participant_updated',
  'participant_order_group_assigned',
  'participant_pin_reset',
  'participant_reset',
  'participant_withdrawn',
  'observation_invalidated',
  'observation_retry_created',
  'order_groups_regenerated',
  'reference_event_created',
  'reference_event_updated',
  'reference_event_deleted',
  'ai_prompt_created',
  'ai_prompt_updated',
  'ai_run_created',
  'ai_run_updated',
  'claim_created',
  'claim_updated',
  'claim_coding_created',
  'claim_coding_updated',
  'data_exported'
);

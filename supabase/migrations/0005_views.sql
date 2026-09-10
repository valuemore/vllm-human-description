-- 0005: 분석·대시보드·Export 기반 뷰. 모든 목표치는 studies 설정값(P, N)에서 파생한다.
-- security_invoker = true : 호출자의 RLS가 적용된다 (관리자만 조회 가능).

create view v_study_targets with (security_invoker = true) as
select s.id as study_id, s.code as study_code, s.status, s.participant_target, s.research_video_count as video_count,
       ceil(s.participant_target::numeric / s.research_video_count)::int as per_group_target,
       (s.participant_target % s.research_video_count = 0) as balanced_possible,
       s.participant_target * s.research_video_count as total_observation_target,
       s.structure_locked_at
from studies s;

-- 유효 교사 기록: 제출됨 + 무효화 아님 + 연습 아님 + 유효 참여자
create view v_valid_observations with (security_invoker = true) as
select o.*
from observations o
join participants p on p.id = o.participant_id
where o.status = 'submitted' and not o.invalidated and not o.is_practice and p.is_valid;

create view v_observation_metrics with (security_invoker = true) as
select o.id as observation_id, o.study_id, o.participant_id, p.participant_code, p.is_valid as participant_valid,
       o.video_id, v.code as video_code, v.title_admin as video_title, g.code as order_group, o.presentation_order,
       o.attempt_number, o.is_practice, o.status, o.started_at, o.first_watch_completed_at, o.deadline_at, o.submitted_at,
       t.wall_elapsed_seconds, t.buffering_seconds, t.effective_elapsed_seconds, t.remaining_seconds, t.expired,
       o.first_watch_seconds, o.replay_count, o.pause_count, o.seek_count, o.page_hidden_count, o.page_hidden_seconds,
       o.submission_type, o.timed_out, o.technical_issue, o.invalidated, o.invalidated_reason,
       o.character_count, o.word_count, o.sentence_count, o.draft_saved_at, o.device_category, o.browser_category,
       o.created_at, o.updated_at
from observations o
join participants p on p.id = o.participant_id
join videos v on v.id = o.video_id
left join order_groups g on g.id = o.order_group_id
cross join lateral observation_timer_state(o.id) t;

create view v_participant_progress with (security_invoker = true) as
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
       p.replaced_participant_id, p.notes_admin, p.device_category, p.browser_category, p.created_at
from participants p
join order_groups g on g.id = p.order_group_id
join v_study_targets t on t.study_id = p.study_id;

create view v_video_progress with (security_invoker = true) as
select v.id as video_id, v.study_id, v.code, v.title_admin, v.sort_order,
       (select count(*) from v_valid_observations o where o.video_id = v.id)::int as valid_count,
       t.participant_target as target_count,
       (select count(*) from observations o where o.video_id = v.id and not o.is_practice and o.invalidated)::int as invalidated_count
from videos v
join v_study_targets t on t.study_id = v.study_id
where v.kind = 'research' and v.active;

create view v_order_group_balance with (security_invoker = true) as
select g.id as order_group_id, g.study_id, g.code, g.group_index, g.target_participants, g.generation,
       (select string_agg(v.code, ' → ' order by i.position) from order_group_items i join videos v on v.id = i.video_id where i.order_group_id = g.id) as sequence,
       (select count(*) from participants p where p.order_group_id = g.id and p.is_valid)::int as assigned_valid,
       (select count(*) from participants p where p.order_group_id = g.id and p.is_valid and p.status = 'completed')::int as completed_valid,
       (select count(*) from participants p where p.order_group_id = g.id and not p.is_valid)::int as dropped
from order_groups g;

-- PRD §27 균형 검증 4항목 + 균형 가능 여부
create view v_order_balance_check with (security_invoker = true) as
with t as (select * from v_study_targets),
valid_p as (select p.id, p.study_id, p.order_group_id from participants p where p.is_valid),
per_video as (
  select v.study_id, v.id as video_id, count(a.id)::int as cnt
  from videos v left join participant_order_assignments a on a.video_id = v.id and a.participant_id in (select id from valid_p)
  where v.kind = 'research' and v.active group by v.study_id, v.id
),
per_cell as (
  select v.study_id, v.id as video_id, pos.position,
         (select count(*) from participant_order_assignments a where a.video_id = v.id and a.presentation_order = pos.position and a.participant_id in (select id from valid_p))::int as cnt
  from videos v join t on t.study_id = v.study_id
  cross join lateral generate_series(1, t.video_count) as pos(position)
  where v.kind = 'research' and v.active
),
per_group as (
  select g.study_id, g.id as order_group_id, (select count(*) from valid_p p where p.order_group_id = g.id)::int as cnt
  from order_groups g
)
select t.study_id, 'participant_video_count' as check_name,
       (select count(*) from valid_p p where p.study_id = t.study_id)::int as expected,
       (select count(*) from valid_p p where p.study_id = t.study_id
          and (select count(distinct a.video_id) from participant_order_assignments a where a.participant_id = p.id) = t.video_count)::int as actual,
       (select coalesce(bool_and((select count(distinct a.video_id) from participant_order_assignments a where a.participant_id = p.id) = t.video_count), true) from valid_p p where p.study_id = t.study_id) as pass,
       jsonb_build_object('videos_per_participant', t.video_count) as detail
from t
union all
select t.study_id, 'assignments_per_video',
       (select count(*) from valid_p p where p.study_id = t.study_id)::int,
       (select coalesce(min(cnt), 0) from per_video pv where pv.study_id = t.study_id)::int,
       (select coalesce(bool_and(pv.cnt = (select count(*) from valid_p p where p.study_id = t.study_id)), false) from per_video pv where pv.study_id = t.study_id),
       (select jsonb_object_agg(v.code, pv.cnt) from per_video pv join videos v on v.id = pv.video_id where pv.study_id = t.study_id)
from t
union all
select t.study_id, 'video_position_occurrence',
       t.per_group_target,
       (select coalesce(min(cnt), 0) from per_cell pc where pc.study_id = t.study_id)::int,
       (select coalesce(bool_and(pc.cnt = t.per_group_target), false) from per_cell pc where pc.study_id = t.study_id),
       (select jsonb_object_agg(v.code || '@' || pc.position, pc.cnt) from per_cell pc join videos v on v.id = pc.video_id where pc.study_id = t.study_id)
from t
union all
select t.study_id, 'group_valid_participants',
       t.per_group_target,
       (select coalesce(min(cnt), 0) from per_group pg where pg.study_id = t.study_id)::int,
       (select coalesce(bool_and(pg.cnt = t.per_group_target), false) from per_group pg where pg.study_id = t.study_id),
       (select jsonb_object_agg(g.code, pg.cnt) from per_group pg join order_groups g on g.id = pg.order_group_id where pg.study_id = t.study_id)
from t
union all
select t.study_id, 'balanced_possible',
       0, case when t.balanced_possible then 0 else t.participant_target % t.video_count end,
       t.balanced_possible,
       jsonb_build_object('participant_target', t.participant_target, 'video_count', t.video_count, 'per_group_target', t.per_group_target)
from t;

create view v_data_collection_complete with (security_invoker = true) as
select t.study_id,
       (select count(*) from participants p where p.study_id = t.study_id and p.is_valid and p.status = 'completed')::int as completed_valid_participants,
       t.participant_target,
       (select count(*) from v_valid_observations o where o.study_id = t.study_id)::int as valid_observations,
       t.total_observation_target,
       (select coalesce(bool_and(vp.valid_count >= t.participant_target), false) from v_video_progress vp where vp.study_id = t.study_id) as every_video_complete,
       (select coalesce(bool_and(
          case when t.balanced_possible then gb.completed_valid = t.per_group_target
               else gb.completed_valid between floor(t.participant_target::numeric / t.video_count) and t.per_group_target end), false)
        from v_order_group_balance gb where gb.study_id = t.study_id) as every_group_complete,
       (
         (select count(*) from participants p where p.study_id = t.study_id and p.is_valid and p.status = 'completed') >= t.participant_target
         and (select count(*) from v_valid_observations o where o.study_id = t.study_id) >= t.total_observation_target
         and (select coalesce(bool_and(vp.valid_count >= t.participant_target), false) from v_video_progress vp where vp.study_id = t.study_id)
         and (select coalesce(bool_and(
              case when t.balanced_possible then gb.completed_valid = t.per_group_target
                   else gb.completed_valid between floor(t.participant_target::numeric / t.video_count) and t.per_group_target end), false)
              from v_order_group_balance gb where gb.study_id = t.study_id)
       ) as complete
from v_study_targets t;

create view v_dashboard_kpi with (security_invoker = true) as
select t.study_id, t.study_code, t.status, t.participant_target, t.video_count, t.per_group_target, t.total_observation_target, t.structure_locked_at,
       (select count(*) from participants p where p.study_id = t.study_id and p.is_valid)::int as registered_participants,
       (select count(*) from participants p where p.study_id = t.study_id and p.is_valid and p.status = 'completed')::int as completed_participants,
       (select count(*) from participants p where p.study_id = t.study_id and p.is_valid and p.status in ('consented','onboarding','practice_completed','in_progress'))::int as in_progress_participants,
       (select count(*) from participants p where p.study_id = t.study_id and p.is_valid and p.status = 'invited')::int as not_started_participants,
       (select count(*) from participants p where p.study_id = t.study_id and not p.is_valid)::int as dropped_participants,
       (select count(*) from v_valid_observations o where o.study_id = t.study_id)::int as valid_observations,
       (select count(*) from observations o where o.study_id = t.study_id and not o.is_practice and (o.technical_issue or o.invalidated))::int as technical_issue_observations,
       (select count(*) from observations o where o.study_id = t.study_id and o.status = 'in_progress')::int as in_progress_observations,
       (select count(*) from ai_runs r where r.study_id = t.study_id)::int as ai_runs_total,
       (select count(*) from videos v where v.study_id = t.study_id and v.kind = 'research' and v.active
          and (select count(*) from ai_runs r where r.video_id = v.id) >= (select ai_runs_per_video from studies where id = t.study_id))::int as ai_videos_complete,
       (select count(distinct r.video_id) from reference_events r where r.study_id = t.study_id and r.deleted_at is null)::int as reference_videos_done,
       (select count(*) from videos v where v.study_id = t.study_id and v.kind = 'research' and v.active)::int as research_videos_registered,
       (select count(*) from videos v where v.study_id = t.study_id and v.kind = 'research' and v.active and v.storage_path is not null)::int as research_videos_uploaded,
       c.complete as data_collection_complete
from v_study_targets t
join v_data_collection_complete c on c.study_id = t.study_id;

-- 분석용 마스터: 1행 = 교사 × 영상 관찰 (제출·무효화 모두 포함, 플래그로 구분)
create view v_research_master with (security_invoker = true) as
select o.id as observation_id, o.study_id, p.participant_code, g.code as order_group, v.code as video_code, o.presentation_order,
       o.attempt_number,
       (o.status = 'submitted' and not o.invalidated and p.is_valid) as is_valid_record,
       o.started_at, o.first_watch_completed_at, o.submitted_at,
       o.wall_elapsed_seconds, o.effective_elapsed_seconds, o.first_watch_seconds, o.buffering_seconds,
       o.replay_count, o.pause_count, o.seek_count, o.page_hidden_count, o.page_hidden_seconds,
       o.submission_type, o.timed_out, o.observation_text, o.character_count, o.word_count, o.sentence_count,
       o.device_category, o.browser_category, o.technical_issue, o.invalidated, o.invalidated_reason,
       p.is_valid as participant_valid, p.status as participant_status
from observations o
join participants p on p.id = o.participant_id
join videos v on v.id = o.video_id
left join order_groups g on g.id = o.order_group_id
where not o.is_practice and o.status in ('submitted', 'invalidated');

-- 기술통계 요약 (PRD §32.1) : dimension = overall | participant | video | presentation_order
create view v_analysis_summary with (security_invoker = true) as
with base as (
  select o.study_id, p.participant_code, v.code as video_code, o.presentation_order,
         o.wall_elapsed_seconds, o.effective_elapsed_seconds, o.first_watch_seconds,
         o.character_count, o.word_count, o.sentence_count, o.replay_count, o.pause_count, o.seek_count, o.timed_out
  from v_valid_observations o join participants p on p.id = o.participant_id join videos v on v.id = o.video_id
)
select study_id, 'overall' as dimension, 'all' as key, count(*)::int as n,
       round(avg(wall_elapsed_seconds), 1) as avg_wall_seconds, round(avg(effective_elapsed_seconds), 1) as avg_effective_seconds,
       round(avg(first_watch_seconds), 1) as avg_first_watch_seconds,
       round(avg(character_count), 1) as avg_characters, round(avg(word_count), 1) as avg_words, round(avg(sentence_count), 1) as avg_sentences,
       round(avg(replay_count), 2) as avg_replay, round(avg(pause_count), 2) as avg_pause, round(avg(seek_count), 2) as avg_seek,
       round(avg(case when timed_out then 1 else 0 end), 3) as timeout_rate
from base group by study_id
union all
select study_id, 'participant', participant_code, count(*)::int,
       round(avg(wall_elapsed_seconds), 1), round(avg(effective_elapsed_seconds), 1), round(avg(first_watch_seconds), 1),
       round(avg(character_count), 1), round(avg(word_count), 1), round(avg(sentence_count), 1),
       round(avg(replay_count), 2), round(avg(pause_count), 2), round(avg(seek_count), 2),
       round(avg(case when timed_out then 1 else 0 end), 3)
from base group by study_id, participant_code
union all
select study_id, 'video', video_code, count(*)::int,
       round(avg(wall_elapsed_seconds), 1), round(avg(effective_elapsed_seconds), 1), round(avg(first_watch_seconds), 1),
       round(avg(character_count), 1), round(avg(word_count), 1), round(avg(sentence_count), 1),
       round(avg(replay_count), 2), round(avg(pause_count), 2), round(avg(seek_count), 2),
       round(avg(case when timed_out then 1 else 0 end), 3)
from base group by study_id, video_code
union all
select study_id, 'presentation_order', presentation_order::text, count(*)::int,
       round(avg(wall_elapsed_seconds), 1), round(avg(effective_elapsed_seconds), 1), round(avg(first_watch_seconds), 1),
       round(avg(character_count), 1), round(avg(word_count), 1), round(avg(sentence_count), 1),
       round(avg(replay_count), 2), round(avg(pause_count), 2), round(avg(seek_count), 2),
       round(avg(case when timed_out then 1 else 0 end), 3)
from base group by study_id, presentation_order;

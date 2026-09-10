-- 0009: Phase 2 분석 뷰 (Claim Coding 기반 지표, Human Detection Rate, 코딩 진행률)
-- 지표 정의 (PRD §23):
--   factual claims      = support_type in (observed, hallucination)
--   Precision           = observed / factual
--   Hallucination rate  = hallucination / factual
--   Inference rate      = (inference_supported + inference_unsupported) / total claims
--   Recall              = distinct matched reference events (observed claims) / 영상의 reference events 수
--   Omission            = 1 - Recall,  F1 = 2PR/(P+R)
--   Temporal fidelity   = temporal_accuracy = correct / (correct+partial+incorrect)
--   Actor/Action/Object = 각 accuracy correct 비율 (not_applicable 제외)
--   Granularity         = 평균 granularity_score
-- 코더가 여러 명이면 coder 별 행이 생긴다. 웹은 기술통계만 제공한다.

create view v_coding_sources with (security_invoker = true) as
-- 코딩 대상 원문 목록: 유효 교사 관찰 + AI run
select o.study_id, 'teacher'::source_type as source_type, o.id as source_record_id, o.video_id, v.code as video_code,
       p.participant_code as source_label, null::int as run_number, o.observation_text as text, o.character_count
from observations o join participants p on p.id = o.participant_id join videos v on v.id = o.video_id
where o.status = 'submitted' and not o.invalidated and not o.is_practice and p.is_valid
union all
select r.study_id, 'ai'::source_type, r.id, r.video_id, v.code, r.model_name || ' #' || r.run_number, r.run_number, r.generated_text, r.character_count
from ai_runs r join videos v on v.id = r.video_id where r.superseded_by is null;

create view v_claim_metrics with (security_invoker = true) as
with claims as (
  select cs.study_id, cs.source_type, cs.source_record_id, cs.video_id, cs.coder_id, cs.status as session_status,
         c.id as claim_id, cc.support_type, cc.matched_reference_event_id, cc.actor_accuracy, cc.action_accuracy, cc.object_accuracy, cc.temporal_accuracy, cc.granularity_score
  from coding_sessions cs
  join response_claims c on c.coding_session_id = cs.id
  left join claim_codings cc on cc.claim_id = c.id and cc.coder_id = cs.coder_id
),
ref_counts as (
  select video_id, count(*)::int as reference_total from reference_events where deleted_at is null group by video_id
)
select cl.study_id, cl.source_type, cl.source_record_id, cl.video_id, v.code as video_code, cl.coder_id, cl.session_status,
       src.source_label, src.run_number,
       count(*)::int as claim_total,
       count(*) filter (where cl.support_type is not null)::int as claim_coded,
       count(*) filter (where cl.support_type = 'observed')::int as observed,
       count(*) filter (where cl.support_type = 'hallucination')::int as hallucination,
       count(*) filter (where cl.support_type = 'inference_supported')::int as inference_supported,
       count(*) filter (where cl.support_type = 'inference_unsupported')::int as inference_unsupported,
       count(*) filter (where cl.support_type = 'unclear')::int as unclear,
       count(distinct cl.matched_reference_event_id) filter (where cl.support_type = 'observed' and cl.matched_reference_event_id is not null)::int as matched_events,
       coalesce(rc.reference_total, 0) as reference_total,
       round(count(*) filter (where cl.support_type = 'observed')::numeric / nullif(count(*) filter (where cl.support_type in ('observed','hallucination')), 0), 3) as precision,
       round(count(distinct cl.matched_reference_event_id) filter (where cl.support_type = 'observed' and cl.matched_reference_event_id is not null)::numeric / nullif(rc.reference_total, 0), 3) as recall,
       round(count(*) filter (where cl.support_type = 'hallucination')::numeric / nullif(count(*) filter (where cl.support_type in ('observed','hallucination')), 0), 3) as hallucination_rate,
       round(count(*) filter (where cl.support_type in ('inference_supported','inference_unsupported'))::numeric / nullif(count(*) filter (where cl.support_type is not null), 0), 3) as inference_rate,
       round(count(*) filter (where cl.temporal_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.temporal_accuracy in ('correct','partial','incorrect')), 0), 3) as temporal_fidelity,
       round(count(*) filter (where cl.actor_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.actor_accuracy in ('correct','partial','incorrect')), 0), 3) as actor_accuracy,
       round(count(*) filter (where cl.action_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.action_accuracy in ('correct','partial','incorrect')), 0), 3) as action_accuracy,
       round(count(*) filter (where cl.object_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.object_accuracy in ('correct','partial','incorrect')), 0), 3) as object_accuracy,
       round(avg(cl.granularity_score), 2) as granularity_mean
from claims cl
join videos v on v.id = cl.video_id
left join ref_counts rc on rc.video_id = cl.video_id
left join v_coding_sources src on src.source_type = cl.source_type and src.source_record_id = cl.source_record_id
group by cl.study_id, cl.source_type, cl.source_record_id, cl.video_id, v.code, cl.coder_id, cl.session_status, src.source_label, src.run_number, rc.reference_total;

-- F1 / omission 은 precision·recall 에서 파생
create view v_claim_metrics_full with (security_invoker = true) as
select m.*,
       case when m.precision is null or m.recall is null or (m.precision + m.recall) = 0 then null
            else round(2 * m.precision * m.recall / (m.precision + m.recall), 3) end as f1,
       case when m.recall is null then null else round(1 - m.recall, 3) end as omission_rate
from v_claim_metrics m;

create view v_human_detection_rate with (security_invoker = true) as
with teacher_valid as (
  select o.study_id, o.video_id, count(*)::int as valid_total from observations o join participants p on p.id = o.participant_id
  where o.status = 'submitted' and not o.invalidated and not o.is_practice and p.is_valid group by o.study_id, o.video_id
),
teacher_coded as (
  select cs.video_id, count(distinct cs.source_record_id)::int as coded_total
  from coding_sessions cs where cs.source_type = 'teacher' and cs.status = 'finalized' group by cs.video_id
),
teacher_hits as (
  select cc.matched_reference_event_id as ref_id, count(distinct cs.source_record_id)::int as detected
  from claim_codings cc join response_claims c on c.id = cc.claim_id join coding_sessions cs on cs.id = c.coding_session_id
  where cs.source_type = 'teacher' and cc.support_type = 'observed' and cc.matched_reference_event_id is not null
  group by cc.matched_reference_event_id
),
ai_hits as (
  select cc.matched_reference_event_id as ref_id, count(distinct cs.source_record_id)::int as detected_runs
  from claim_codings cc join response_claims c on c.id = cc.claim_id join coding_sessions cs on cs.id = c.coding_session_id
  where cs.source_type = 'ai' and cc.support_type = 'observed' and cc.matched_reference_event_id is not null
  group by cc.matched_reference_event_id
),
ai_total as (
  select cs.video_id, count(distinct cs.source_record_id)::int as coded_runs from coding_sessions cs where cs.source_type = 'ai' and cs.status = 'finalized' group by cs.video_id
)
select r.study_id, r.video_id, v.code as video_code, r.id as reference_event_id, r.event_code, r.event_order, r.actor, r.action, r.object, r.behavior_category,
       coalesce(th.detected, 0) as teacher_detected,
       coalesce(tc.coded_total, 0) as teacher_coded,
       coalesce(tv.valid_total, 0) as teacher_valid_total,
       round(coalesce(th.detected, 0)::numeric / nullif(tc.coded_total, 0), 3) as human_detection_rate,
       coalesce(ah.detected_runs, 0) as ai_detected_runs,
       coalesce(at.coded_runs, 0) as ai_coded_runs,
       coalesce(ah.detected_runs, 0) > 0 as ai_detected,
       case
         when tc.coded_total is null or tc.coded_total = 0 then 'uncoded'
         when coalesce(th.detected, 0)::numeric / tc.coded_total >= 0.5 and coalesce(ah.detected_runs, 0) > 0 then 'both_detect'
         when coalesce(th.detected, 0)::numeric / tc.coded_total >= 0.5 then 'human_only'
         when coalesce(ah.detected_runs, 0) > 0 then 'ai_only'
         else 'both_miss'
       end as quadrant
from reference_events r
join videos v on v.id = r.video_id
left join teacher_valid tv on tv.video_id = r.video_id
left join teacher_coded tc on tc.video_id = r.video_id
left join teacher_hits th on th.ref_id = r.id
left join ai_hits ah on ah.ref_id = r.id
left join ai_total at on at.video_id = r.video_id
where r.deleted_at is null;

create view v_coding_progress with (security_invoker = true) as
select v.study_id, v.id as video_id, v.code as video_code,
       (select count(*) from v_coding_sources s where s.video_id = v.id and s.source_type = 'teacher')::int as teacher_sources,
       (select count(distinct source_record_id) from coding_sessions cs where cs.video_id = v.id and cs.source_type = 'teacher' and cs.status = 'finalized')::int as teacher_finalized,
       (select count(*) from v_coding_sources s where s.video_id = v.id and s.source_type = 'ai')::int as ai_sources,
       (select count(distinct source_record_id) from coding_sessions cs where cs.video_id = v.id and cs.source_type = 'ai' and cs.status = 'finalized')::int as ai_finalized,
       (select count(*) from reference_events r where r.video_id = v.id and r.deleted_at is null)::int as reference_events
from videos v where v.kind = 'research' and v.active;

grant select on v_coding_sources, v_claim_metrics, v_claim_metrics_full, v_human_detection_rate, v_coding_progress to authenticated, service_role;

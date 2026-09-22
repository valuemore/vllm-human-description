-- 0013: v_claim_metrics 에 observed_unreferenced 반영 (0012 참고)
--   factual = observed + observed_unreferenced + hallucination
--   precision          = (observed + observed_unreferenced) / factual
--   hallucination_rate = hallucination / factual
--   unreferenced_rate  = observed_unreferenced / factual   (신규)
--   recall / matched_events / Human Detection Rate 는 Reference 대응이 있는 observed 만 사용 (변경 없음)

drop view if exists v_claim_metrics_full;
drop view if exists v_claim_metrics;

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
       round(count(*) filter (where cl.support_type in ('observed','observed_unreferenced'))::numeric / nullif(count(*) filter (where cl.support_type in ('observed','observed_unreferenced','hallucination')), 0), 3) as precision,
       round(count(distinct cl.matched_reference_event_id) filter (where cl.support_type = 'observed' and cl.matched_reference_event_id is not null)::numeric / nullif(rc.reference_total, 0), 3) as recall,
       round(count(*) filter (where cl.support_type = 'hallucination')::numeric / nullif(count(*) filter (where cl.support_type in ('observed','observed_unreferenced','hallucination')), 0), 3) as hallucination_rate,
       round(count(*) filter (where cl.support_type in ('inference_supported','inference_unsupported'))::numeric / nullif(count(*) filter (where cl.support_type is not null), 0), 3) as inference_rate,
       round(count(*) filter (where cl.temporal_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.temporal_accuracy in ('correct','partial','incorrect')), 0), 3) as temporal_fidelity,
       round(count(*) filter (where cl.actor_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.actor_accuracy in ('correct','partial','incorrect')), 0), 3) as actor_accuracy,
       round(count(*) filter (where cl.action_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.action_accuracy in ('correct','partial','incorrect')), 0), 3) as action_accuracy,
       round(count(*) filter (where cl.object_accuracy = 'correct')::numeric / nullif(count(*) filter (where cl.object_accuracy in ('correct','partial','incorrect')), 0), 3) as object_accuracy,
       round(avg(cl.granularity_score), 2) as granularity_mean,
       count(*) filter (where cl.support_type = 'observed_unreferenced')::int as observed_unreferenced,
       round(count(*) filter (where cl.support_type = 'observed_unreferenced')::numeric / nullif(count(*) filter (where cl.support_type in ('observed','observed_unreferenced','hallucination')), 0), 3) as unreferenced_rate
from claims cl
join videos v on v.id = cl.video_id
left join ref_counts rc on rc.video_id = cl.video_id
left join v_coding_sources src on src.source_type = cl.source_type and src.source_record_id = cl.source_record_id
group by cl.study_id, cl.source_type, cl.source_record_id, cl.video_id, v.code, cl.coder_id, cl.session_status, src.source_label, src.run_number, rc.reference_total;

create view v_claim_metrics_full with (security_invoker = true) as
select m.*,
       case when m.precision is null or m.recall is null or (m.precision + m.recall) = 0 then null
            else round(2 * m.precision * m.recall / (m.precision + m.recall), 3) end as f1,
       case when m.recall is null then null else round(1 - m.recall, 3) end as omission_rate
from v_claim_metrics m;

grant select on v_claim_metrics, v_claim_metrics_full to authenticated, service_role;

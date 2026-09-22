-- 0012: support_type 에 'observed_unreferenced' 추가 (연구자 지시 2026-09-22)
--
-- 정의: 영상에 실제로 나타나지만 미미하거나 순간적인 동작이어서 Reference Annotation 에 기재되지 않은
--       사실적 기술. 관찰자가 매우 세부적으로 묘사할 때 나타난다. 영상으로 확인되지 않는 'hallucination' 과
--       구분해야 하며, 해석 시 별도 범주로 다룬다.
-- 지표(0013): 사실적 기술(factual) = observed + observed_unreferenced + hallucination.
--   precision = (observed + observed_unreferenced) / factual, hallucination_rate = hallucination / factual,
--   unreferenced_rate = observed_unreferenced / factual. recall 은 Reference 대응이 없으므로 영향 없음.
-- 새 enum 값은 같은 트랜잭션에서 사용할 수 없어 뷰 변경은 0013 으로 분리한다.

alter type support_type add value if not exists 'observed_unreferenced' after 'observed';

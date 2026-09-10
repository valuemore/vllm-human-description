import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import type { ParticipantContext } from "@/lib/auth/participant";
import type { ObservationSummary, ParticipantSnapshot } from "@/lib/participant/resolveNextStep";

/** 진행 판정에 필요한 사실만 모은다. 호출 전 만료 관찰 정리(finalize) 를 수행한다. */
export async function loadParticipantSnapshot(ctx: ParticipantContext): Promise<ParticipantSnapshot> {
  const sb = getServiceClient();
  const pid = ctx.participant.id;

  await sb.rpc("finalize_expired_observations", { p_participant_id: pid });

  const [consents, demographics, observations] = await Promise.all([
    sb.from("participant_consents").select("consent_type, consent_version, consented").eq("participant_id", pid).eq("consented", true),
    sb.from("participant_demographics").select("id").eq("participant_id", pid).maybeSingle(),
    sb
      .from("observations")
      .select("id, presentation_order, status, attempt_number, invalidated, is_practice")
      .eq("participant_id", pid)
      .order("presentation_order")
      .order("attempt_number"),
  ]);

  const consentTypes = new Set(
    (consents.data ?? []).filter((c) => c.consent_version === ctx.study.consent_version).map((c) => c.consent_type),
  );
  const hasConsent = consentTypes.has("research") && consentTypes.has("video_security");

  const toSummary = (o: NonNullable<typeof observations.data>[number]): ObservationSummary => ({
    id: o.id,
    presentationOrder: o.presentation_order,
    status: o.status,
    attemptNumber: o.attempt_number,
    invalidated: o.invalidated,
  });
  const all = observations.data ?? [];
  const practiceRows = all.filter((o) => o.is_practice && !o.invalidated);
  const practice = practiceRows.length ? toSummary(practiceRows[practiceRows.length - 1]) : null;

  // 연습영상이 설정되어 있는데 연습 관찰이 없으면 생성
  let practiceSummary = practice;
  if (!practiceSummary && ctx.study.practice_video_id) {
    const { data: pid2 } = await sb.rpc("ensure_practice_observation", { p_participant_id: pid });
    if (pid2) practiceSummary = { id: pid2, presentationOrder: null, status: "pending", attemptNumber: 1, invalidated: false };
  }

  return {
    studyStatus: ctx.study.status,
    participantStatus: ctx.participant.status,
    guideAcknowledgedAt: ctx.participant.guide_acknowledged_at,
    hasConsent,
    hasDemographics: !!demographics.data,
    practice: practiceSummary,
    main: all.filter((o) => !o.is_practice).map(toSummary),
  };
}

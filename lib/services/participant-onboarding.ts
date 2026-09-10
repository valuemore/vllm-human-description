import "server-only";
import { headers } from "next/headers";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError } from "@/lib/errors";
import type { ParticipantContext } from "@/lib/auth/participant";
import { classifyBrowser, isMobileLike, resolveDevice } from "@/lib/participant/device";
import type { ConsentInput, DeviceCheckInput, ProfileInput } from "@/lib/validation/participant";

async function ua() {
  const h = await headers();
  return h.get("user-agent");
}

/** 동의 2종 저장 (append-only). 이미 같은 버전에 동의했으면 중복 생성하지 않는다. */
export async function recordConsent(ctx: ParticipantContext, input: ConsentInput) {
  if (input.consent_version !== ctx.study.consent_version) {
    throw new AppError("VALIDATION", "동의문 버전이 갱신되었습니다. 화면을 새로고침해 주세요.");
  }
  const sb = getServiceClient();
  const userAgent = await ua();
  const { data: existing } = await sb
    .from("participant_consents")
    .select("consent_type")
    .eq("participant_id", ctx.participant.id)
    .eq("consent_version", input.consent_version)
    .eq("consented", true);
  const have = new Set((existing ?? []).map((c) => c.consent_type));
  const rows = [
    { consent_type: "research", items: { participate: input.participate } },
    { consent_type: "video_security", items: { no_copy: input.no_copy, research_only: input.research_only } },
  ].filter((r) => !have.has(r.consent_type));
  if (rows.length) {
    const { error } = await sb.from("participant_consents").insert(
      rows.map((r) => ({
        participant_id: ctx.participant.id,
        consent_type: r.consent_type,
        consent_version: input.consent_version,
        items_json: r.items,
        consented: true,
        user_agent: userAgent,
      })),
    );
    if (error) throw new AppError("INTERNAL", error.message);
  }
  if (ctx.participant.status === "invited") {
    await sb.from("participants").update({ status: "consented" }).eq("id", ctx.participant.id);
  }
}

export async function saveProfile(ctx: ParticipantContext, input: ProfileInput) {
  const sb = getServiceClient();
  const { error } = await sb
    .from("participant_demographics")
    .upsert({ participant_id: ctx.participant.id, ...input }, { onConflict: "participant_id" });
  if (error) throw new AppError("INTERNAL", error.message);
  if (ctx.participant.status === "invited" || ctx.participant.status === "consented") {
    await sb.from("participants").update({ status: "onboarding" }).eq("id", ctx.participant.id);
  }
}

export async function acknowledgeGuide(ctx: ParticipantContext) {
  if (ctx.participant.guide_acknowledged_at) return;
  const { error } = await getServiceClient()
    .from("participants")
    .update({ guide_acknowledged_at: new Date().toISOString() })
    .eq("id", ctx.participant.id);
  if (error) throw new AppError("INTERNAL", error.message);
}

/** 기기 판정 저장. 모바일 차단 설정이면 403. */
export async function recordDevice(ctx: ParticipantContext, input: DeviceCheckInput) {
  const userAgent = input.user_agent ?? (await ua());
  const device = resolveDevice({ ua: userAgent, coarsePointer: input.coarse_pointer, viewportWidth: input.viewport_width });
  const browser = classifyBrowser(userAgent);
  await getServiceClient()
    .from("participants")
    .update({ device_category: device, browser_category: browser, user_agent_first: ctx.participant.user_agent_first ?? userAgent })
    .eq("id", ctx.participant.id);
  const blocked = isMobileLike(device) && !ctx.study.mobile_allowed;
  if (blocked) throw new AppError("MOBILE_NOT_ALLOWED", "PC 또는 노트북에서 참여해 주세요", { device });
  return { device, browser, warning: isMobileLike(device) };
}

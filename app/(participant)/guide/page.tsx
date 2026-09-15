import { guardStep } from "@/lib/participant/guard";
import { copy } from "@/lib/copy/participant.ko";
import { toTimeLimits } from "@/lib/participant/timeLimits";
import { GuideActions } from "./guide-actions";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const { ctx, step } = await guardStep("guide");
  // 안내를 다시 보는 경우(연습/허브 단계) 에는 확인 API 대신 원래 단계로 돌아간다
  const alreadyAcknowledged = step.step !== "guide";
  return <GuideActions steps={copy.guide.steps} notes={copy.guide.notes(toTimeLimits(ctx.study))} backHref={alreadyAcknowledged ? step.href : null} />;
}

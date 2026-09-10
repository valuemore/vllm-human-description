import { redirect } from "next/navigation";
import { getParticipantContext, isStudyOpen } from "@/lib/auth/participant";
import { copy } from "@/lib/copy/participant.ko";
import { EnterForm } from "./enter-form";

export const dynamic = "force-dynamic";

type Reason = keyof typeof copy.enter.blocked;

export default async function EnterPage({ searchParams }: { searchParams: Promise<{ code?: string; reason?: string }> }) {
  const { code, reason } = await searchParams;
  // 이미 유효한 세션이 있으면 진행 위치로 (차단 사유가 있는 경우 제외)
  if (!reason) {
    const ctx = await getParticipantContext();
    if (ctx && isStudyOpen(ctx.study) && ctx.participant.status !== "withdrawn" && ctx.participant.status !== "technical_issue") {
      redirect("/welcome");
    }
  }
  const reasonText = reason && reason in copy.enter.blocked ? copy.enter.blocked[reason as Reason] : null;
  return <EnterForm initialCode={code?.toUpperCase().slice(0, 4) ?? ""} blockedMessage={reasonText} />;
}

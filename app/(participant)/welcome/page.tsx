import { headers } from "next/headers";
import { guardStep } from "@/lib/participant/guard";
import { classifyDeviceFromUA, isMobileLike } from "@/lib/participant/device";
import { copy } from "@/lib/copy/participant.ko";
import { getServiceClient } from "@/lib/db/service-client";
import { activeMainObservations } from "@/lib/participant/resolveNextStep";
import { toTimeLimits } from "@/lib/participant/timeLimits";
import { WelcomeActions } from "./welcome-actions";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const { ctx, snapshot } = await guardStep("welcome");
  const ua = (await headers()).get("user-agent");
  const serverMobile = isMobileLike(classifyDeviceFromUA(ua));
  const { count: audioCount } = await getServiceClient()
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("study_id", ctx.study.id)
    .eq("kind", "research")
    .eq("active", true)
    .eq("has_audio", true);
  const totalVideos = activeMainObservations(snapshot.main).length || ctx.study.research_video_count;

  return (
    <WelcomeActions
      serverMobile={serverMobile}
      mobileAllowed={ctx.study.mobile_allowed}
      bullets={copy.welcome.bullets(totalVideos, toTimeLimits(ctx.study))}
      env={copy.welcome.env((audioCount ?? 0) > 0)}
    />
  );
}

import { guardStep } from "@/lib/participant/guard";
import { ConsentForm } from "./consent-form";

export const dynamic = "force-dynamic";

export default async function ConsentPage() {
  const { ctx } = await guardStep("consent");
  return <ConsentForm consentVersion={ctx.study.consent_version} />;
}

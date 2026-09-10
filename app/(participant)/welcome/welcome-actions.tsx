"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText, PageCard } from "@/components/participant/PageCard";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ApiClientError, apiPost } from "@/lib/client/api";
import { copy } from "@/lib/copy/participant.ko";

type Props = { serverMobile: boolean; mobileAllowed: boolean; bullets: readonly string[]; env: readonly string[] };

export function WelcomeActions({ serverMobile, mobileAllowed, bullets, env }: Props) {
  const router = useRouter();
  const clientMobile = useMediaQuery("(pointer: coarse) and (max-width: 1023px)");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const mobile = serverMobile || clientMobile;
  const blocked = mobile && !mobileAllowed;

  async function next() {
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/participant/device-check", {
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        coarse_pointer: window.matchMedia("(pointer: coarse)").matches,
        user_agent: navigator.userAgent,
      });
      router.push("/consent");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "MOBILE_NOT_ALLOWED") setError(copy.welcome.mobileBlocked);
      else setError(copy.common.error);
      setPending(false);
    }
  }

  return (
    <PageCard title={copy.welcome.title} lead={copy.welcome.lead}>
      <ul className="list-disc space-y-1 pl-6">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="rounded-xl bg-neutral-50 p-5">
        <h2 className="font-semibold">{copy.welcome.envTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-neutral-700">
          {env.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
      {blocked ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          {copy.welcome.mobileBlocked}
        </div>
      ) : (
        <>
          {mobile && <p className="text-amber-800">{copy.welcome.mobileWarning}</p>}
          <ErrorText>{error}</ErrorText>
          <Button size="lg" className="h-12 w-full text-base" onClick={next} disabled={pending}>
            {copy.welcome.next}
          </Button>
        </>
      )}
    </PageCard>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorText, PageCard } from "@/components/participant/PageCard";
import { apiPost } from "@/lib/client/api";
import { copy } from "@/lib/copy/participant.ko";

export function GuideActions({ steps, notes, backHref }: { steps: readonly string[]; notes: readonly string[]; backHref: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    if (backHref) {
      router.push(backHref);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { data } = await apiPost<{ next: string }>("/api/participant/guide-ack", {});
      router.push(data.next);
    } catch {
      setError(copy.common.error);
      setPending(false);
    }
  }

  return (
    <PageCard title={copy.guide.title}>
      <ol className="list-decimal space-y-2 pl-6">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <ul className="space-y-2 rounded-xl bg-neutral-50 p-5 text-neutral-800">
        {notes.map((n) => (
          <li key={n} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{n}</span>
          </li>
        ))}
      </ul>
      <p className="text-neutral-600">{copy.observation.notExam}</p>
      <ErrorText>{error}</ErrorText>
      <Button size="lg" className="h-12 w-full text-base" onClick={start} disabled={pending}>
        {backHref ? "돌아가기" : copy.guide.startPractice}
      </Button>
    </PageCard>
  );
}

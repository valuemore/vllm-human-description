"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorText, PageCard } from "@/components/participant/PageCard";
import { apiPost } from "@/lib/client/api";
import { copy } from "@/lib/copy/participant.ko";

const KEYS = ["participate", "no_copy", "research_only"] as const;
type Key = (typeof KEYS)[number];

export function ConsentForm({ consentVersion }: { consentVersion: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<Key, boolean>>({ participate: false, no_copy: false, research_only: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const all = KEYS.every((k) => checked[k]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!all) return;
    setPending(true);
    setError(null);
    try {
      const { data } = await apiPost<{ next: string }>("/api/participant/consent", { ...checked, consent_version: consentVersion });
      router.push(data.next);
    } catch {
      setError(copy.common.error);
      setPending(false);
    }
  }

  return (
    <PageCard title={copy.consent.title} lead={copy.consent.lead}>
      <div className="rounded-xl bg-neutral-50 p-5">
        <h2 className="font-semibold">{copy.consent.securityTitle}</h2>
        <p className="mt-2 text-neutral-700">{copy.consent.securityBody}</p>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <ul className="space-y-4">
          {KEYS.map((k) => (
            <li key={k} className="flex items-start gap-3">
              <Checkbox
                id={`consent-${k}`}
                checked={checked[k]}
                onCheckedChange={(v) => setChecked((s) => ({ ...s, [k]: v === true }))}
                className="mt-1.5 size-5"
              />
              <label htmlFor={`consent-${k}`} className="cursor-pointer">
                {copy.consent.items[k]}
              </label>
            </li>
          ))}
        </ul>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!all || pending}>
          {copy.consent.submit}
        </Button>
      </form>
    </PageCard>
  );
}

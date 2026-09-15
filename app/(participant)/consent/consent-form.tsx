"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
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
  // 네트워크가 느리면 JS 하이드레이션 전까지 버튼이 눌리지 않는다. 그동안은 "불러오는 중"을 보여 원인을 알 수 있게 한다.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const all = KEYS.every((k) => checked[k]);
  const checkedCount = KEYS.filter((k) => checked[k]).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!all) {
      // 버튼을 비활성화해 두면 참여자가 왜 진행이 안 되는지 알 수 없다. 누르면 이유를 안내하고 첫 미체크 항목으로 포커스를 옮긴다.
      setError(copy.consent.incomplete);
      const first = KEYS.find((k) => !checked[k]);
      if (first) document.getElementById(`consent-${first}`)?.focus();
      return;
    }
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
      <form onSubmit={submit} className="space-y-5" noValidate>
        <p className="text-[15px] font-medium text-neutral-800">{copy.consent.checkHint}</p>
        <ul className="space-y-3">
          {KEYS.map((k) => (
            <li key={k}>
              <label
                htmlFor={`consent-${k}`}
                className="flex cursor-pointer items-start gap-4 rounded-lg border-2 border-neutral-300 bg-white p-4 transition-colors hover:bg-neutral-50 has-data-checked:border-neutral-900 has-data-checked:bg-neutral-50"
              >
                <Checkbox
                  id={`consent-${k}`}
                  checked={checked[k]}
                  onCheckedChange={(v) => {
                    setChecked((s) => ({ ...s, [k]: v === true }));
                    setError(null);
                  }}
                  className="mt-0.5 size-6 border-2 border-neutral-600 bg-white [&_svg]:size-4"
                />
                <span className="leading-relaxed">{copy.consent.items[k]}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-sm text-neutral-600" aria-live="polite">
          {checkedCount} / {KEYS.length} 항목 체크됨
        </p>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!ready || pending} aria-disabled={!ready || !all || pending}>
          {ready ? copy.consent.submit : copy.common.loading}
        </Button>
      </form>
    </PageCard>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorText, PageCard } from "@/components/participant/PageCard";
import { ApiClientError, apiPost } from "@/lib/client/api";
import { copy } from "@/lib/copy/participant.ko";

type LoginResult = { step: { href: string }; participantCode: string };

export function EnterForm({ initialCode, blockedMessage }: { initialCode: string; blockedMessage: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(blockedMessage);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { data } = await apiPost<LoginResult>("/api/participant/login", { participant_code: code, pin });
      router.replace(data.step.href);
    } catch (err) {
      const c = err instanceof ApiClientError ? err.code : "DEFAULT";
      const msgs = copy.enter.errors as Record<string, string>;
      setError(msgs[c] ?? msgs.DEFAULT);
      setPending(false);
    }
  }

  return (
    <PageCard title={copy.enter.title} lead={copy.enter.lead}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="code" className="text-base">
            {copy.enter.codeLabel}
          </Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={copy.enter.codePlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            className="h-12 text-lg"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin" className="text-base">
            {copy.enter.pinLabel}
          </Label>
          <Input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="h-12 text-lg tracking-widest"
            required
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending || !code || pin.length < 4}>
          {pending ? copy.enter.submitting : copy.enter.submit}
        </Button>
      </form>
    </PageCard>
  );
}

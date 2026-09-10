"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorText, PageCard } from "@/components/participant/PageCard";
import { apiPost } from "@/lib/client/api";
import { copy } from "@/lib/copy/participant.ko";
import { AGE_GROUPS, AI_EXPERIENCES, RECORD_FREQUENCIES, VIDEO_EXPERIENCES, profileSchema } from "@/lib/validation/participant";

type Form = {
  teaching_experience_years: string;
  teaching_experience_months: string;
  current_child_age_group: string;
  observation_record_frequency: string;
  video_observation_experience: string;
  generative_ai_experience: string;
};

function SelectField({
  id, label, value, options, labels, onChange,
}: { id: string; label: string; value: string; options: readonly string[]; labels: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="h-12 w-full rounded-md border border-input bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{copy.profile.select}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ProfileForm() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    teaching_experience_years: "",
    teaching_experience_months: "0",
    current_child_age_group: "",
    observation_record_frequency: "",
    video_observation_experience: "",
    generative_ai_experience: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof Form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setError("모든 항목을 입력해 주세요. 경력은 0~45년, 0~11개월 범위로 입력합니다.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { data } = await apiPost<{ next: string }>("/api/participant/profile", parsed.data);
      router.push(data.next);
    } catch {
      setError(copy.common.error);
      setPending(false);
    }
  }

  const o = copy.profile.options;
  return (
    <PageCard title={copy.profile.title} lead={copy.profile.lead}>
      <form onSubmit={submit} className="space-y-6" noValidate>
        <fieldset className="space-y-2">
          <legend className="text-base font-medium">{copy.profile.experience}</legend>
          <div className="flex items-center gap-3">
            <Input
              id="years"
              type="number"
              min={0}
              max={45}
              inputMode="numeric"
              aria-label={`${copy.profile.experience} ${copy.profile.years}`}
              value={form.teaching_experience_years}
              onChange={(e) => set("teaching_experience_years")(e.target.value)}
              className="h-12 w-24 text-base"
              required
            />
            <span>{copy.profile.years}</span>
            <Input
              id="months"
              type="number"
              min={0}
              max={11}
              inputMode="numeric"
              aria-label={`${copy.profile.experience} ${copy.profile.months}`}
              value={form.teaching_experience_months}
              onChange={(e) => set("teaching_experience_months")(e.target.value)}
              className="h-12 w-24 text-base"
              required
            />
            <span>{copy.profile.months}</span>
          </div>
        </fieldset>
        <SelectField id="age" label={copy.profile.ageGroup} value={form.current_child_age_group} options={AGE_GROUPS} labels={o.ageGroup} onChange={set("current_child_age_group")} />
        <SelectField id="freq" label={copy.profile.frequency} value={form.observation_record_frequency} options={RECORD_FREQUENCIES} labels={o.frequency} onChange={set("observation_record_frequency")} />
        <SelectField id="video" label={copy.profile.videoExperience} value={form.video_observation_experience} options={VIDEO_EXPERIENCES} labels={o.videoExperience} onChange={set("video_observation_experience")} />
        <SelectField id="ai" label={copy.profile.aiExperience} value={form.generative_ai_experience} options={AI_EXPERIENCES} labels={o.aiExperience} onChange={set("generative_ai_experience")} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
          {copy.profile.submit}
        </Button>
      </form>
    </PageCard>
  );
}

import { z } from "zod";

export const enterSchema = z.object({
  participant_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]\d{2,3}$/, "참여코드 형식이 올바르지 않습니다"),
  pin: z.string().trim().regex(/^\d{4,6}$/, "PIN은 4~6자리 숫자입니다"),
});
export type EnterInput = z.infer<typeof enterSchema>;

export const consentSchema = z.object({
  participate: z.literal(true),
  no_copy: z.literal(true),
  research_only: z.literal(true),
  consent_version: z.string().min(1),
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const AGE_GROUPS = ["age_0", "age_1", "age_2", "age_3", "age_4", "age_5", "mixed", "not_homeroom"] as const;
export const RECORD_FREQUENCIES = ["daily", "several_per_week", "weekly", "several_per_month", "monthly_or_less"] as const;
export const VIDEO_EXPERIENCES = ["none", "few_times", "regular"] as const;
export const AI_EXPERIENCES = ["never", "tried", "sometimes", "often"] as const;

export const profileSchema = z.object({
  teaching_experience_years: z.coerce.number().int().min(0).max(45),
  teaching_experience_months: z.coerce.number().int().min(0).max(11),
  current_child_age_group: z.enum(AGE_GROUPS),
  observation_record_frequency: z.enum(RECORD_FREQUENCIES),
  video_observation_experience: z.enum(VIDEO_EXPERIENCES),
  generative_ai_experience: z.enum(AI_EXPERIENCES),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const deviceCheckSchema = z.object({
  viewport_width: z.number().int().min(0).max(10000),
  viewport_height: z.number().int().min(0).max(10000),
  coarse_pointer: z.boolean(),
  user_agent: z.string().max(1000).optional(),
});
export type DeviceCheckInput = z.infer<typeof deviceCheckSchema>;

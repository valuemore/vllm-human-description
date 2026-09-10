"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { setCurrentStudyCookie } from "@/lib/services/admin/study";

export async function switchStudyAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("study_id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) await setCurrentStudyCookie(id);
  revalidatePath("/admin", "layout");
}

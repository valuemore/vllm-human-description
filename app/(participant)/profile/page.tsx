import { guardStep } from "@/lib/participant/guard";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await guardStep("profile");
  return <ProfileForm />;
}

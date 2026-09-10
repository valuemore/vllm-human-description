import { copy } from "@/lib/copy/participant.ko";
import { guardStep } from "@/lib/participant/guard";

export const dynamic = "force-dynamic";

export default async function CompletePage() {
  await guardStep("complete");
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold" tabIndex={-1}>
        {copy.complete.title}
      </h1>
      <div className="mt-4 space-y-3 text-neutral-800">
        {copy.complete.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </section>
  );
}

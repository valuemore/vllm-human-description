/**
 * Claim Coding 초안 가져오기.
 *   npm run coding:drafts -- --file scratch/coding-drafts.json --source "claude-fable-5-1/draft-v1" [--coder email] [--dry-run] [--code main]
 *
 * 파일 형식은 lib/coding/draftClaims.ts 의 draftFileSchema. 각 원문(교사 관찰 / AI run)마다
 *   1) 코더의 코딩 세션을 만들고(있으면 재사용, 이미 Claim 이 있으면 건너뜀)
 *   2) Claim 을 원문 verbatim 위치와 함께 생성하고
 *   3) 코딩 행을 draft_source / draft_values / reviewed_at=null 로 생성한다.
 * 연구자가 화면에서 각 Claim 을 확인·저장하면 reviewed_at 이 채워지고, 모두 확인되어야 세션을 확정할 수 있다.
 * 원문·Reference·기존 코딩은 수정하지 않는다.
 */
import { readFileSync } from "node:fs";
import { draftFileSchema, locateClaims, type DraftSource } from "../lib/coding/draftClaims";
import { fail, flag, option, serviceClient } from "./_shared";

const sb = serviceClient();
const FILE = option("file");
const SOURCE = option("source");
const DRY = flag("dry-run");
const STUDY_CODE = option("code", "main")!;

async function main() {
  if (!FILE) fail("--file <초안 JSON> 이 필요합니다");
  if (!SOURCE) fail("--source <초안 생성 주체> 가 필요합니다 (예: claude-fable-5-1/draft-v1)");
  const parsed = draftFileSchema.safeParse(JSON.parse(readFileSync(FILE!, "utf8")));
  if (!parsed.success) fail("초안 파일 형식 오류", parsed.error.issues.slice(0, 5));
  const drafts = parsed.data;

  const { data: study } = await sb.from("studies").select("id").eq("code", STUDY_CODE).single();
  if (!study) fail(`study ${STUDY_CODE} 없음`);
  const coderEmail = option("coder", process.env.SEED_ADMIN_EMAIL)!;
  const { data: admin } = await sb.from("admin_users").select("id, email").eq("email", coderEmail).eq("active", true).maybeSingle();
  if (!admin) fail(`관리자 ${coderEmail} 없음`);
  const generatedAt = new Date().toISOString();

  const summary = { created: 0, skipped: 0, failed: 0, claims: 0 };
  for (const d of drafts) {
    const r = await importOne(d, study.id, admin.id, generatedAt);
    summary[r.kind]++;
    summary.claims += r.claims;
    console.log(`${r.kind.padEnd(7)} ${d.source_type.padEnd(7)} ${(d.label ?? "").padEnd(22)} ${r.message}`);
  }
  console.log(`\n초안 생성 ${summary.created} 세션 / ${summary.claims} Claim, 건너뜀 ${summary.skipped}, 실패 ${summary.failed}${DRY ? " (dry-run: DB 변경 없음)" : ""}`);
  if (summary.failed > 0) process.exitCode = 1;
}

async function importOne(d: DraftSource, studyId: string, coderId: string, generatedAt: string): Promise<{ kind: "created" | "skipped" | "failed"; claims: number; message: string }> {
  const { data: src } = await sb.from("v_coding_sources").select("study_id, video_id, text").eq("source_type", d.source_type).eq("source_record_id", d.source_record_id).maybeSingle();
  if (!src?.video_id) return { kind: "failed", claims: 0, message: "코딩 대상을 찾을 수 없음 (무효 기록이거나 superseded run)" };
  if (src.study_id !== studyId) return { kind: "failed", claims: 0, message: "다른 study 의 기록" };

  const text = src.text ?? "";
  const spans = locateClaims(text, d.claims);
  const missing = spans.map((s, i) => (s ? null : d.claims[i].order)).filter((v) => v !== null);
  if (missing.length) return { kind: "failed", claims: 0, message: `원문에서 찾지 못한 Claim: #${missing.join(", #")}` };

  const { data: existing } = await sb.from("coding_sessions").select("id, status").eq("source_type", d.source_type).eq("source_record_id", d.source_record_id).eq("coder_id", coderId).maybeSingle();
  if (existing) {
    const { count } = await sb.from("response_claims").select("id", { count: "exact", head: true }).eq("coding_session_id", existing.id);
    if ((count ?? 0) > 0) return { kind: "skipped", claims: 0, message: `세션 ${existing.status}, Claim ${count}개 이미 있음` };
    if (existing.status !== "open") return { kind: "skipped", claims: 0, message: `세션 ${existing.status}` };
  }
  if (DRY) return { kind: "created", claims: d.claims.length, message: `(dry-run) Claim ${d.claims.length}개 생성 예정` };

  let sessionId = existing?.id;
  if (!sessionId) {
    const { data, error } = await sb
      .from("coding_sessions")
      .insert({ study_id: studyId, coder_id: coderId, source_type: d.source_type, source_record_id: d.source_record_id, video_id: src.video_id, draft_source: SOURCE!, draft_generated_at: generatedAt })
      .select("id")
      .single();
    if (error) return { kind: "failed", claims: 0, message: `세션 생성 실패: ${error.message}` };
    sessionId = data.id;
  } else {
    await sb.from("coding_sessions").update({ draft_source: SOURCE!, draft_generated_at: generatedAt }).eq("id", sessionId);
  }

  const sorted = [...d.claims].sort((a, b) => a.order - b.order);
  const { data: claims, error: claimErr } = await sb
    .from("response_claims")
    .insert(
      sorted.map((c, i) => ({
        coding_session_id: sessionId!,
        source_type: d.source_type,
        source_record_id: d.source_record_id,
        claim_order: i + 1,
        claim_text: c.text.trim(),
        char_start: spans[d.claims.indexOf(c)]!.start,
        char_end: spans[d.claims.indexOf(c)]!.end,
      })),
    )
    .select("id, claim_order");
  if (claimErr) return { kind: "failed", claims: 0, message: `Claim 생성 실패: ${claimErr.message}` };

  const byOrder = new Map((claims ?? []).map((c) => [c.claim_order, c.id]));
  const { error: codingErr } = await sb.from("claim_codings").insert(
    sorted.map((c, i) => {
      const matched = c.support_type === "observed" || c.support_type === "inference_supported" ? c.matched_reference_event_id : null;
      const values = {
        support_type: c.support_type,
        matched_reference_event_id: matched,
        actor_accuracy: c.actor_accuracy,
        action_accuracy: c.action_accuracy,
        object_accuracy: c.object_accuracy,
        temporal_accuracy: c.temporal_accuracy,
        granularity_score: c.granularity_score,
        note: c.note,
      };
      const { note, ...columns } = values;
      return {
        claim_id: byOrder.get(i + 1)!,
        coder_id: coderId,
        ...columns,
        notes: note ? `[초안] ${note}` : "[초안]",
        draft_source: SOURCE!,
        draft_values: values,
        reviewed_at: null,
      };
    }),
  );
  if (codingErr) return { kind: "failed", claims: 0, message: `코딩 생성 실패: ${codingErr.message}` };

  await sb.rpc("record_audit", {
    p_study_id: studyId,
    p_admin_id: coderId,
    p_action: "claim_coding_created",
    p_target_type: "coding_session",
    p_target_id: sessionId!,
    p_before: null as never,
    p_after: { draft: true, draft_source: SOURCE, claims: sorted.length } as never,
  });
  return { kind: "created", claims: sorted.length, message: `세션 ${sessionId} Claim ${sorted.length}개` };
}

main().catch((e) => fail("초안 가져오기 실패", e));

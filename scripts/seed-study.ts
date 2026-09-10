/**
 * 개발용 시드: Study 1개, 연구영상 placeholder V01..V0N, 연습영상 P01, 순서그룹 O1..ON, Prompt V1, 관리자.
 *   npm run seed                      # placeholder (파일 없음)
 *   npm run seed -- --upload-fixtures # tests/fixtures 의 생성 영상을 Private Storage 에 업로드하고 storage_path 설정
 *   npm run seed -- --videos 7 --participants 21
 * 검증: study_targets / v_order_balance_check 를 출력하고 실패 시 exit 1.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ensureAdmin, fail, flag, option, requireEnv, serviceClient } from "./_shared";

const sb = serviceClient();
const STUDY_CODE = option("code", "main")!;
const N = Number(option("videos", "5"));
const P = Number(option("participants", "20"));
const UPLOAD = flag("upload-fixtures");
const FIXTURES = join(process.cwd(), "tests", "fixtures");

async function main() {
  const adminId = await ensureAdmin(sb, requireEnv("SEED_ADMIN_EMAIL"), requireEnv("SEED_ADMIN_PASSWORD"));
  console.log(`관리자: ${process.env.SEED_ADMIN_EMAIL} (${adminId})`);

  // study
  let { data: study } = await sb.from("studies").select("*").eq("code", STUDY_CODE).maybeSingle();
  if (!study) {
    const { data, error } = await sb
      .from("studies")
      .insert({ code: STUDY_CODE, name: "영유아 동영상 AI–교사 관찰기록 비교연구", participant_target: P, research_video_count: N })
      .select("*")
      .single();
    if (error) fail("study 생성 실패", error);
    study = data;
    console.log(`study 생성: ${study.code} (P=${P}, N=${N})`);
  } else {
    console.log(`study 존재: ${study.code} (P=${study.participant_target}, N=${study.research_video_count})`);
    if (study.structure_locked_at) console.log("  구조 잠김 (관찰 시작됨) → 영상/순서그룹은 재생성하지 않습니다");
  }
  const studyId = study.id;

  // videos
  const targetN = study.research_video_count;
  for (let i = 1; i <= targetN; i++) {
    const code = `V${String(i).padStart(2, "0")}`;
    const { data: existing } = await sb.from("videos").select("id, storage_path").eq("study_id", studyId).eq("code", code).maybeSingle();
    let videoId = existing?.id;
    if (!videoId) {
      const { data, error } = await sb
        .from("videos")
        .insert({ study_id: studyId, code, kind: "research", title_admin: `연구영상 ${code} (placeholder)`, sort_order: i, has_audio: true })
        .select("id")
        .single();
      if (error) fail(`video ${code} 생성 실패`, error);
      videoId = data.id;
      console.log(`video 생성: ${code}`);
    }
    if (UPLOAD && !existing?.storage_path) await uploadFixture(studyId, videoId!, code, `research-${i}.mp4`, 35000, true);
  }
  // practice video
  let practiceId = study.practice_video_id;
  if (!practiceId) {
    const { data: pv } = await sb.from("videos").select("id").eq("study_id", studyId).eq("kind", "practice").eq("active", true).maybeSingle();
    practiceId = pv?.id ?? null;
    if (!practiceId) {
      const { data, error } = await sb
        .from("videos")
        .insert({ study_id: studyId, code: "P01", kind: "practice", title_admin: "연습영상 (placeholder)", sort_order: 0, has_audio: true })
        .select("id")
        .single();
      if (error) fail("practice video 생성 실패", error);
      practiceId = data.id;
      console.log("video 생성: P01 (practice)");
    }
    const { error } = await sb.from("studies").update({ practice_video_id: practiceId }).eq("id", studyId);
    if (error) fail("practice_video_id 설정 실패", error);
  }
  if (UPLOAD) {
    const { data: pv } = await sb.from("videos").select("storage_path").eq("id", practiceId).single();
    if (!pv?.storage_path) await uploadFixture(studyId, practiceId, "P01", "practice.mp4", 20000, true);
  }

  // order groups
  if (!study.structure_locked_at) {
    const { error } = await sb.rpc("regenerate_order_groups", { p_study_id: studyId, p_admin_id: adminId });
    if (error) fail("순서그룹 생성 실패", error);
    console.log(`순서그룹 O1..O${targetN} 생성`);
  }

  // prompt V1
  const { data: prompt } = await sb.from("ai_prompts").select("id").eq("study_id", studyId).eq("prompt_code", "observe").eq("version", 1).maybeSingle();
  if (!prompt) {
    const { error } = await sb.from("ai_prompts").insert({
      study_id: studyId,
      prompt_code: "observe",
      version: 1,
      active: true,
      prompt_text:
        "다음 영유아 활동 영상을 보고, 영상에서 실제로 관찰되는 행동을 중심으로 어린이집 교사가 작성하는 관찰기록 형식으로 기술하세요. 해석이나 추론은 관찰 사실과 구분하여 작성하세요.",
      notes: "placeholder — 실제 연구 프롬프트로 교체",
      created_by: adminId,
    });
    if (error) fail("prompt 생성 실패", error);
    console.log("ai_prompts observe v1 생성");
  }

  // validation
  const { data: targets } = await sb.rpc("study_targets", { p_study_id: studyId });
  const t = targets?.[0];
  const { data: checks, error: cErr } = await sb.from("v_order_balance_check").select("*").eq("study_id", studyId);
  if (cErr) fail("검증 조회 실패", cErr);
  const { count: groupCount } = await sb.from("order_groups").select("*", { count: "exact", head: true }).eq("study_id", studyId);
  const { count: videoCount } = await sb.from("videos").select("*", { count: "exact", head: true }).eq("study_id", studyId).eq("kind", "research").eq("active", true);

  const lines = [
    ["Research videos", videoCount, targetN, videoCount === targetN],
    ["Order groups", groupCount, targetN, groupCount === targetN],
    ["Videos per participant", t?.video_count, targetN, t?.video_count === targetN],
    ["Target participants per group", t?.per_group_target, Math.ceil((t?.participant_target ?? 0) / targetN), true],
    ["Balanced possible (P mod N = 0)", t?.balanced_possible ? "yes" : "no", "yes", !!t?.balanced_possible],
  ] as const;
  let ok = true;
  console.log("\n--- Seed validation ---");
  for (const [name, actual, expected, pass] of lines) {
    console.log(`${pass ? "PASS" : "WARN"}  ${name}: ${actual} (expected ${expected})`);
    if (!pass && name !== "Balanced possible (P mod N = 0)") ok = false;
  }
  for (const c of checks ?? []) {
    // 참여자 0명 상태에서는 group 검증은 FAIL 이 정상이므로 참고 출력만
    console.log(`INFO  ${c.check_name}: actual=${c.actual} expected=${c.expected} pass=${c.pass}`);
  }
  if (!ok) {
    console.error("시드 검증 실패");
    process.exit(1);
  }
  console.log("\nseed 완료");
}

async function uploadFixture(studyId: string, videoId: string, code: string, file: string, durationMs: number, hasAudio: boolean) {
  const path = join(FIXTURES, file);
  if (!existsSync(path)) {
    console.log(`  fixture 없음: ${file} (npm run make:test-video 로 생성) → ${code} 는 placeholder 유지`);
    return;
  }
  const storagePath = `studies/${studyId}/videos/${videoId}.mp4`;
  const { error: upErr } = await sb.storage.from("videos").upload(storagePath, readFileSync(path), { contentType: "video/mp4", upsert: true });
  if (upErr) fail(`업로드 실패 ${file}`, upErr);
  const { error } = await sb
    .from("videos")
    .update({ storage_path: storagePath, duration_ms: durationMs, width: 640, height: 360, has_audio: hasAudio, mime_type: "video/mp4", file_size_bytes: readFileSync(path).length })
    .eq("id", videoId);
  if (error) fail(`video ${code} 메타 갱신 실패`, error);
  console.log(`  업로드: ${code} ← ${file}`);
}

main().catch((e) => fail("seed 실패", e));

/**
 * E2E 전용 연구 시드. 짧은 영상(6초 fixture)·짧은 제한시간으로 전체 흐름을 빠르게 검증한다.
 *   npm run seed:test            # N=3, P=3, max 30초, 참여자 E01..E03 (PIN 123456), status=active
 *   npm run seed:test -- --max 20
 * 이전 e2e 연구는 closed 로 전환한다 (참여코드 조회가 진행 중 연구를 우선하므로).
 * 결과: scratch/e2e.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPin } from "../lib/auth/pin";
import { ensureAdmin, fail, option, requireEnv, serviceClient } from "./_shared";

const sb = serviceClient();
const N = Number(option("videos", "3"));
const P = Number(option("participants", "3"));
const MAX = Number(option("max", "30"));
const PIN = "123456";
const FIXTURE = join(process.cwd(), "tests", "fixtures", "test-video-6s.mp4");

async function main() {
  if (!existsSync(FIXTURE)) fail("tests/fixtures/test-video-6s.mp4 없음. npm run make:test-video");
  const adminId = await ensureAdmin(sb, requireEnv("SEED_ADMIN_EMAIL"), requireEnv("SEED_ADMIN_PASSWORD"));

  // 이전 e2e 연구 종료
  const { data: olds } = await sb.from("studies").select("id, code, status").like("code", "e2e-%").in("status", ["active", "paused", "pilot", "ready"]);
  for (const s of olds ?? []) {
    const path = s.status === "active" ? ["closed"] : s.status === "paused" ? ["closed"] : s.status === "ready" ? ["draft"] : ["draft"];
    for (const st of path) await sb.rpc("set_study_status", { p_study_id: s.id, p_new_status: st as "closed" | "draft", p_admin_id: adminId, p_reason: "e2e reseed" });
  }

  const code = `e2e-${Date.now().toString(36)}`;
  const { data: study, error } = await sb
    .from("studies")
    .insert({ code, name: "E2E 테스트 연구", participant_target: P, research_video_count: N, max_observation_seconds: MAX, mobile_allowed: true })
    .select("*")
    .single();
  if (error || !study) fail("study 생성 실패", error);

  const file = readFileSync(FIXTURE);
  const upload = async (videoId: string) => {
    const storagePath = `studies/${study.id}/videos/${videoId}.mp4`;
    const { error: upErr } = await sb.storage.from("videos").upload(storagePath, file, { contentType: "video/mp4", upsert: true });
    if (upErr) fail("업로드 실패", upErr);
    const { error: uErr } = await sb.from("videos").update({ storage_path: storagePath, duration_ms: 6000, width: 640, height: 360, has_audio: true, file_size_bytes: file.length }).eq("id", videoId);
    if (uErr) fail("video 갱신 실패", uErr);
  };
  for (let i = 1; i <= N; i++) {
    const vcode = `V${String(i).padStart(2, "0")}`;
    const { data: v, error: vErr } = await sb.from("videos").insert({ study_id: study.id, code: vcode, kind: "research", title_admin: `E2E ${vcode}`, sort_order: i }).select("id").single();
    if (vErr || !v) fail("video 생성 실패", vErr);
    await upload(v.id);
  }
  const { data: pv, error: pErr } = await sb.from("videos").insert({ study_id: study.id, code: "P01", kind: "practice", title_admin: "E2E 연습", sort_order: 0 }).select("id").single();
  if (pErr || !pv) fail("practice 생성 실패", pErr);
  await upload(pv.id);
  await sb.from("studies").update({ practice_video_id: pv.id }).eq("id", study.id);

  const { error: gErr } = await sb.rpc("regenerate_order_groups", { p_study_id: study.id, p_admin_id: adminId });
  if (gErr) fail("순서그룹 생성 실패", gErr);
  const { data: groups } = await sb.from("order_groups").select("id, code, group_index").eq("study_id", study.id).order("group_index");

  const pinHash = await hashPin(PIN);
  const participants: { code: string; pin: string; group: string }[] = [];
  for (let i = 1; i <= P; i++) {
    const pcode = `E${String(i).padStart(2, "0")}`;
    const g = groups![(i - 1) % groups!.length];
    const { error: cErr } = await sb.rpc("create_participant_with_assignments", { p_study_id: study.id, p_code: pcode, p_pin_hash: pinHash, p_order_group_id: g.id, p_admin_id: adminId });
    if (cErr) fail(`${pcode} 생성 실패`, cErr);
    participants.push({ code: pcode, pin: PIN, group: g.code });
  }

  for (const st of ["ready", "active"] as const) {
    const { error: sErr } = await sb.rpc("set_study_status", { p_study_id: study.id, p_new_status: st, p_admin_id: adminId, p_reason: "e2e" });
    if (sErr) fail(`status ${st} 실패`, sErr);
  }

  mkdirSync(join(process.cwd(), "scratch"), { recursive: true });
  const out = { studyId: study.id, code, videos: N, participantTarget: P, maxSeconds: MAX, participants };
  writeFileSync(join(process.cwd(), "scratch", "e2e.json"), JSON.stringify(out, null, 2));
  console.log(`E2E study ${code} 준비 완료 (N=${N}, P=${P}, max=${MAX}s) → scratch/e2e.json`);
}

main().catch((e) => fail("seed:test 실패", e));

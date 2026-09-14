/**
 * 등록된 영상 파일을 Private Storage 에서 내려받아 컨테이너를 프로브하고 has_audio 메타를 보정한다.
 * (Chromium 업로더의 오디오 오감지로 has_audio=false 가 저장된 영상을 복구할 때 사용)
 *   npm run videos:probe                    # 변경 없이 판정 결과만 출력
 *   npm run videos:probe -- --apply         # has_audio 가 다른 영상만 갱신 + audit_logs 기록
 *   npm run videos:probe -- --apply --study main --admin admin@example.com
 * 갱신 대상은 videos.has_audio 뿐이며 파일·관찰 데이터는 건드리지 않는다.
 */
import { isHevc, probeVideoBytes } from "../lib/video-probe";
import { fail, flag, option, serviceClient } from "./_shared";

const sb = serviceClient();
const APPLY = flag("apply");
const STUDY_CODE = option("study", "main")!;
const BUCKET = "videos";

async function resolveAdminId(): Promise<string> {
  const email = option("admin", process.env.SEED_ADMIN_EMAIL);
  const q = sb.from("admin_users").select("id,email").eq("active", true);
  const { data, error } = email ? await q.ilike("email", email).maybeSingle() : await q.order("created_at").limit(1).maybeSingle();
  if (error) fail("admin_users 조회 실패", error);
  if (!data) fail(`활성 관리자를 찾을 수 없습니다 (--admin <email> 또는 SEED_ADMIN_EMAIL)`);
  return data.id;
}

async function main() {
  const { data: study, error: sErr } = await sb.from("studies").select("id,code").eq("code", STUDY_CODE).maybeSingle();
  if (sErr) fail("study 조회 실패", sErr);
  if (!study) fail(`study '${STUDY_CODE}' 없음`);

  const { data: videos, error } = await sb.from("videos").select("id,code,kind,title_admin,has_audio,storage_path,mime_type").eq("study_id", study.id).order("kind").order("sort_order");
  if (error) fail("videos 조회 실패", error);

  const adminId = APPLY ? await resolveAdminId() : null;
  let changed = 0;
  for (const v of videos ?? []) {
    if (!v.storage_path) {
      console.log(`${v.kind}\t${v.code}\t(파일 없음)`);
      continue;
    }
    const { data: blob, error: dErr } = await sb.storage.from(BUCKET).download(v.storage_path);
    if (dErr || !blob) {
      console.log(`${v.kind}\t${v.code}\tdownload 실패: ${dErr?.message}`);
      continue;
    }
    const probe = probeVideoBytes(new Uint8Array(await blob.arrayBuffer()));
    const hevc = isHevc(probe) ? "  ⚠ HEVC(H.265): 하드웨어 디코더 없는 Windows Chrome/Firefox 에서 재생 불가 가능 → H.264 재인코딩 권장" : "";
    const verdict = probe.hasAudio === null ? "판정불가" : probe.hasAudio ? "있음" : "없음";
    console.log(`${v.kind}\t${v.code}\t${v.title_admin}\tDB has_audio=${v.has_audio}\t파일 오디오=${verdict}\t코덱=${probe.videoCodecs.join(",") || "?"}${hevc}`);
    if (probe.hasAudio === null || probe.hasAudio === v.has_audio) continue;
    changed++;
    if (!APPLY || !adminId) continue;
    const { error: uErr } = await sb.from("videos").update({ has_audio: probe.hasAudio }).eq("id", v.id);
    if (uErr) fail(`videos.has_audio 갱신 실패 (${v.code})`, uErr);
    const { error: aErr } = await sb.rpc("record_audit", {
      p_study_id: study.id,
      p_admin_id: adminId,
      p_action: "video_updated",
      p_target_type: "video",
      p_target_id: v.id,
      p_before: { has_audio: v.has_audio },
      p_after: { has_audio: probe.hasAudio, source: "scripts/probe-video-audio" },
    });
    if (aErr) fail(`audit 기록 실패 (${v.code})`, aErr);
    console.log(`  → has_audio ${v.has_audio} → ${probe.hasAudio} 갱신`);
  }
  console.log(APPLY ? `갱신 ${changed}건 완료` : `보정 필요 ${changed}건 (적용하려면 --apply)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

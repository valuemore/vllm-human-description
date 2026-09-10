/**
 * 개발용 참여자 시드: T01..T<P> 를 순서그룹에 라운드로빈 배정하고 PIN 을 scratch/participants-pins.csv 로 출력한다.
 *   npm run seed:participants               # study "main", P = participant_target
 *   npm run seed:participants -- --count 4  # 일부만
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePin, hashPin } from "../lib/auth/pin";
import { fail, option, requireEnv, serviceClient } from "./_shared";

const sb = serviceClient();
const STUDY_CODE = option("code", "main")!;

async function main() {
  const { data: study } = await sb.from("studies").select("id, participant_target, research_video_count").eq("code", STUDY_CODE).single();
  if (!study) fail(`study ${STUDY_CODE} 없음. 먼저 npm run seed`);
  const count = Number(option("count", String(study.participant_target)));
  const { data: admin } = await sb.from("admin_users").select("id").eq("email", requireEnv("SEED_ADMIN_EMAIL")).single();
  if (!admin) fail("관리자 없음. 먼저 npm run seed");
  const { data: groups } = await sb.from("order_groups").select("id, code, group_index").eq("study_id", study.id).order("group_index");
  if (!groups?.length) fail("순서그룹 없음. 먼저 npm run seed");

  const rows: string[] = ["participant_code,pin,order_group,link"];
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  let created = 0;
  for (let i = 1; i <= count; i++) {
    const code = `T${String(i).padStart(2, "0")}`;
    const { data: existing } = await sb.from("participants").select("id").eq("study_id", study.id).eq("participant_code", code).maybeSingle();
    if (existing) {
      console.log(`존재: ${code}`);
      continue;
    }
    const group = groups[(i - 1) % groups.length];
    const pin = generatePin();
    const { error } = await sb.rpc("create_participant_with_assignments", {
      p_study_id: study.id,
      p_code: code,
      p_pin_hash: await hashPin(pin),
      p_order_group_id: group.id,
      p_admin_id: admin.id,
    });
    if (error) fail(`${code} 생성 실패`, error);
    rows.push(`${code},${pin},${group.code},${base}/enter?code=${code}`);
    created++;
  }
  mkdirSync(join(process.cwd(), "scratch"), { recursive: true });
  const out = join(process.cwd(), "scratch", "participants-pins.csv");
  if (created > 0) {
    writeFileSync(out, rows.join("\n") + "\n", "utf8");
    console.log(`${created}명 생성. PIN 목록: ${out} (gitignore)`);
  }
  const { data: checks } = await sb.from("v_order_balance_check").select("check_name, expected, actual, pass").eq("study_id", study.id);
  for (const c of checks ?? []) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.check_name}: ${c.actual}/${c.expected}`);
}

main().catch((e) => fail("seed:participants 실패", e));

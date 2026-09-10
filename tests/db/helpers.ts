import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL 이 필요합니다 (.env.local). supabase start 후 실행하세요.");

export const pool = new Pool({ connectionString: url, max: 4 });

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(text, params);
  if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}: ${text}`);
  return rows[0];
}

/** 에러 메시지에 코드 문자열이 포함되는지 검사 */
export async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!msg.includes(code)) throw new Error(`expected error containing "${code}" but got: ${msg}`);
    return;
  }
  throw new Error(`expected error containing "${code}" but no error was thrown`);
}

export type Fixture = {
  studyId: string;
  videoIds: string[]; // V01..V0N (sort_order 순)
  practiceVideoId: string;
  n: number;
};

/** 독립된 study + 연구영상 N편 + 연습영상 + 순서그룹을 만든다 */
export async function createStudyFixture(opts: { n?: number; participantTarget?: number } = {}): Promise<Fixture> {
  const n = opts.n ?? 5;
  const P = opts.participantTarget ?? 20;
  const suffix = randomUUID().slice(0, 8);
  const study = await one<{ id: string }>(
    `insert into studies (code, name, participant_target, research_video_count) values ($1, $2, $3, $4) returning id`,
    [`test-${suffix}`, `테스트 연구 ${suffix}`, P, n],
  );
  const videoIds: string[] = [];
  for (let i = 1; i <= n; i++) {
    const code = `V${String(i).padStart(2, "0")}`;
    const v = await one<{ id: string }>(
      `insert into videos (study_id, code, kind, title_admin, storage_path, duration_ms, sort_order)
       values ($1, $2, 'research', $3, $4, 45000, $5) returning id`,
      [study.id, code, `영상 ${code}`, `studies/${study.id}/videos/${code}-${suffix}.mp4`, i],
    );
    videoIds.push(v.id);
  }
  const pv = await one<{ id: string }>(
    `insert into videos (study_id, code, kind, title_admin, storage_path, duration_ms, sort_order)
     values ($1, 'P01', 'practice', '연습 영상', $2, 20000, 0) returning id`,
    [study.id, `studies/${study.id}/videos/P01-${suffix}.mp4`],
  );
  await q(`update studies set practice_video_id = $2 where id = $1`, [study.id, pv.id]);
  await q(`select regenerate_order_groups($1, null)`, [study.id]);
  return { studyId: study.id, videoIds, practiceVideoId: pv.id, n };
}

export async function groupIdByIndex(studyId: string, idx: number): Promise<string> {
  return (await one<{ id: string }>(`select id from order_groups where study_id = $1 and group_index = $2`, [studyId, idx])).id;
}

export async function createParticipant(f: Fixture, code: string, groupIndex: number) {
  const gid = await groupIdByIndex(f.studyId, groupIndex);
  return one<{ id: string; order_group_id: string; status: string }>(
    `select * from create_participant_with_assignments($1, $2, 'hash', $3, null)`,
    [f.studyId, code, gid],
  );
}

export async function observationsOf(participantId: string) {
  return q<{
    id: string;
    video_id: string;
    presentation_order: number | null;
    is_practice: boolean;
    status: string;
    attempt_number: number;
    started_at: string | null;
    invalidated: boolean;
  }>(`select * from observations where participant_id = $1 order by is_practice, presentation_order, attempt_number`, [participantId]);
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}

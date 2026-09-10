import Link from "next/link";
import { Kpi, Notice, PageHeader, PassBadge, Section, StatusBadge, Table, Td, fmtDate } from "@/components/admin/ui";
import { getCurrentStudy, getDashboard } from "@/lib/services/admin/study";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const study = await getCurrentStudy();
  const { kpi, videos, groups, checks, inProgress, issues } = await getDashboard(study.id);
  const P = kpi.participant_target ?? 0;
  const total = kpi.total_observation_target ?? 0;

  return (
    <>
      <PageHeader title="대시보드" description={`${study.name} (${study.code})`} />
      {kpi.data_collection_complete && <Notice tone="ok">DATA COLLECTION COMPLETE — 목표 수집 조건을 모두 만족했습니다.</Notice>}
      {(kpi.research_videos_uploaded ?? 0) < (kpi.video_count ?? 0) && (
        <Notice tone="warn">
          영상 파일이 등록된 연구영상이 {kpi.research_videos_uploaded}/{kpi.video_count}편입니다. <Link className="underline" href="/admin/videos">영상 관리</Link>
        </Notice>
      )}
      {!kpi.structure_locked_at && study.status === "active" && <Notice tone="info">아직 시작된 관찰이 없습니다. 첫 관찰이 시작되면 영상·순서그룹 구조가 잠깁니다.</Notice>}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="등록 참여자" value={`${kpi.registered_participants} / ${P}`} sub={`탈락 ${kpi.dropped_participants}`} />
        <Kpi label="완료 참여자" value={kpi.completed_participants} tone={kpi.completed_participants === P ? "ok" : "neutral"} />
        <Kpi label="진행 중 / 미시작" value={`${kpi.in_progress_participants} / ${kpi.not_started_participants}`} />
        <Kpi label="유효 교사 기록" value={`${kpi.valid_observations} / ${total}`} tone={kpi.valid_observations === total ? "ok" : "neutral"} />
        <Kpi label="기술오류·무효화 기록" value={kpi.technical_issue_observations} tone={kpi.technical_issue_observations ? "warn" : "neutral"} />
        <Kpi label="진행 중 관찰" value={kpi.in_progress_observations} />
        <Kpi label="AI 기술문" value={`${kpi.ai_videos_complete} / ${kpi.video_count} 영상 완료`} sub={`총 ${kpi.ai_runs_total}건`} />
        <Kpi label="Reference Annotation" value={`${kpi.reference_videos_done} / ${kpi.video_count} 영상`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="영상별 유효 기록">
          <Table head={["영상", "제목", "유효", "목표", "무효화"]}>
            {videos.map((v) => (
              <tr key={v.video_id}>
                <Td mono>{v.code}</Td>
                <Td>{v.title_admin}</Td>
                <Td mono className={(v.valid_count ?? 0) >= P ? "text-emerald-700" : ""}>{v.valid_count}</Td>
                <Td mono>{v.target_count}</Td>
                <Td mono>{v.invalidated_count}</Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="순서그룹 배정">
          <Table head={["그룹", "순서", "유효 배정", "완료", "목표"]}>
            {groups.map((g) => (
              <tr key={g.order_group_id}>
                <Td mono>{g.code}</Td>
                <Td className="text-xs">{g.sequence}</Td>
                <Td mono>{g.assigned_valid}</Td>
                <Td mono>{g.completed_valid}</Td>
                <Td mono>{g.target_participants}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>

      <Section title="균형 검증">
        <Table head={["항목", "기대", "실제", "결과"]}>
          {checks.map((c) => (
            <tr key={c.check_name}>
              <Td mono>{c.check_name}</Td>
              <Td mono>{c.expected}</Td>
              <Td mono>{c.actual}</Td>
              <Td>
                <PassBadge pass={!!c.pass} label={c.check_name === "balanced_possible" && !c.pass ? "WARN" : undefined} />
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="진행 중인 관찰 (서버 기준 남은 시간)">
          <Table head={["참여자", "영상", "순서", "시작", "남은 시간"]} empty="진행 중인 관찰이 없습니다">
            {inProgress.map((o) => (
              <tr key={o.observation_id}>
                <Td mono>{o.participant_code}</Td>
                <Td mono>{o.video_code}</Td>
                <Td mono>{o.presentation_order}</Td>
                <Td className="text-xs">{fmtDate(o.started_at)}</Td>
                <Td mono className={Number(o.remaining_seconds) <= 0 ? "text-red-700" : ""}>{Math.round(Number(o.remaining_seconds))}초</Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="기술 오류가 있는 참여자">
          <Table head={["참여자", "그룹", "상태", ""]} empty="없음">
            {issues.map((p) => (
              <tr key={p.participant_id}>
                <Td mono>{p.participant_code}</Td>
                <Td mono>{p.order_group}</Td>
                <Td>
                  <StatusBadge status={p.status ?? ""} />
                </Td>
                <Td>
                  <Link className="underline" href={`/admin/participants/${p.participant_id}`}>
                    상세
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </>
  );
}

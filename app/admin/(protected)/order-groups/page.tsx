import { ActionForm } from "@/components/admin/ActionForm";
import { Notice, PageHeader, PassBadge, Section, Table, Td, fmtDate } from "@/components/admin/ui";
import { getCurrentStudy, getOrderGroups } from "@/lib/services/admin/study";
import { getServiceClient } from "@/lib/db/service-client";
import { regenerateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrderGroupsPage() {
  const study = await getCurrentStudy();
  const { groups, checks, targets } = await getOrderGroups(study.id);
  const { count: videoCount } = await getServiceClient().from("videos").select("id", { count: "exact", head: true }).eq("study_id", study.id).eq("kind", "research").eq("active", true);
  const locked = !!study.structure_locked_at;
  const mismatch = (videoCount ?? 0) !== targets.video_count;

  return (
    <>
      <PageHeader title="순서그룹" description={`영상 ${targets.video_count}편 → 그룹 ${targets.video_count}개 (순환 라틴방진) · 그룹당 목표 ${targets.per_group_target}명`} />
      {locked && <Notice tone="info">구조 잠김 ({fmtDate(study.structure_locked_at)}): 첫 관찰이 시작되어 순서그룹·영상 편수를 변경할 수 없습니다.</Notice>}
      {!locked && mismatch && (
        <Notice tone="warn">
          활성 연구영상 {videoCount}편, 설정 편수 {targets.video_count}편 — 재생성 전에 영상 관리에서 맞춰 주세요.
        </Notice>
      )}
      {!targets.balanced_possible && <Notice tone="warn">P={targets.participant_target}, N={targets.video_count} 는 나누어떨어지지 않아 완전 균형이 불가능합니다.</Notice>}

      <Section
        title={`그룹 (${groups.length})`}
        actions={
          !locked && (
            <ActionForm action={regenerateAction} submitLabel="순서그룹 재생성" confirm="기존 배정(미시작)과 순서그룹을 모두 새로 만듭니다. 계속할까요?">
              <span className="sr-only">재생성</span>
            </ActionForm>
          )
        }
      >
        <Table head={["그룹", "제시순서", "유효 배정", "완료", "탈락", "목표", "세대"]} empty="순서그룹이 없습니다. 영상을 등록한 뒤 재생성하세요.">
          {groups.map((g) => (
            <tr key={g.order_group_id}>
              <Td mono>{g.code}</Td>
              <Td className="text-xs">{g.sequence}</Td>
              <Td mono className={g.assigned_valid === g.target_participants ? "text-emerald-700" : ""}>{g.assigned_valid}</Td>
              <Td mono>{g.completed_valid}</Td>
              <Td mono>{g.dropped}</Td>
              <Td mono>{g.target_participants}</Td>
              <Td mono>{g.generation}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Validation">
        <Table head={["항목", "기대", "실제", "결과", "상세"]}>
          {checks.map((c) => (
            <tr key={c.check_name}>
              <Td mono>{c.check_name}</Td>
              <Td mono>{c.expected}</Td>
              <Td mono>{c.actual}</Td>
              <Td>
                <PassBadge pass={!!c.pass} label={c.check_name === "balanced_possible" && !c.pass ? "WARN" : undefined} />
              </Td>
              <Td className="max-w-xl font-mono text-xs">{JSON.stringify(c.detail)}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

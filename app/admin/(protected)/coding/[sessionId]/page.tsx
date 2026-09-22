import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { ClaimSelector } from "@/components/admin/ClaimSelector";
import { fmtDate, fmtTime, Notice, PageHeader, Section, Table, Td } from "@/components/admin/ui";
import { draftMatchesCoding } from "@/lib/coding/draftClaims";
import { AppError } from "@/lib/errors";
import { getWorkspace } from "@/lib/services/admin/coding";
import { signVideoForAdmin } from "@/lib/services/videos";
import { addClaimAction, autoSplitAction, codeClaimAction, deleteClaimAction, sessionStatusAction, updateClaimAction } from "../actions";

export const dynamic = "force-dynamic";

const SUPPORT: [string, string][] = [
  ["observed", "observed — 영상에서 확인되는 사실적 기술"],
  ["inference_supported", "inference_supported — 영상 근거가 있는 해석"],
  ["inference_unsupported", "inference_unsupported — 근거 없는 해석"],
  ["hallucination", "hallucination — 영상으로 확인되지 않는 사실적 기술"],
  ["unclear", "unclear — 판단 불가"],
];
const ACC: [string, string][] = [
  ["", "—"],
  ["correct", "correct"],
  ["partial", "partial"],
  ["incorrect", "incorrect"],
  ["not_applicable", "n/a"],
];
const ms = (v: number | null) => (v === null ? "" : `${(v / 1000).toFixed(1)}`);

export default async function CodingWorkspacePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  let ws;
  try {
    ws = await getWorkspace(sessionId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { session, source, referenceEvents, claims, video } = ws;
  const signed = video?.storage_path ? await signVideoForAdmin(session.video_id).catch(() => null) : null;
  const open = session.status === "open";
  const uncoded = claims.filter((c) => !c.coding).length;
  const isDraft = (k: { draft_source: string | null; reviewed_at: string | null } | null) => !!k && k.draft_source !== null && k.reviewed_at === null;
  const unreviewed = claims.filter((c) => isDraft(c.coding)).length;
  const draftTotal = claims.filter((c) => c.coding?.draft_source).length;
  const draftSource = session.draft_source ?? claims.find((c) => c.coding?.draft_source)?.coding?.draft_source ?? null;
  const draftChanged = (k: NonNullable<(typeof claims)[number]["coding"]>) => !draftMatchesCoding(k.draft_values as Record<string, unknown> | null, k);

  return (
    <>
      <PageHeader
        title={`${video?.code} · ${source?.source_type === "teacher" ? "교사" : "AI"} ${source?.source_label ?? ""}`}
        description={`세션 ${session.status}${session.finalized_at ? ` · 확정 ${fmtDate(session.finalized_at)}` : ""} · Claim ${claims.length} (미코딩 ${uncoded}${draftTotal ? `, 초안 미확인 ${unreviewed}/${draftTotal}` : ""})`}
        actions={
          <Link className="text-sm underline" href="/admin/coding">
            목록
          </Link>
        }
      />
      {!open && <Notice tone="info">확정된 세션입니다. 수정하려면 아래에서 다시 여세요.</Notice>}
      {open && unreviewed > 0 && (
        <Notice tone="warn">
          초안({draftSource}) 코딩 {unreviewed}건이 아직 확인되지 않았습니다. 각 Claim 의 값을 검토하고 필요하면 수정한 뒤 <b>확인 후 저장</b>을 누르세요. 모두 확인해야 확정할 수 있습니다.
        </Notice>
      )}
      {referenceEvents.length === 0 && <Notice tone="warn">이 영상에 Reference Event 가 없습니다. 먼저 Reference Annotation 을 작성하세요.</Notice>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="영상">
          {signed ? <video src={signed.url} controls controlsList="nodownload" preload="metadata" className="w-full rounded bg-black" /> : <p className="text-sm text-muted-foreground">영상 파일 없음</p>}
        </Section>
        <Section title={`Reference Events (${referenceEvents.length})`}>
          <div className="max-h-[420px] overflow-auto">
            <Table head={["코드", "시간", "행위자", "행동", "대상", "신체/도구", "관계"]}>
              {referenceEvents.map((r) => (
                <tr key={r.id}>
                  <Td mono>{r.event_code}</Td>
                  <Td mono className="whitespace-nowrap text-xs">
                    {ms(r.start_ms)}–{ms(r.end_ms)}
                  </Td>
                  <Td>{r.actor}</Td>
                  <Td>{r.action}</Td>
                  <Td>{r.object}</Td>
                  <Td>{r.body_part_or_tool}</Td>
                  <Td className="text-xs">{r.relation}</Td>
                </tr>
              ))}
            </Table>
          </div>
        </Section>
      </div>

      <Section
        title="원문 (읽기 전용) → Claim 분할"
        actions={
          open && claims.length === 0 ? (
            <ActionForm action={autoSplitAction} submitLabel="문장 단위 자동 분할">
              <input type="hidden" name="session_id" value={session.id} />
            </ActionForm>
          ) : null
        }
      >
        <ClaimSelector text={source?.text ?? ""} sessionId={session.id} action={addClaimAction} disabled={!open} />
      </Section>

      <Section title={`Claim 코딩 (${claims.length})`}>
        <div className="space-y-4">
          {claims.map((c) => {
            const k = c.coding;
            const draft = isDraft(k);
            // 저장(서버 액션) 후 React 가 폼을 자동 초기화하므로, 코딩 행이 바뀌면 카드를 다시 마운트해 저장된 값이 기본값이 되게 한다.
            const cardKey = `${c.id}:${k?.updated_at ?? "none"}:${k?.reviewed_at ?? ""}`;
            return (
              <div key={cardKey} className={`rounded-lg border p-3 ${draft ? "border-amber-400 bg-amber-50/40" : k ? "border-emerald-200" : "border-amber-300"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">#{c.claim_order}</span>
                    {draft && <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900">초안 · 미확인</span>}
                    {k?.reviewed_at && (
                      <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                        {k.draft_source ? "확인됨" : "저장됨"} {fmtTime(k.reviewed_at)}
                        {k.draft_source && draftChanged(k) && " · 초안에서 수정"}
                      </span>
                    )}
                    {c.claim_text}
                    {c.char_start !== null && <span className="ml-2 font-mono text-xs text-muted-foreground">[{c.char_start}–{c.char_end}]</span>}
                  </p>
                  {open && (
                    <div className="flex shrink-0 gap-2">
                      <details>
                        <summary className="cursor-pointer text-xs underline">텍스트 수정</summary>
                        <ActionForm action={updateClaimAction} submitLabel="저장" className="mt-1 w-72">
                          <input type="hidden" name="session_id" value={session.id} />
                          <input type="hidden" name="claim_id" value={c.id} />
                          <textarea name="text" defaultValue={c.claim_text} className={`${inputCls} min-h-16`} />
                        </ActionForm>
                      </details>
                      <ActionForm action={deleteClaimAction} submitLabel="삭제" confirm="이 Claim 과 코딩을 삭제할까요?">
                        <input type="hidden" name="session_id" value={session.id} />
                        <input type="hidden" name="claim_id" value={c.id} />
                      </ActionForm>
                    </div>
                  )}
                </div>
                <ActionForm action={codeClaimAction} submitLabel={draft ? "확인 후 저장" : k ? "코딩 갱신" : "코딩 저장"} className="mt-3">
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="claim_id" value={c.id} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <Field label="support_type">
                      <select name="support_type" defaultValue={k?.support_type ?? "observed"} className={inputCls} disabled={!open}>
                        {SUPPORT.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="대응 Reference Event" hint="observed / inference_supported 일 때">
                      <select name="matched_reference_event_id" defaultValue={k?.matched_reference_event_id ?? ""} className={inputCls} disabled={!open}>
                        <option value="">없음</option>
                        {referenceEvents.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.event_code} {r.actor} {r.action} {r.object ?? ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="granularity (1 포괄 – 3 구체)">
                      <select name="granularity_score" defaultValue={k?.granularity_score ?? ""} className={inputCls} disabled={!open}>
                        <option value="">—</option>
                        <option value="1">1 포괄적</option>
                        <option value="2">2 중간</option>
                        <option value="3">3 구체적</option>
                      </select>
                    </Field>
                    {(["actor", "action", "object", "temporal"] as const).map((dim) => (
                      <Field key={dim} label={`${dim}_accuracy`}>
                        <select name={`${dim}_accuracy`} defaultValue={(k as Record<string, unknown> | null)?.[`${dim}_accuracy`] as string ?? ""} className={inputCls} disabled={!open}>
                          {ACC.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                    <Field label="코더 메모">
                      <input name="notes" defaultValue={k?.notes ?? ""} className={inputCls} disabled={!open} />
                    </Field>
                  </div>
                </ActionForm>
              </div>
            );
          })}
          {claims.length === 0 && <p className="text-sm text-muted-foreground">Claim 이 없습니다. 원문에서 선택하거나 자동 분할하세요.</p>}
        </div>
      </Section>

      <Section title="세션">
        {open && unreviewed > 0 && <p className="mb-2 text-sm text-amber-800">미확인 초안 {unreviewed}건을 모두 확인 후 저장해야 확정할 수 있습니다.</p>}
        <ActionForm action={sessionStatusAction} submitLabel={open ? "코딩 확정 (finalize)" : "다시 열기"} confirm={open ? "모든 Claim 코딩을 확정할까요? 확정 후 분석 지표에 반영됩니다." : undefined}>
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="status" value={open ? "finalized" : "open"} />
          <Field label="세션 메모">
            <input name="notes" defaultValue={session.notes ?? ""} className={inputCls} />
          </Field>
        </ActionForm>
      </Section>
    </>
  );
}

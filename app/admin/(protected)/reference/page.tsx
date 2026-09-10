import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { ReferencePlayer } from "@/components/admin/ReferencePlayer";
import { Notice, PageHeader, Section, Table, Td, fmtDate } from "@/components/admin/ui";
import { getServiceClient } from "@/lib/db/service-client";
import { listReferenceEvents, listReferenceVersions } from "@/lib/services/admin/reference";
import { getCurrentStudy } from "@/lib/services/admin/study";
import { listVideos } from "@/lib/services/admin/videos";
import { signVideoForAdmin } from "@/lib/services/videos";
import { createEventAction, deleteEventAction, importReferenceAction, moveEventAction, updateEventAction } from "./actions";

export const dynamic = "force-dynamic";

const ms = (v: number | null) => (v === null ? "" : `${(v / 1000).toFixed(1)}s`);

export default async function ReferencePage({ searchParams }: { searchParams: Promise<{ video?: string; history?: string }> }) {
  const { video: videoParam, history } = await searchParams;
  const study = await getCurrentStudy();
  const videos = (await listVideos(study.id)).filter((v) => v.kind === "research" && v.active);
  const video = videos.find((v) => v.id === videoParam) ?? videos[0];
  if (!video) {
    return (
      <>
        <PageHeader title="Reference Annotation" />
        <Notice tone="warn">연구영상이 없습니다.</Notice>
      </>
    );
  }
  const [events, signed, { data: progress }] = await Promise.all([
    listReferenceEvents(video.id),
    video.storage_path ? signVideoForAdmin(video.id).catch(() => null) : Promise.resolve(null),
    getServiceClient().from("v_coding_progress").select("video_code, reference_events").eq("study_id", study.id),
  ]);
  const versions = history ? await listReferenceVersions(history) : [];

  return (
    <>
      <PageHeader title="Reference Annotation" description="기준 행동단위 = [행위자] + [행동] + [대상] + [신체/도구] + [관계] + [시간적 순서]. 관찰 사실만 기록하고 내적 상태 단정(원한다·좋아한다 등)은 제외합니다." />
      <form className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="video-select">영상</label>
        <select id="video-select" name="video" defaultValue={video.id} className="rounded border bg-background px-2 py-1">
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} {v.title_admin} ({progress?.find((p) => p.video_code === v.code)?.reference_events ?? 0} events)
            </option>
          ))}
        </select>
        <button className="rounded border px-3 py-1 hover:bg-muted">이동</button>
        <a className="ml-auto text-xs underline" href={`/api/exports/reference_events?format=csv`}>
          reference_events.csv (전체)
        </a>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`${video.code} · ${video.title_admin}`}>
          <ReferencePlayer src={signed?.url ?? null} />
        </Section>
        <Section title="Event 추가">
          <div id="new-event">
            <ActionForm action={createEventAction} submitLabel="추가">
              <input type="hidden" name="video_id" value={video.id} />
              <div className="grid grid-cols-3 gap-2">
                <Field label="코드 (자동)">
                  <input name="event_code" placeholder={`E${String(events.length + 1).padStart(2, "0")}`} className={inputCls} />
                </Field>
                <Field label="시작 (ms 또는 mm:ss.s)">
                  <input name="start" className={inputCls} />
                </Field>
                <Field label="종료">
                  <input name="end" className={inputCls} />
                </Field>
                <Field label="행위자 *">
                  <input name="actor" placeholder="아동 A" className={inputCls} required />
                </Field>
                <Field label="행동 *">
                  <input name="action" placeholder="집는다" className={inputCls} required />
                </Field>
                <Field label="대상">
                  <input name="object" placeholder="빨간 블록" className={inputCls} />
                </Field>
                <Field label="신체/도구">
                  <input name="body_part_or_tool" placeholder="오른손" className={inputCls} />
                </Field>
                <Field label="관계">
                  <input name="relation" placeholder="사물 조작" className={inputCls} />
                </Field>
                <Field label="시간적 순서">
                  <input name="temporal_relation" placeholder="E01 이후" className={inputCls} />
                </Field>
                <Field label="이전 Event">
                  <select name="previous_event_id" className={inputCls} defaultValue="">
                    <option value="">없음</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.event_code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="행동 유형">
                  <input name="behavior_category" placeholder="사물조작 / 시선 / 상호작용" className={inputCls} />
                </Field>
                <Field label="메모">
                  <input name="notes" className={inputCls} />
                </Field>
              </div>
              <Field label="기준 행동문">
                <input name="reference_sentence" placeholder="아동 A가 오른손으로 빨간 블록을 집는다." className={inputCls} />
              </Field>
            </ActionForm>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">CSV import (event_code 가 같으면 갱신)</summary>
            <p className="mt-1 text-xs text-muted-foreground">열: event_code, event_order, start, end, actor*, action*, object, body_part_or_tool, relation, temporal_relation, reference_sentence, behavior_category, notes</p>
            <ActionForm action={importReferenceAction} submitLabel="import" className="mt-2">
              <input type="hidden" name="video_id" value={video.id} />
              <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
              <Field label="또는 CSV 텍스트">
                <textarea name="csv_text" className={`${inputCls} min-h-20 font-mono text-xs`} />
              </Field>
            </ActionForm>
          </details>
        </Section>
      </div>

      <Section title={`Reference Events (${events.length})`}>
        <Table head={["순서", "코드", "시간", "행위자", "행동", "대상", "신체/도구", "관계", "시간적 순서", "유형", "기준 행동문", "이동", "편집", ""]} empty="아직 Event 가 없습니다">
          {events.map((e, idx) => (
            <tr key={e.id}>
              <Td mono>{e.event_order}</Td>
              <Td mono>{e.event_code}</Td>
              <Td mono className="whitespace-nowrap text-xs">
                {ms(e.start_ms)}–{ms(e.end_ms)}
              </Td>
              <Td>{e.actor}</Td>
              <Td>{e.action}</Td>
              <Td>{e.object}</Td>
              <Td>{e.body_part_or_tool}</Td>
              <Td>{e.relation}</Td>
              <Td className="text-xs">{e.temporal_relation}</Td>
              <Td className="text-xs">{e.behavior_category}</Td>
              <Td className="max-w-60 text-xs">{e.reference_sentence}</Td>
              <Td className="whitespace-nowrap">
                {idx > 0 && (
                  <ActionForm action={moveEventAction} submitLabel="↑" className="inline-block">
                    <input type="hidden" name="event_id" value={e.id} />
                    <input type="hidden" name="direction" value="up" />
                  </ActionForm>
                )}{" "}
                {idx < events.length - 1 && (
                  <ActionForm action={moveEventAction} submitLabel="↓" className="inline-block">
                    <input type="hidden" name="event_id" value={e.id} />
                    <input type="hidden" name="direction" value="down" />
                  </ActionForm>
                )}
              </Td>
              <Td>
                <details>
                  <summary className="cursor-pointer text-xs underline">편집</summary>
                  <ActionForm action={updateEventAction} submitLabel="저장" className="mt-2 w-80">
                    <input type="hidden" name="event_id" value={e.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <input name="event_code" defaultValue={e.event_code} className={inputCls} placeholder="코드" />
                      <input name="event_order" defaultValue={e.event_order} type="number" min={1} className={inputCls} placeholder="순서" />
                      <input name="start" defaultValue={e.start_ms ?? ""} className={inputCls} placeholder="시작 ms" />
                      <input name="end" defaultValue={e.end_ms ?? ""} className={inputCls} placeholder="종료 ms" />
                      <input name="actor" defaultValue={e.actor} className={inputCls} placeholder="행위자" required />
                      <input name="action" defaultValue={e.action} className={inputCls} placeholder="행동" required />
                      <input name="object" defaultValue={e.object ?? ""} className={inputCls} placeholder="대상" />
                      <input name="body_part_or_tool" defaultValue={e.body_part_or_tool ?? ""} className={inputCls} placeholder="신체/도구" />
                      <input name="relation" defaultValue={e.relation ?? ""} className={inputCls} placeholder="관계" />
                      <input name="temporal_relation" defaultValue={e.temporal_relation ?? ""} className={inputCls} placeholder="시간적 순서" />
                      <input name="behavior_category" defaultValue={e.behavior_category ?? ""} className={inputCls} placeholder="행동 유형" />
                      <input name="notes" defaultValue={e.notes ?? ""} className={inputCls} placeholder="메모" />
                    </div>
                    <input name="reference_sentence" defaultValue={e.reference_sentence ?? ""} className={inputCls} placeholder="기준 행동문" />
                    <input type="hidden" name="previous_event_id" value={e.previous_event_id ?? ""} />
                  </ActionForm>
                  <a className="mt-2 inline-block text-xs underline" href={`/admin/reference?video=${video.id}&history=${e.id}`}>
                    변경 이력
                  </a>
                </details>
              </Td>
              <Td>
                <ActionForm action={deleteEventAction} submitLabel="삭제" confirm="이 Event 를 삭제(soft delete) 할까요? 이력은 보존됩니다.">
                  <input type="hidden" name="event_id" value={e.id} />
                </ActionForm>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      {history && (
        <Section title="변경 이력 (변경 전 스냅샷)">
          <Table head={["시각", "작업", "스냅샷"]} empty="이력이 없습니다">
            {versions.map((v) => (
              <tr key={v.id}>
                <Td className="whitespace-nowrap text-xs">{fmtDate(v.created_at)}</Td>
                <Td mono>{v.operation}</Td>
                <Td className="max-w-3xl font-mono text-xs">{JSON.stringify(v.snapshot)}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </>
  );
}

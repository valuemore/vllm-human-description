import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { Notice, PageHeader, Section, Table, Td, fmtDate } from "@/components/admin/ui";
import { listPrompts, listRuns } from "@/lib/services/admin/ai";
import { getCurrentStudy } from "@/lib/services/admin/study";
import { listVideos } from "@/lib/services/admin/videos";
import { activatePromptAction, createPromptAction, createRunAction, importRunsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AiPage({ searchParams }: { searchParams: Promise<{ video?: string }> }) {
  const { video: videoFilter } = await searchParams;
  const study = await getCurrentStudy();
  const [prompts, runs, videos] = await Promise.all([listPrompts(study.id), listRuns(study.id), listVideos(study.id)]);
  const research = videos.filter((v) => v.kind === "research" && v.active);
  const activePrompts = prompts.filter((p) => p.active);
  const perVideo = research.map((v) => ({ video: v, runs: runs.filter((r) => r.video_id === v.id && !r.superseded_by) }));
  const shownRuns = videoFilter ? runs.filter((r) => r.video_code === videoFilter.toUpperCase()) : runs;

  return (
    <>
      <PageHeader title="AI 기술문" description={`참여자에게 노출되지 않음 · 영상당 목표 ${study.ai_runs_per_video}회 · 연구 영상을 외부 API 로 자동 전송하지 않고 관리자가 수동 등록/CSV import`} />
      {activePrompts.length === 0 && <Notice tone="warn">활성 프롬프트 버전이 없습니다. 먼저 프롬프트를 등록하세요.</Notice>}

      <Section title="영상 × run 현황">
        <Table head={["영상", "제목", "등록 run", "목표", "모델", ""]}>
          {perVideo.map(({ video, runs: rs }) => (
            <tr key={video.id}>
              <Td mono>{video.code}</Td>
              <Td>{video.title_admin}</Td>
              <Td mono className={rs.length >= study.ai_runs_per_video ? "text-emerald-700" : ""}>{rs.length}</Td>
              <Td mono>{study.ai_runs_per_video}</Td>
              <Td className="text-xs">{[...new Set(rs.map((r) => `${r.provider}/${r.model_name}`))].join(", ")}</Td>
              <Td>
                <a className="underline" href={`/admin/ai?video=${video.code}`}>
                  보기
                </a>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="프롬프트 버전">
          <Table head={["코드", "버전", "활성", "등록", "메모", ""]}>
            {prompts.map((p) => (
              <tr key={p.id}>
                <Td mono>{p.prompt_code}</Td>
                <Td mono>v{p.version}</Td>
                <Td>{p.active ? <span className="text-emerald-700">활성</span> : ""}</Td>
                <Td className="text-xs">{fmtDate(p.created_at)}</Td>
                <Td className="max-w-40 truncate text-xs">{p.notes}</Td>
                <Td>
                  {!p.active && (
                    <ActionForm action={activatePromptAction} submitLabel="활성화" confirm="이 버전을 활성 프롬프트로 지정할까요?">
                      <input type="hidden" name="prompt_id" value={p.id} />
                    </ActionForm>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">새 프롬프트 버전 등록</summary>
            <ActionForm action={createPromptAction} submitLabel="등록" className="mt-3">
              <Field label="프롬프트 코드" hint="같은 코드로 등록하면 버전이 올라갑니다 (기존 버전은 불변)">
                <input name="prompt_code" defaultValue="observe" className={inputCls} required />
              </Field>
              <Field label="프롬프트 본문">
                <textarea name="prompt_text" className={`${inputCls} min-h-32`} required />
              </Field>
              <Field label="메모">
                <input name="notes" className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="activate" value="1" defaultChecked /> 활성 버전으로 지정
              </label>
            </ActionForm>
          </details>
          {prompts.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">프롬프트 본문 보기</summary>
              {prompts.map((p) => (
                <pre key={p.id} className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                  [{p.prompt_code} v{p.version}] {p.prompt_text}
                </pre>
              ))}
            </details>
          )}
        </Section>

        <Section title="AI run 등록">
          <ActionForm action={createRunAction} submitLabel="등록">
            <div className="grid grid-cols-2 gap-3">
              <Field label="영상">
                <select name="video_id" className={inputCls} required>
                  {research.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} {v.title_admin}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="프롬프트 버전">
                <select name="prompt_id" className={inputCls} required defaultValue={activePrompts[0]?.id}>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prompt_code} v{p.version}
                      {p.active ? " (활성)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="제공자">
                <input name="provider" defaultValue="google" className={inputCls} required />
              </Field>
              <Field label="모델">
                <input name="model_name" placeholder="gemini-2.5-pro" className={inputCls} required />
              </Field>
              <Field label="모델 버전/스냅샷">
                <input name="model_version" className={inputCls} />
              </Field>
              <Field label="생성 시각">
                <input name="generated_at" type="datetime-local" className={inputCls} />
              </Field>
            </div>
            <Field label="생성 텍스트 (등록 후 불변)">
              <textarea name="generated_text" className={`${inputCls} min-h-40`} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="생성 설정 (JSON)">
                <input name="settings_json" placeholder='{"temperature":0.2}' className={inputCls} />
              </Field>
              <Field label="입력 설명 (파일/해상도 등)">
                <input name="input_description" className={inputCls} />
              </Field>
            </div>
            <Field label="대체할 기존 run (선택)" hint="기존 run 은 보존되고 superseded_by 로 연결됩니다">
              <select name="supersedes_run_id" className={inputCls} defaultValue="">
                <option value="">없음</option>
                {runs.filter((r) => !r.superseded_by).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.video_code} #{r.run_number} {r.model_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="메모">
              <input name="notes" className={inputCls} />
            </Field>
          </ActionForm>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">CSV import</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              열: video_code, provider, model_name, prompt_code, generated_text (필수) · run_number, model_version, prompt_version, generated_at, notes, settings_json (선택)
            </p>
            <ActionForm action={importRunsAction} submitLabel="import" className="mt-2">
              <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
              <Field label="또는 CSV 텍스트 붙여넣기">
                <textarea name="csv_text" className={`${inputCls} min-h-24 font-mono text-xs`} />
              </Field>
            </ActionForm>
          </details>
        </Section>
      </div>

      <Section title={`AI run 목록 (${shownRuns.length}${videoFilter ? ` · ${videoFilter}` : ""})`}>
        <Table head={["영상", "run", "모델", "프롬프트", "생성", "글자/단어/문장", "대체", "본문"]}>
          {shownRuns.map((r) => (
            <tr key={r.id} className={r.superseded_by ? "text-muted-foreground line-through" : ""}>
              <Td mono>{r.video_code}</Td>
              <Td mono>#{r.run_number}</Td>
              <Td className="text-xs">
                {r.provider}/{r.model_name}
                {r.model_version_or_snapshot ? ` (${r.model_version_or_snapshot})` : ""}
              </Td>
              <Td mono className="text-xs">
                {r.prompt_code} v{r.prompt_version}
              </Td>
              <Td className="text-xs">{fmtDate(r.generated_at ?? r.created_at)}</Td>
              <Td mono className="text-xs">
                {r.character_count}/{r.word_count}/{r.sentence_count}
              </Td>
              <Td className="text-xs">{r.superseded_by ? "대체됨" : ""}</Td>
              <Td>
                <details>
                  <summary className="cursor-pointer text-xs underline">보기</summary>
                  <pre className="mt-1 max-w-xl whitespace-pre-wrap text-xs">{r.generated_text}</pre>
                </details>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

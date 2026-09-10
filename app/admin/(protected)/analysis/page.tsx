import { Notice, PageHeader, Section, Table, Td } from "@/components/admin/ui";
import { METRIC_KEYS, METRIC_LABELS, getAnalysis } from "@/lib/services/admin/analysis";
import { getCurrentStudy } from "@/lib/services/admin/study";

export const dynamic = "force-dynamic";

const pct = (v: number | string | null | undefined) => (v === null || v === undefined ? "—" : typeof v === "number" && v <= 1 && v >= 0 ? `${(v * 100).toFixed(1)}%` : String(v));
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? "—" : String(v));
const QUADRANT: Record<string, string> = { both_detect: "인간·AI 모두 포착", human_only: "인간만 포착 (AI 누락)", ai_only: "AI만 포착 (인간 누락)", both_miss: "모두 누락", uncoded: "미코딩" };

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ dim?: string; video?: string; participant?: string; order?: string; run?: string; quadrant?: string }> }) {
  const sp = await searchParams;
  const study = await getCurrentStudy();
  const a = await getAnalysis(study.id, { video: sp.video || undefined, participant: sp.participant || undefined, order: sp.order ? Number(sp.order) : undefined, run: sp.run ? Number(sp.run) : undefined });
  const dim = sp.dim ?? "overall";
  const summaryRows = a.summary.filter((s) => s.dimension === dim);
  const hdr = sp.quadrant ? a.hdr.filter((h) => h.quadrant === sp.quadrant) : a.hdr;
  const sel = "rounded border bg-background px-2 py-1 text-sm";

  return (
    <>
      <PageHeader title="분석" description="기술통계와 분석용 원자료만 제공합니다. 추론통계(mixed-effects 등)는 export 파일로 R/Python/SPSS 에서 수행하세요." />
      <Notice tone="info">100건의 교사 기록은 교사 20명의 반복측정 자료입니다(교사 = random effect). AI 반복 run 은 모델 출력 변동성 확인용이며 독립 표본이 아닙니다.</Notice>

      <Section title="원자료 기반 즉시 산출 (PRD §32.1)">
        <form className="mb-3 flex gap-2 text-sm">
          {["overall", "video", "participant", "presentation_order"].map((d) => (
            <a key={d} href={`/admin/analysis?dim=${d}`} className={`rounded border px-3 py-1 ${dim === d ? "bg-muted font-medium" : "hover:bg-muted"}`}>
              {{ overall: "전체", video: "영상별", participant: "교사별", presentation_order: "제시순서별" }[d]}
            </a>
          ))}
        </form>
        <Table head={["키", "n", "wall(초)", "effective(초)", "첫시청(초)", "글자", "단어", "문장", "replay", "pause", "seek", "timeout 비율"]} empty="유효 제출 기록이 없습니다">
          {summaryRows.map((s) => (
            <tr key={`${s.dimension}-${s.key}`}>
              <Td mono>{s.key}</Td>
              <Td mono>{s.n}</Td>
              <Td mono>{num(s.avg_wall_seconds)}</Td>
              <Td mono>{num(s.avg_effective_seconds)}</Td>
              <Td mono>{num(s.avg_first_watch_seconds)}</Td>
              <Td mono>{num(s.avg_characters)}</Td>
              <Td mono>{num(s.avg_words)}</Td>
              <Td mono>{num(s.avg_sentences)}</Td>
              <Td mono>{num(s.avg_replay)}</Td>
              <Td mono>{num(s.avg_pause)}</Td>
              <Td mono>{num(s.avg_seek)}</Td>
              <Td mono>{pct(s.timeout_rate === null ? null : Number(s.timeout_rate))}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="코딩 진행">
        <Table head={["영상", "Reference Events", "교사 확정/전체", "AI 확정/전체"]}>
          {a.progress.map((p) => (
            <tr key={p.video_id}>
              <Td mono>{p.video_code}</Td>
              <Td mono>{p.reference_events}</Td>
              <Td mono>
                {p.teacher_finalized}/{p.teacher_sources}
              </Td>
              <Td mono>
                {p.ai_finalized}/{p.ai_sources}
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      <form className="mb-4 flex flex-wrap gap-2 text-sm">
        <input type="hidden" name="dim" value={dim} />
        <input name="video" defaultValue={sp.video ?? ""} placeholder="영상 (V01)" className={sel} />
        <input name="participant" defaultValue={sp.participant ?? ""} placeholder="교사 (T01)" className={sel} />
        <input name="order" defaultValue={sp.order ?? ""} placeholder="제시순서" type="number" min={1} className={`${sel} w-24`} />
        <input name="run" defaultValue={sp.run ?? ""} placeholder="AI run #" type="number" min={1} className={`${sel} w-24`} />
        <button className="rounded border px-3 py-1 hover:bg-muted">필터</button>
        <a href="/admin/analysis" className="text-xs underline">
          초기화
        </a>
      </form>

      <Section title="코딩 기반 지표 (확정 세션, 기록별 평균) — 교사 vs AI">
        <Table head={["출처", "영상", "n", ...METRIC_KEYS.map((k) => METRIC_LABELS[k])]} empty="확정된 코딩 세션이 없습니다">
          {[...a.bySource, ...a.bySourceVideo, ...a.byOrder].map((g, i) => (
            <tr key={i} className={g.video_code === "ALL" ? "font-medium" : ""}>
              <Td>{g.source_type === "teacher" ? "교사" : "AI"}</Td>
              <Td mono>{g.video_code}</Td>
              <Td mono>{g.n}</Td>
              {METRIC_KEYS.map((k) => (
                <Td key={k} mono>
                  {k === "granularity_mean" ? num(g[k]) : pct(g[k])}
                </Td>
              ))}
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="기록별 지표 (Claim Coding 결과)">
        <Table head={["출처", "영상", "라벨", "순서", "Claim", "observed", "halluc.", "inference", "matched/ref", ...METRIC_KEYS.slice(0, 7).map((k) => METRIC_LABELS[k])]} empty="확정된 코딩 세션이 없습니다">
          {a.metrics.map((m) => (
            <tr key={`${m.source_record_id}-${m.coder_id}`}>
              <Td>{m.source_type === "teacher" ? "교사" : "AI"}</Td>
              <Td mono>{m.video_code}</Td>
              <Td mono>{m.source_label}</Td>
              <Td mono>{m.presentation_order ?? "—"}</Td>
              <Td mono>{m.claim_total}</Td>
              <Td mono>{m.observed}</Td>
              <Td mono>{m.hallucination}</Td>
              <Td mono>{(m.inference_supported ?? 0) + (m.inference_unsupported ?? 0)}</Td>
              <Td mono>
                {m.matched_events}/{m.reference_total}
              </Td>
              {METRIC_KEYS.slice(0, 7).map((k) => (
                <Td key={k} mono>
                  {pct(m[k] === null ? null : Number(m[k]))}
                </Td>
              ))}
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title="Human Detection Rate (Reference Event 별)"
        actions={
          <form className="flex gap-2 text-sm">
            <input type="hidden" name="dim" value={dim} />
            <select name="quadrant" defaultValue={sp.quadrant ?? ""} className={sel}>
              <option value="">전체</option>
              {Object.entries(QUADRANT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="rounded border px-3 py-1 hover:bg-muted">필터</button>
          </form>
        }
      >
        <p className="mb-2 text-xs text-muted-foreground">Human Detection Rate = 해당 Event 를 기술한 교사 수 / 확정 코딩된 교사 기록 수. AI detected = 확정 코딩된 AI run 중 하나라도 포착.</p>
        <Table head={["영상", "Event", "행위자·행동·대상", "유형", "교사 포착", "코딩/유효", "HDR", "AI run 포착", "분류"]} empty="Reference Event 가 없습니다">
          {hdr.map((h) => (
            <tr key={h.reference_event_id}>
              <Td mono>{h.video_code}</Td>
              <Td mono>{h.event_code}</Td>
              <Td className="text-xs">
                {h.actor} · {h.action} · {h.object ?? ""}
              </Td>
              <Td className="text-xs">{h.behavior_category}</Td>
              <Td mono>{h.teacher_detected}</Td>
              <Td mono>
                {h.teacher_coded}/{h.teacher_valid_total}
              </Td>
              <Td mono>{pct(h.human_detection_rate === null ? null : Number(h.human_detection_rate))}</Td>
              <Td mono>
                {h.ai_detected_runs}/{h.ai_coded_runs}
              </Td>
              <Td className="text-xs">{QUADRANT[h.quadrant ?? "uncoded"]}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

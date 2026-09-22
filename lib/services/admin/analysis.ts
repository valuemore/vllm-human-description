import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { fromDbError } from "@/lib/errors";

export type MetricFilters = { video?: string; participant?: string; order?: number; run?: number };

const METRIC_KEYS = ["precision", "recall", "f1", "omission_rate", "hallucination_rate", "unreferenced_rate", "inference_rate", "temporal_fidelity", "actor_accuracy", "action_accuracy", "object_accuracy", "granularity_mean"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const METRIC_LABELS: Record<MetricKey, string> = {
  precision: "Precision",
  recall: "Recall",
  f1: "F1",
  omission_rate: "Omission",
  hallucination_rate: "Hallucination",
  unreferenced_rate: "Unref. detail",
  inference_rate: "Inference",
  temporal_fidelity: "Temporal",
  actor_accuracy: "Actor",
  action_accuracy: "Action",
  object_accuracy: "Object",
  granularity_mean: "Granularity",
};
export { METRIC_KEYS };

function mean(vals: (number | null)[]) {
  const xs = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null;
}

export async function getAnalysis(studyId: string, f: MetricFilters = {}) {
  const sb = getServiceClient();
  const [summary, metricsRes, hdrRes, progressRes, obsRes] = await Promise.all([
    sb.from("v_analysis_summary").select("*").eq("study_id", studyId).order("dimension").order("key"),
    sb.from("v_claim_metrics_full").select("*").eq("study_id", studyId).eq("session_status", "finalized"),
    sb.from("v_human_detection_rate").select("*").eq("study_id", studyId).order("video_code").order("event_order"),
    sb.from("v_coding_progress").select("*").eq("study_id", studyId).order("video_code"),
    sb.from("v_observation_metrics").select("observation_id, participant_code, presentation_order, order_group").eq("study_id", studyId).eq("is_practice", false),
  ]);
  if (metricsRes.error) throw fromDbError(metricsRes.error);
  const obsById = new Map((obsRes.data ?? []).map((o) => [o.observation_id, o]));

  let metrics = (metricsRes.data ?? []).map((m) => {
    const o = m.source_type === "teacher" ? obsById.get(m.source_record_id ?? "") : undefined;
    return { ...m, participant_code: o?.participant_code ?? null, presentation_order: o?.presentation_order ?? null, order_group: o?.order_group ?? null };
  });
  if (f.video) metrics = metrics.filter((m) => m.video_code === f.video!.toUpperCase());
  if (f.participant) metrics = metrics.filter((m) => m.participant_code === f.participant!.toUpperCase());
  if (f.order) metrics = metrics.filter((m) => m.presentation_order === f.order);
  if (f.run) metrics = metrics.filter((m) => m.source_type !== "ai" || m.run_number === f.run);

  type Agg = { source_type: string; video_code: string; n: number } & Record<MetricKey, number | null>;
  const groupBy = (keyFn: (m: (typeof metrics)[number]) => string, label: (m: (typeof metrics)[number]) => Pick<Agg, "source_type" | "video_code">) => {
    const groups = new Map<string, (typeof metrics)[number][]>();
    for (const m of metrics) {
      const k = keyFn(m);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(m);
    }
    return [...groups.values()].map((rows) => ({
      ...label(rows[0]),
      n: rows.length,
      ...(Object.fromEntries(METRIC_KEYS.map((k) => [k, mean(rows.map((r) => (r[k] === null ? null : Number(r[k]))))])) as Record<MetricKey, number | null>),
    })) as Agg[];
  };
  const bySource = groupBy((m) => m.source_type ?? "", (m) => ({ source_type: m.source_type ?? "", video_code: "ALL" }));
  const bySourceVideo = groupBy((m) => `${m.source_type}|${m.video_code}`, (m) => ({ source_type: m.source_type ?? "", video_code: m.video_code ?? "" })).sort((a, b) => a.video_code.localeCompare(b.video_code) || a.source_type.localeCompare(b.source_type));
  const byOrder = groupBy((m) => `${m.source_type}|${m.presentation_order ?? "-"}`, (m) => ({ source_type: m.source_type ?? "", video_code: m.presentation_order ? `순서 ${m.presentation_order}` : "—" })).filter((g) => g.source_type === "teacher");

  return {
    summary: summary.data ?? [],
    metrics,
    bySource,
    bySourceVideo,
    byOrder,
    hdr: (hdrRes.data ?? []).filter((h) => !f.video || h.video_code === f.video.toUpperCase()),
    progress: progressRes.data ?? [],
  };
}

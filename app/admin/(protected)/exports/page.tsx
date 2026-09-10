import { Notice, PageHeader, Section, Table, Td } from "@/components/admin/ui";
import { ALL_DATASETS } from "@/lib/export/datasets";
import { getCurrentStudy } from "@/lib/services/admin/study";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const study = await getCurrentStudy();
  return (
    <>
      <PageHeader title="데이터 Export" description={`${study.code} · CSV(UTF-8 BOM) / XLSX · 모든 export 는 감사로그에 기록됩니다`} />
      <Notice tone="info">
        분석용 파일에는 participant_code · video_code · order_group · presentation_order · observation_id 가 유지됩니다. 100건의 기록은 교사 20명의 반복측정 자료이며 독립 표본이 아닙니다
        (예: <code>Outcome ~ Video + Order + (1 | Teacher)</code>). 추론통계는 R/Python/SPSS 에서 수행하세요.
      </Notice>
      <Section
        title="전체 묶음"
        actions={
          // 파일 다운로드(API) 링크는 클라이언트 라우팅 대상이 아니다
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a className="rounded border px-3 py-1 text-sm hover:bg-muted" href="/api/exports/all?format=xlsx">
            all.xlsx (interaction_events 제외, 시트별)
          </a>
        }
      >
        <p className="text-sm text-muted-foreground">interaction_events 는 행 수가 많아 개별 파일로만 제공합니다.</p>
      </Section>
      <Section title="데이터셋">
        <Table head={["파일", "설명", "행 단위", "변수 수", "다운로드"]}>
          {ALL_DATASETS.map((d) => (
            <tr key={d.name}>
              <Td mono>{d.name}</Td>
              <Td>
                <span className="font-medium">{d.title}</span>
                <br />
                <span className="text-xs text-muted-foreground">{d.description}</span>
              </Td>
              <Td className="text-xs">{d.grain}</Td>
              <Td mono>{d.columns.length}</Td>
              <Td className="whitespace-nowrap">
                <a className="underline" href={`/api/exports/${d.name}?format=csv`}>
                  CSV
                </a>
                {" · "}
                <a className="underline" href={`/api/exports/${d.name}?format=xlsx`}>
                  XLSX
                </a>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

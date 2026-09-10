import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { loadConfig } from "./helpers";

config({ path: ".env.local", quiet: true });
const EMAIL = process.env.SEED_ADMIN_EMAIL!;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const cfg = loadConfig();

test.describe.configure({ mode: "serial" });

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("이메일").fill(EMAIL);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.locator("#study-switch").selectOption({ label: `${cfg.code} · active` });
  await page.getByRole("button", { name: "전환" }).click();
  await expect(page.getByText(`E2E 테스트 연구 (${cfg.code})`)).toBeVisible();
}

test("AI: 프롬프트 버전 등록 → run 등록 (텍스트 불변 레이어)", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/ai");
  await page.locator("details", { hasText: "새 프롬프트 버전 등록" }).locator("summary").click();
  await page.locator('textarea[name="prompt_text"]').fill("영상에서 관찰되는 행동을 사실 중심으로 기술하세요.");
  await page.getByRole("button", { name: "등록", exact: true }).first().click();
  await expect(page.getByRole("cell", { name: "v1" })).toBeVisible();
  await page.locator('input[name="model_name"]').fill("gemini-test");
  await page.locator('textarea[name="generated_text"]').fill("아동이 오른손으로 블록을 집는다. 아동이 블록을 내려놓는다. 아동은 블록을 좋아한다.");
  await page.getByRole("button", { name: "등록", exact: true }).nth(1).click();
  await expect(page.getByRole("cell", { name: "#1" })).toBeVisible();
});

test("Reference: Event 2건 추가, 순서 이동, 편집 이력", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/reference");
  const add = async (actor: string, action: string, object: string, start: string, end: string) => {
    const form = page.locator("#new-event");
    await form.locator('input[name="actor"]').fill(actor);
    await form.locator('input[name="action"]').fill(action);
    await form.locator('input[name="object"]').fill(object);
    await form.locator('input[name="start"]').fill(start);
    await form.locator('input[name="end"]').fill(end);
    await form.getByRole("button", { name: "추가" }).click();
    await expect(page.getByRole("cell", { name: action, exact: true })).toBeVisible();
  };
  await add("아동 A", "집는다", "빨간 블록", "1000", "2500");
  await add("아동 A", "내려놓는다", "빨간 블록", "0:03.5", "4800");
  await expect(page.getByRole("cell", { name: "E02" })).toBeVisible();
  // E02(내려놓는다) 를 위로 → 첫 행이 내려놓는다
  await page.getByRole("button", { name: "↑" }).first().click();
  await expect(page.locator("table tbody tr").first()).toContainText("내려놓는다", { timeout: 10_000 });
  // 편집 이력 확인
  await page.locator("table tbody tr").first().locator("summary", { hasText: "편집" }).click();
  await page.locator("table tbody tr").first().getByRole("link", { name: "변경 이력" }).click();
  await expect(page.getByText("변경 이력 (변경 전 스냅샷)")).toBeVisible();
  await expect(page.getByRole("cell", { name: "update" }).first()).toBeVisible();
});

test("Coding: 세션 열기 → 자동 분할 → 코딩 → 확정 → 분석 지표", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/coding?type=teacher");
  await page.getByRole("button", { name: "코딩 시작" }).first().click();
  await expect(page).toHaveURL(/\/admin\/coding\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "문장 단위 자동 분할" }).click();
  await expect(page.getByText(/Claim 코딩 \([1-9]/)).toBeVisible();
  const claimCards = page.locator("div.rounded-lg.border");
  const n = await claimCards.count();
  for (let i = 0; i < n; i++) {
    const card = claimCards.nth(i);
    await card.locator('select[name="support_type"]').selectOption("observed");
    const ref = card.locator('select[name="matched_reference_event_id"]');
    const options = await ref.locator("option").count();
    if (options > 1) await ref.selectOption({ index: 1 });
    await card.locator('select[name="actor_accuracy"]').selectOption("correct");
    await card.locator('select[name="granularity_score"]').selectOption("2");
    await card.getByRole("button", { name: /코딩 (저장|갱신)/ }).click();
    await expect(card.getByText("완료")).toBeVisible();
  }
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "코딩 확정 (finalize)" }).click();
  await expect(page.getByText("확정된 세션입니다")).toBeVisible();

  await page.goto("/admin/analysis");
  await expect(page.getByRole("heading", { name: "분석" })).toBeVisible();
  const teacherRow = page.getByRole("row", { name: /교사 ALL/ });
  await expect(teacherRow).toBeVisible();
  await expect(teacherRow).toContainText("%");
  await expect(page.getByRole("cell", { name: "E01" }).first()).toBeVisible();
});

test("Export: 코딩 데이터 파일 (response_claims / claim_codings / reference_events)", async ({ page, request }) => {
  await adminLogin(page);
  const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  for (const name of ["response_claims", "claim_codings", "reference_events", "ai_outputs"]) {
    const res = await request.get(`/api/exports/${name}?format=csv`, { headers: { cookie: cookies } });
    expect(res.ok(), name).toBeTruthy();
    const lines = (await res.text()).split("\r\n").filter(Boolean);
    expect(lines.length, name).toBeGreaterThan(1);
  }
});

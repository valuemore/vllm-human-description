import { expect, test } from "@playwright/test";
import { completeOnboarding, loadConfig, login, submitObservation, video, watchFirstTime } from "./helpers";

const cfg = loadConfig();
const P1 = cfg.participants[0];
const P2 = cfg.participants[1];

test.describe.configure({ mode: "serial" });

test("온보딩: 단계 건너뛰기 차단, 동의·기본정보·안내 후 연습 도달", async ({ page }) => {
  await login(page, P1.code, P1.pin);
  await expect(page).toHaveURL(/\/welcome/);
  // 앞 단계 건너뛰기 → welcome 으로 되돌아감
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto("/study");
  await expect(page).toHaveURL(/\/welcome/);
  await completeOnboarding(page);
  await expect(page.getByText("연습 관찰입니다")).toBeVisible();
});

test("첫 시청 제한: seek·배속·pause 차단, 기록창 비활성 → 완료 후 활성·재시청 허용", async ({ page }) => {
  await login(page, P1.code, P1.pin);
  await expect(page).toHaveURL(/\/practice/);
  const v = video(page);
  const editor = page.locator("#observation-text");
  await expect(editor).toBeDisabled();
  const start = page.getByRole("button", { name: "시청 시작" });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();
  await page.waitForTimeout(1500);
  // 타이머가 시작되었는지
  await expect(page.getByLabel(/남은 시간/)).toContainText(/00:2\d|00:1\d/);
  // seek 시도 → 되돌림
  await v.evaluate((el: HTMLVideoElement) => {
    el.currentTime = 5.5;
  });
  await page.waitForTimeout(700);
  const t = await v.evaluate((el: HTMLVideoElement) => el.currentTime);
  expect(t).toBeLessThan(4.5);
  // 배속 → 1.0 강제
  await v.evaluate((el: HTMLVideoElement) => {
    el.playbackRate = 2;
  });
  await page.waitForTimeout(300);
  expect(await v.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(1);
  // pause → 자동 재개
  await v.evaluate((el: HTMLVideoElement) => el.pause());
  await page.waitForTimeout(800);
  expect(await v.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
  await expect(editor).toBeDisabled();
  // 첫 시청 완료 → 편집기 활성, 컨트롤 표시
  await expect(editor).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "일시정지" }).or(page.getByRole("button", { name: "재생", exact: true }))).toBeVisible();
  // 자유 시청: seek 허용, 배속은 여전히 1
  await page.getByRole("button", { name: "처음부터 다시 보기" }).click();
  await page.waitForTimeout(800);
  expect(await v.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(3);
  await v.evaluate((el: HTMLVideoElement) => {
    el.playbackRate = 1.5;
  });
  await page.waitForTimeout(300);
  expect(await v.evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(1);
});

test("자동저장·새로고침 복구·제출 → 허브", async ({ page }) => {
  await login(page, P1.code, P1.pin);
  await expect(page).toHaveURL(/\/practice/);
  const editor = page.locator("#observation-text");
  await expect(editor).toBeEnabled({ timeout: 30_000 });
  await editor.fill("연습 기록 입니다");
  await expect(page.getByRole("status").filter({ hasText: "저장됨" })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.locator("#observation-text")).toHaveValue("연습 기록 입니다", { timeout: 30_000 });
  // 새로고침 후에도 타이머는 초기값(30초)보다 작아야 한다
  const label = await page.getByLabel(/남은 시간/).getAttribute("aria-label");
  expect(label).not.toContain("00:30");
  await submitObservation(page, "연습 기록 입니다. 제출합니다.");
  await expect(page).toHaveURL(/\/study$/, { timeout: 15_000 });
  await expect(page.getByText("연습이 끝났습니다")).toBeVisible();
});

test("본 관찰 전체 흐름: 순서대로 N편 제출 → 완료 화면, 이후 재열람 불가", async ({ page }) => {
  await login(page, P1.code, P1.pin);
  for (let i = 1; i <= cfg.videos; i++) {
    await expect(page).toHaveURL(/\/study$/);
    await expect(page.getByText(`관찰 ${i - 1} / ${cfg.videos} 완료`)).toBeVisible();
    await page.getByRole("link", { name: /번째 관찰 시작하기/ }).click();
    await expect(page).toHaveURL(/\/study\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: `관찰 ${i} / ${cfg.videos}` })).toBeVisible();
    await watchFirstTime(page);
    await submitObservation(page, `관찰 ${i} 기록: 아동이 블록을 집는다.`);
    await page.waitForURL((u) => u.pathname === "/study" || u.pathname === "/complete", { timeout: 15_000 });
  }
  await expect(page).toHaveURL(/\/complete/);
  await expect(page.getByRole("heading", { name: "모든 관찰을 완료했습니다." })).toBeVisible();
  await page.goto("/study");
  await expect(page).toHaveURL(/\/complete/);
});

test("timeout: 제한시간 경과 시 자동 제출 안내", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, P2.code, P2.pin);
  await completeOnboarding(page);
  await watchFirstTime(page);
  await page.locator("#observation-text").fill("시간이 끝날 때까지 기다린다");
  await expect(page.getByRole("heading", { name: "제한시간이 끝났습니다." })).toBeVisible({ timeout: (cfg.maxSeconds + 15) * 1000 });
  await page.getByRole("button", { name: "다음으로" }).click();
  await expect(page).toHaveURL(/\/study$/);
});

test("격리: 다른 참여자의 관찰 URL 은 404, 완료 후 세션은 차단", async ({ page, request }) => {
  await login(page, P2.code, P2.pin);
  await expect(page).toHaveURL(/\/study$/);
  const href = await page.getByRole("link", { name: /번째 관찰 시작하기/ }).getAttribute("href");
  const otherObsId = href!.split("/").pop()!;
  // P1 (완료됨) 으로 로그인 시도 → 세션은 발급되나 complete 로만 이동
  const ctx = await request.post("/api/participant/login", { data: { participant_code: P1.code, pin: P1.pin } });
  expect(ctx.ok()).toBeTruthy();
  const cookie = ctx.headers()["set-cookie"] ?? "";
  const res = await request.get(`/api/observations/${otherObsId}`, { headers: { cookie: cookie.split(";")[0] } });
  expect(res.status()).toBe(404);
  const sign = await request.post("/api/videos/sign", { headers: { cookie: cookie.split(";")[0] }, data: { observation_id: otherObsId } });
  expect(sign.status()).toBe(404);
});

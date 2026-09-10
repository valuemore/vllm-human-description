import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export type E2EConfig = {
  studyId: string;
  code: string;
  videos: number;
  participantTarget: number;
  maxSeconds: number;
  participants: { code: string; pin: string; group: string }[];
};

export function loadConfig(): E2EConfig {
  return JSON.parse(readFileSync(join(process.cwd(), "scratch", "e2e.json"), "utf8")) as E2EConfig;
}

export async function login(page: Page, code: string, pin: string) {
  await page.goto(`/enter?code=${code}`);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "접속하기" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/enter"));
}

/** 온보딩 4단계를 통과해 /practice 에 도달 */
export async function completeOnboarding(page: Page) {
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/consent/);
  // base-ui Checkbox 는 네이티브 input 을 숨기므로 label 을 클릭한다
  for (const id of ["consent-participate", "consent-no_copy", "consent-research_only"]) await page.locator(`label[for="${id}"]`).click();
  await page.getByRole("button", { name: "동의하고 계속하기" }).click();
  await expect(page).toHaveURL(/\/profile/);
  await page.locator("#years").fill("5");
  await page.locator("#months").fill("2");
  await page.locator("#age").selectOption("age_3");
  await page.locator("#freq").selectOption("weekly");
  await page.locator("#video").selectOption("few_times");
  await page.locator("#ai").selectOption("tried");
  await page.getByRole("button", { name: "저장하고 계속하기" }).click();
  await expect(page).toHaveURL(/\/guide/);
  await page.getByRole("button", { name: "연습 시작하기" }).click();
  await expect(page).toHaveURL(/\/practice/);
}

export const video = (page: Page) => page.locator("video");

/** 시청 시작 → 첫 시청 완료(편집기 활성)까지 */
export async function watchFirstTime(page: Page, durationSeconds = 6) {
  const start = page.getByRole("button", { name: /시청 시작|다시 시청하기/ });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();
  await expect(page.locator("#observation-text")).toBeEnabled({ timeout: (durationSeconds + 15) * 1000 });
}

export async function submitObservation(page: Page, text: string) {
  await page.locator("#observation-text").fill(text);
  await page.getByRole("button", { name: "기록 제출하기" }).click();
  await page.getByRole("button", { name: "제출", exact: true }).click();
}

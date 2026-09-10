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
  // E2E 연구로 전환
  await page.locator("#study-switch").selectOption({ label: `${cfg.code} · active` });
  await page.getByRole("button", { name: "전환" }).click();
  await expect(page.getByText(`E2E 테스트 연구 (${cfg.code})`)).toBeVisible();
}

test("미인증 관리자 경로는 로그인으로", async ({ page }) => {
  await page.goto("/admin/participants");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("대시보드·순서그룹·영상·설정·감사로그·Export 화면 렌더", async ({ page }) => {
  await adminLogin(page);
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  await expect(page.getByText("균형 검증")).toBeVisible();
  for (const [path, heading] of [
    ["/admin/order-groups", "순서그룹"],
    ["/admin/videos", "영상 관리"],
    ["/admin/observations", "관찰기록"],
    ["/admin/settings", "연구 설정"],
    ["/admin/audit", "감사 로그"],
    ["/admin/exports", "데이터 Export"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("참여자 생성 → PIN 1회 표시 → 상세 화면", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/participants");
  const code = `T${String(90 + Math.floor(Math.random() * 9)).padStart(2, "0")}`;
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button", { name: "생성" }).click();
  await expect(page.getByText(`생성됨: ${code}`)).toBeVisible();
  await expect(page.locator("span.font-mono.text-lg")).toHaveText(/^\d{6}$/);
  await page.getByRole("row", { name: new RegExp(code) }).getByRole("link", { name: "상세" }).click();
  await expect(page.getByRole("heading", { name: `참여자 ${code}` })).toBeVisible();
});

test("제출된 관찰 무효화 → attempt 2 생성, 원문 보존, 감사로그 기록", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/observations?participant=E01&validity=valid");
  const first = page.getByRole("row", { name: /E01/ }).first();
  await first.getByRole("link", { name: "상세" }).click();
  await expect(page.getByText("교사 원문 (불변)")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.locator('input[name="reason"]').fill("E2E 무효화 테스트");
  await page.getByRole("button", { name: "무효화" }).click();
  await expect(page.getByText("무효화됨")).toBeVisible();
  await page.goto("/admin/observations?participant=E01&validity=invalid");
  await expect(page.getByRole("row", { name: /E01/ })).toHaveCount(1);
  await page.goto("/admin/observations?participant=E01&status=pending");
  await expect(page.getByRole("row", { name: /E01/ })).toHaveCount(1);
  await expect(page.getByRole("row", { name: /E01/ })).toContainText("2");
  await page.goto("/admin/audit?action=observation_retry_created");
  await expect(page.getByRole("cell", { name: "observation_retry_created" }).first()).toBeVisible();
});

test("CSV export: research_master 헤더·행, codebook", async ({ page, request }) => {
  await adminLogin(page);
  const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await request.get("/api/exports/research_master?format=csv", { headers: { cookie: cookies } });
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  const lines = text.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  expect(lines[0].split(",").slice(0, 5)).toEqual(["participant_code", "video_code", "order_group", "presentation_order", "observation_id"]);
  expect(lines.length).toBeGreaterThan(3);
  const cb = await request.get("/api/exports/codebook?format=csv", { headers: { cookie: cookies } });
  expect((await cb.text())).toContain("research_master.csv");
  const xlsx = await request.get("/api/exports/all?format=xlsx", { headers: { cookie: cookies } });
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
});

/**
 * 연구 무결성·보안 위반 패턴을 정적으로 검출한다.
 * - 참여자 화면(app/(participant), components/participant, lib/copy)에 연구 지표·내부 코드 노출
 * - 서버 비밀키의 NEXT_PUBLIC_ 노출
 * - Supabase public object URL / public bucket 패턴
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "hooks", "scripts", "supabase"];
const EXT = new Set([".ts", ".tsx", ".sql", ".mjs", ".js"]);
const PARTICIPANT_SCOPE = /(app[\\/]\(participant\)|components[\\/]participant|lib[\\/]copy)/;

type Rule = { name: string; pattern: RegExp; scope?: RegExp; allow?: RegExp };

const rules: Rule[] = [
  {
    name: "participant-ui-exposes-metrics",
    pattern: /\b(Precision|Recall|Hallucination|F1[- ]?score|Reference Annotation|reference_event)\b/,
    scope: PARTICIPANT_SCOPE,
  },
  {
    name: "participant-ui-exposes-video-code",
    pattern: /["'`]V0\d["'`]/,
    scope: PARTICIPANT_SCOPE,
  },
  { name: "service-role-key-public", pattern: /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/ },
  { name: "session-secret-public", pattern: /NEXT_PUBLIC_[A-Z_]*SESSION_SECRET/ },
  { name: "supabase-public-object-url", pattern: /\/storage\/v1\/object\/public\//, allow: /check-forbidden/ },
  { name: "public-bucket", pattern: /\bpublic\s*(=|:)\s*true\b/i, scope: /supabase[\\/]/ },
];

const violations: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full);
      continue;
    }
    const ext = full.slice(full.lastIndexOf("."));
    if (!EXT.has(ext)) continue;
    const rel = relative(ROOT, full);
    if (rel.includes("check-forbidden")) continue;
    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    for (const rule of rules) {
      if (rule.scope && !rule.scope.test(rel)) continue;
      if (rule.allow && rule.allow.test(rel)) continue;
      lines.forEach((line, i) => {
        if (rule.pattern.test(line)) {
          violations.push(`${rel}:${i + 1} [${rule.name}] ${line.trim().slice(0, 120)}`);
        }
      });
    }
  }
}

for (const d of SCAN_DIRS) {
  try {
    if (statSync(join(ROOT, d)).isDirectory()) walk(join(ROOT, d));
  } catch {
    /* 디렉터리 없음 */
  }
}

if (violations.length) {
  console.error(`금지 패턴 ${violations.length}건 검출:\n` + violations.join("\n"));
  process.exit(1);
}
console.log("check:forbidden PASS");

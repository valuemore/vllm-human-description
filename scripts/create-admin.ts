/**
 * 관리자 계정 생성/allowlist 등록.
 *   npm run create:admin -- --email who@example.com --password 'Strong-Pass-1234' [--name 이름]
 */
import { ensureAdmin, fail, option, serviceClient } from "./_shared";

const email = option("email") ?? process.env.SEED_ADMIN_EMAIL;
const password = option("password") ?? process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) fail("--email 과 --password 가 필요합니다");
if (password.length < 12) fail("비밀번호는 12자 이상이어야 합니다");

ensureAdmin(serviceClient(), email, password, option("name", "연구 관리자"))
  .then((id) => console.log(`관리자 준비 완료: ${email} (${id})`))
  .catch((e) => fail("실패", e));

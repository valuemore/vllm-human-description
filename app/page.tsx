import { redirect } from "next/navigation";

/** 루트는 참여자 접속 화면으로 보낸다. 관리자는 /admin 으로 직접 접근한다. */
export default function Home() {
  redirect("/enter");
}

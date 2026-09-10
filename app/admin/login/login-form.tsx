"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLoginAction, type LoginState } from "./actions";

export function AdminLoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(adminLoginAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </Button>
    </form>
  );
}

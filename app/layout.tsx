import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "영유아 관찰기록 연구",
  description: "영유아 활동영상 관찰기록 연구 참여 시스템",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}

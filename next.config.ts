import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 네이티브 바인딩·대용량 서버 라이브러리는 번들링 대상에서 제외한다.
  serverExternalPackages: ["@node-rs/argon2", "exceljs", "pg"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), picture-in-picture=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

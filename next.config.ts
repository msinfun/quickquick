import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // 只有在 build 成 production 時才加上子路徑，避免影響本地 npm run dev
  basePath: process.env.NODE_ENV === 'production' ? '/quickquick' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

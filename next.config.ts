import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 允许大体积 base64 图片的请求与响应（场景图、九宫格等）
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;

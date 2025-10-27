import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is enabled by default in Next.js 16 for both dev and production
  // Provides 5-10x faster builds and hot module replacement
  
  // Cache Components feature can be enabled when ready to add "use cache" directives
  // cacheComponents: true,
};

export default nextConfig;

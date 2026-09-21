import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow LAN / localhost HMR in `next dev` (avoids blocked cross-origin warnings).
  allowedDevOrigins: ["localhost:3000", "172.16.21.42", "127.0.0.1:3000"],
  turbopack: {
    // Keep Turbopack rooted in this app (avoids parent-folder lockfile noise).
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["yogathedev.com"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["yogathedev.com", "test.yogathedev.com", "192.168.56.1"],
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  turbopack: {
    root: process.cwd(),
  },
};

export default withMDX(nextConfig);

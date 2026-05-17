import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["yogathedev.com"],
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  turbopack: {
    root: process.cwd(),
  },
};

export default withMDX(nextConfig);

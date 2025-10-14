import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false, // DISABLED to fix screen sharing double-mount issue
};

export default nextConfig;

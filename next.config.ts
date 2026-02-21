import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  async redirects() {
    return [
      { source: "/groups", destination: "/discover", permanent: true },
    ];
  },
};

export default withPWA(nextConfig);

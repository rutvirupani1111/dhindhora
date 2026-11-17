import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/r/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
      { source: "/f/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};
export default nextConfig;

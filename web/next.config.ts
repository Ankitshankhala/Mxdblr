import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker multi-stage build — produces a self-contained server.js
  // in .next/standalone that includes only the files needed to run the app.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "mxdindia.com",
      },
      // Local API server — dev only (Cloudinary used in production)
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;

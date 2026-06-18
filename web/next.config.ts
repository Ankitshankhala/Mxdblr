import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker multi-stage build — produces a self-contained server.js
  // in .next/standalone that includes only the files needed to run the app.
  output: "standalone",
  // Next 15.2+/16 blocks dev-server requests (HMR, RSC, internal assets) from
  // origins other than localhost. Without this, testing the dev server from a
  // phone on the LAN (http://<machine-ip>:3000) fails to hydrate — the page
  // renders via SSR but React never attaches, so inputs/buttons are dead.
  // Dev-only setting; has no effect on production builds.
  allowedDevOrigins: ["192.168.1.6"],
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

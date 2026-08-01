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
      // Production API host — serves locally-stored /uploads/* when Cloudinary
      // creds are absent. Whitelisted so next/image won't 404 on the fallback
      // path. Update the hostname if the production API domain changes; it must
      // match the host in NEXT_PUBLIC_API_URL.
      {
        protocol: "https",
        hostname: "api.mxdblr.com",
        pathname: "/uploads/**",
      },
      // Local API server — dev only (Cloudinary used in production)
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
      // LAN IP of the dev machine serving the API — required so next/image will
      // optimize upload images when the site is opened from a phone over Wi-Fi
      // (localhost is unreachable from the phone). Dev only. Update if the
      // machine's LAN IP changes; must match NEXT_PUBLIC_API_URL in .env.local.
      {
        protocol: "http",
        hostname: "192.168.1.6",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;

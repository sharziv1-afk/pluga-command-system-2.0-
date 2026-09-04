import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  distDir: ".next-build",
  // Dev-only: allow the dev server to serve client JS/HMR to a phone on the
  // local network so the page hydrates and onClick/onSubmit work. The LAN IP
  // changes across sessions (DHCP) — when phone testing breaks again with
  // buttons doing nothing, check `ipconfig` and add the current IP here.
  // No effect on production builds.
  allowedDevOrigins: ["192.168.1.231", "192.168.1.233", "192.168.1.224"],
};

export default nextConfig;

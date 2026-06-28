import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  distDir: ".next-build",
  // Dev-only: allow the dev server to serve client JS/HMR to a phone on the
  // local network (http://192.168.1.231:3000 / http://192.168.1.233:3000) so the page hydrates and
  // onClick/onSubmit work. No effect on production builds.
  allowedDevOrigins: ["192.168.1.231", "192.168.1.233"],
};

export default nextConfig;

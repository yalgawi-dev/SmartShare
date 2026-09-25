import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
} as any);

const nextConfig = {
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Firebase Auth reverse proxy:
  // Required since mid-2024 browsers block cross-origin iframes used by Firebase redirect flow.
  // By proxying /__/auth/* through our own domain, Firebase's signInWithRedirect works correctly.
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: `https://myspace-da215.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
} as any;

export default withPWA(nextConfig);

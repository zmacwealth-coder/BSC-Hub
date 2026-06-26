import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the workspace root to this project directory,
    // silencing the "multiple lockfiles" warning from Next.js 16.
    root: process.cwd(),
  },
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;

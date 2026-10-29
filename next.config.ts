import type { NextConfig } from "next";

/**
 * Static export: the app is plain HTML/JS served by Firebase Hosting (free Spark plan).
 * All data access happens in the browser against Firestore, protected by firestore.rules.
 * (Security headers are configured in firebase.json because Next cannot add headers to a static export.)
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;

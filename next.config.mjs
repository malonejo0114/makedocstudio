/** @type {import('next').NextConfig} */
const distDir =
  process.env.NEXT_DIST_DIR?.trim() ||
  (process.env.NODE_ENV === "production" ? ".next-build" : ".next-dev");

const nextConfig = {
  experimental: {},
  distDir,
};

export default nextConfig;

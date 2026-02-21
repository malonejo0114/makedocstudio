/** @type {import('next').NextConfig} */
const customDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig = {
  experimental: {},
  ...(customDistDir ? { distDir: customDistDir } : {}),
};

export default nextConfig;

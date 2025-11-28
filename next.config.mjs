/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb'
    }
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;


import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1:3005', 'http://127.0.0.1:3005']
};

export default nextConfig;

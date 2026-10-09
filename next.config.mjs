/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['169.254.249.201', 'localhost:3000', '127.0.0.1:3000'],
}

export default nextConfig

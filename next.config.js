/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disabling ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disabling TypeScript checking during builds
    ignoreBuildErrors: true,
  },
  // Changed from 'export' to 'standalone' to support dynamic API routes
  output: 'standalone',
  // Configure images
  images: {
    unoptimized: true,
  },
  // Ensure the app works even when JavaScript is disabled initially
  reactStrictMode: true,
  // Add powered by header
  poweredByHeader: false,
}

module.exports = nextConfig 
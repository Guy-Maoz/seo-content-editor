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
  // Add output configuration
  output: 'standalone',
  // Configure images if needed
  images: {
    unoptimized: true,
  },
  // Ensure the app works even when JavaScript is disabled initially
  reactStrictMode: true,
  // Add powered by header
  poweredByHeader: false,
}

module.exports = nextConfig 
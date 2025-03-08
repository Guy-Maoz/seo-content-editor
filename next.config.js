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
  // Change from 'standalone' to 'export' for static site generation
  output: 'export',
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
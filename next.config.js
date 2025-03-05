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
}

module.exports = nextConfig 
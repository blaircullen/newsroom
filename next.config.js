/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  serverExternalPackages: ['@the-convocation/twitter-scraper'],
  experimental: {
    missingSuspenseWithCSRBailout: false,
    instrumentationHook: true,
  },
};

module.exports = nextConfig;

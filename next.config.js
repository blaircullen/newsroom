/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    missingSuspenseWithCSRBailout: false,
    instrumentationHook: true,
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thumbsnap.com',
      },
      {
        protocol: 'https',
        hostname: '*.thumbsnap.com',
      },
      {
        protocol: 'https',
        hostname: 'qu.ax',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*', // Proxy to Deftorch backend
      },
    ];
  },
}

module.exports = nextConfig

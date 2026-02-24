/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/pos/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      {
        source: '/api/cms/:path*',
        destination: 'http://localhost:1337/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

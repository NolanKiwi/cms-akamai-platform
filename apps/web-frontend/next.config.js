/** @type {import('next').NextConfig} */
const API_URL = process.env.CMS_API_URL || 'http://localhost:17000/api/v1';

const nextConfig = {
  reactStrictMode: true,
  env: {
    CMS_API_URL: API_URL,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

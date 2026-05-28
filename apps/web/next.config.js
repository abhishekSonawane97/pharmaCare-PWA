/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    // When deployed via docker-compose, proxy /api/* to the api container.
    // This lets the frontend use a relative API URL so it works behind a
    // single tunnel (ngrok / cloudflared) without exposing the api port.
    const target = process.env.API_PROXY_TARGET || 'http://api:4000';
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;

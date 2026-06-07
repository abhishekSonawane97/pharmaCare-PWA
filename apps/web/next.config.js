const withSerwist = require('@serwist/next').default({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Disable SW during `next dev` to avoid caching surprises while iterating.
  // Re-enable for production builds.
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    // When deployed via docker-compose, proxy /api/* to the api container.
    // Lets the frontend use a relative API URL so it works behind a single
    // tunnel (ngrok / cloudflared / Caddy) without exposing the api port.
    const target = process.env.API_PROXY_TARGET || 'http://api:4000';
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
    ];
  },
};

module.exports = withSerwist(nextConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverActions: { bodySizeLimit: "1mb" }
  },
  async headers() {
    return [
      {
        source: "/application-progress/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate"
          },
          {
            key: "CDN-Cache-Control",
            value: "private, no-store"
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "private, no-store"
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer"
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;

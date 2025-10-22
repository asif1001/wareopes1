import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Only ignore build errors in development
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    // Ignore ESLint during builds to prevent deployment blocking on warnings
    ignoreDuringBuilds: true,
  },
  // Optimize for Firebase App Hosting
  serverExternalPackages: ['firebase-admin'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  // Remove localhost-specific headers for production
  async headers() {
    // Gate dev forwarded host behind an env var to avoid chunk mismatches
    const devForwardedHost = process.env.DEV_X_FORWARDED_HOST;
    if (process.env.NODE_ENV === 'development' && devForwardedHost) {
      return [
        {
          source: '/dashboard/:path*',
          headers: [
            {
              key: 'x-forwarded-host',
              value: devForwardedHost,
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

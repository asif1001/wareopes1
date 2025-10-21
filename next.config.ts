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
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/dashboard/:path*',
          headers: [
            {
              key: 'x-forwarded-host',
              value: 'localhost:3001',
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

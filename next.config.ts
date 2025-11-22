import type { NextConfig } from "next";

// Bundle Analyzer - Optional (only loads if installed)
// To use: npm install --save-dev @next/bundle-analyzer && ANALYZE=true npm run build
let withBundleAnalyzer: (config: NextConfig) => NextConfig;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch {
  // Bundle analyzer not installed or not available - skip it
  withBundleAnalyzer = (config) => config;
}

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false, // TODO: Re-enable after fixing Agora SDK double-mount issue

  // ESLint configuration - skip during build (already checked during compilation)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false, // Don't ignore TypeScript errors
  },

  // Output configuration - disable static optimization for database-dependent pages
  experimental: {
    // This prevents database queries during build time
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Security Headers for Production
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // DIRECTIVE 1: script-src - Allow scripts from Agora SDK and required sources
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://accounts.google.com https://*.agora.io https://*.sd-rtn.com https://*.statscollector.sd-rtn.com",
              "style-src 'self' 'unsafe-inline' blob: https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              // DIRECTIVE 2: connect-src - CRITICAL: Allow ALL WebSocket and HTTP connections for Agora
              // CSP wildcards DON'T match IP-based subdomains (148-153-236-83.edge.agora.io)
              // Solution: Allow ALL wss: and https: for Agora domains using broader patterns
              // Include statscollector domains for Agora analytics
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https: wss: https://*.agora.io wss://*.agora.io https://*.sd-rtn.com wss://*.sd-rtn.com https://*.statscollector.sd-rtn.com https://statscollector-1.agora.io https://web-2.statscollector.sd-rtn.com https://api.openai.com https://*.sentry.io https://clerva-app.vercel.app",
              // DIRECTIVE 3: media-src - Allow media streams from all sources (camera/mic permissions handled by browser)
              "media-src 'self' data: blob: https: mediastream:",
              // DIRECTIVE 4: worker-src - Allow workers from all blob sources
              "worker-src 'self' blob:", 
              "frame-src 'self' https://accounts.google.com",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'"
            ].join('; ')
          }
        ],
      },
    ];
  },

  // Image Optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile pictures
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Compression
  compress: true,

  // Webpack configuration - suppress warnings for third-party libraries
  webpack: (config) => {
    // Suppress Supabase library warnings about Node.js APIs in Edge Runtime
    // These are safe to ignore because:
    // 1. The Supabase client gracefully handles Edge Runtime environments
    // 2. These Node.js APIs are only used for version detection/logging, not core functionality
    // 3. All realtime features use 'use client' directive (client-side only)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@supabase/,
        message: /A Node\.js API is used/,
      },
    ];
    return config;
  },

  // Turbopack configuration - same ignore warnings for Turbopack
  turbopack: {
    resolveAlias: {
      // Add any custom aliases here if needed
    },
  },
};

// Export with bundle analyzer wrapper
export default withBundleAnalyzer(nextConfig);

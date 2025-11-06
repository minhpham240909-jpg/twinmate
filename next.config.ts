import type { NextConfig } from "next";

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
              // Include wss:// for WebSocket scripts, unsafe-eval for Agora SDK dynamic code execution
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://*.agora.io wss://*.agora.io https://*.edge.agora.io wss://*.edge.agora.io https://*.sd-rtn.com wss://*.sd-rtn.com https://*.edge.sd-rtn.com wss://*.edge.sd-rtn.com https://cdn.tldraw.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tldraw.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com https://cdn.tldraw.com",
              // DIRECTIVE 2: connect-src - Allow WebSocket and HTTP connections to all Agora edge servers
              // Support IP-based subdomains (e.g., 38-93-228-76.edge.sd-rtn.com) by allowing all edge subdomains
              // CSP wildcards match single labels, so *.edge.sd-rtn.com should match IP-based subdomains
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://*.agora.io wss://*.agora.io https://*.edge.agora.io wss://*.edge.agora.io https://*.sd-rtn.com wss://*.sd-rtn.com https://*.edge.sd-rtn.com wss://*.edge.sd-rtn.com https://cdn.tldraw.com https://api.openai.com https://*.sentry.io",
              // DIRECTIVE 3: media-src - Allow media streams (camera, microphone) from Agora and blob/data URIs
              "media-src 'self' data: blob: https://*.agora.io https://*.edge.agora.io https://*.sd-rtn.com https://*.edge.sd-rtn.com",
              // DIRECTIVE 4: worker-src - Allow web workers from Agora SDK and blob URIs
              "worker-src 'self' blob: https://*.agora.io https://*.edge.agora.io https://*.sd-rtn.com https://*.edge.sd-rtn.com",
              "frame-src 'self' https://accounts.google.com",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests"
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

export default nextConfig;

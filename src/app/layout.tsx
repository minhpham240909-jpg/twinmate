import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth/context";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { IntlProvider } from "@/contexts/IntlContext";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import { NetworkProvider } from "@/contexts/NetworkContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import BannedUserOverlay from "@/components/BannedUserOverlay";
import AnalyticsProvider from "@/components/providers/AnalyticsProvider";
import DeferredProviders from "@/components/providers/DeferredProviders";
import QueryProvider from "@/providers/QueryProvider";
import { ConfirmModalProvider } from "@/hooks/useConfirmModal";
import PWAUpdateNotification from "@/components/PWAUpdateNotification";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Viewport configuration (Next.js 15+ requires separate export)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#020617' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export const metadata: Metadata = {
  title: "Clerva - Your Learning Operating System",
  description: "Clerva takes full responsibility for your learning direction, progress, and outcomes. Never feel lost - always know exactly what to do next.",
  keywords: ["learning", "education", "study", "roadmap", "progress", "guidance"],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clerva',
    // Note: For full iOS splash screen support, add apple-touch-startup-image
    // link tags in a custom head component with device-specific images.
    // Required sizes: iPhone 14 Pro Max (1290x2796), iPhone 14/13 (1170x2532),
    // iPhone SE (750x1334), iPad Pro 12.9" (2048x2732), iPad 10.2" (1620x2160)
    startupImage: [
      { url: '/icon-512.png' }, // Fallback for devices without specific splash
    ],
  },
  icons: {
    // Primary favicon for all browsers
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // Shortcut icon (legacy support)
    shortcut: '/favicon.png',
    // Apple touch icons for iOS
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    // Additional icons for various contexts
    other: [
      { rel: 'mask-icon', url: '/favicon.png' },
    ],
  },
  // Open Graph image for social sharing
  openGraph: {
    title: 'Clerva - Your Learning Operating System',
    description: 'Clerva takes full responsibility for your learning direction, progress, and outcomes. Never feel lost - always know exactly what to do next.',
    siteName: 'Clerva',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Clerva Logo',
      },
    ],
    type: 'website',
  },
  // Twitter card
  twitter: {
    card: 'summary',
    title: 'Clerva - Your Learning Operating System',
    description: 'Clerva takes full responsibility for your learning direction, progress, and outcomes. Never feel lost - always know exactly what to do next.',
    images: ['/icon-512.png'],
  },
};

// Force dynamic rendering for all pages (prevents database queries during build)
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <WebVitalsReporter />
        <GlobalErrorHandler />
        <ErrorBoundary>
          <Suspense fallback={null}>
            <QueryProvider>
              <PostHogProvider>
                <ThemeProvider>
                  <NetworkProvider>
                    <AuthProvider>
                      <SettingsProvider>
                        <IntlProvider>
                        {/* DeferredProviders loads PWA and Presence tracking
                            AFTER first paint to improve initial load time */}
                        <DeferredProviders>
                          <ConfirmModalProvider>
                          <BannedUserOverlay>
                            <OfflineIndicator />
                            <PWAUpdateNotification />
                            {children}
                            <Toaster
                              position="top-right"
                              toastOptions={{
                                duration: 4000,
                                style: {
                                  background: '#363636',
                                  color: '#fff',
                                },
                                success: {
                                  duration: 3000,
                                  iconTheme: {
                                    primary: '#10b981',
                                    secondary: '#fff',
                                  },
                                },
                                error: {
                                  duration: 4000,
                                  iconTheme: {
                                    primary: '#ef4444',
                                    secondary: '#fff',
                                  },
                                },
                              }}
                            />
                          </BannedUserOverlay>
                          </ConfirmModalProvider>
                        </DeferredProviders>
                        </IntlProvider>
                      </SettingsProvider>
                    </AuthProvider>
                  </NetworkProvider>
                </ThemeProvider>
              </PostHogProvider>
            </QueryProvider>
          </Suspense>
        </ErrorBoundary>
        <AnalyticsProvider />
      </body>
    </html>
  );
}

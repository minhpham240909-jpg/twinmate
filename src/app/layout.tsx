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
  title: "Clerva - Social Learning & Study Partners",
  description: "Find study partners, collaborate in real-time, and supercharge your learning",
  keywords: ["study partners", "learning", "collaboration", "education"],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clerva',
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
    title: 'Clerva - Social Learning & Study Partners',
    description: 'Find study partners, collaborate in real-time, and supercharge your learning',
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
    title: 'Clerva - Social Learning & Study Partners',
    description: 'Find study partners, collaborate in real-time, and supercharge your learning',
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
                        {/* DeferredProviders loads Presence, BackgroundSession, IncomingCall
                            AFTER first paint to improve initial load time */}
                        <DeferredProviders>
                          <BannedUserOverlay>
                            <OfflineIndicator />
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

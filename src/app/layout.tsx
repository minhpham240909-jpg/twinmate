import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import { Toaster } from "react-hot-toast";
import FloatingSessionButton from "@/components/FloatingSessionButton";
import { BackgroundSessionProvider } from "@/lib/session/BackgroundSessionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import IncomingCallModal from "@/components/IncomingCallModal";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { IntlProvider } from "@/contexts/IntlContext";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import { PresenceProvider } from "@/components/presence/PresenceProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Clerva - Social Learning & Study Partners",
  description: "Find study partners, collaborate in real-time, and supercharge your learning",
  keywords: ["study partners", "learning", "collaboration", "education"],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clerva',
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
          <ThemeProvider>
            <AuthProvider>
              <SettingsProvider>
                <IntlProvider>
                  <PresenceProvider>
                    <BackgroundSessionProvider>
                      {children}
                      <FloatingSessionButton />
                      <IncomingCallModal />
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
                    </BackgroundSessionProvider>
                  </PresenceProvider>
                </IntlProvider>
              </SettingsProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

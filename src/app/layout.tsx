import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import { Toaster } from "react-hot-toast";
import FloatingSessionButton from "@/components/FloatingSessionButton";
import { BackgroundSessionProvider } from "@/lib/session/BackgroundSessionContext";
import SessionSyncWrapper from "@/components/SessionSyncWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Clerva - Social Learning & Study Partners",
  description: "Find study partners, collaborate in real-time, and supercharge your learning with AI-powered insights",
  keywords: ["study partners", "learning", "collaboration", "education", "AI tutor"],
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
        <ErrorBoundary>
          <SessionSyncWrapper />
          <AuthProvider>
            <BackgroundSessionProvider>
              {children}
              <FloatingSessionButton />
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
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

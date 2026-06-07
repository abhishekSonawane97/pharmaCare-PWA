import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/Toast';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateBanner } from '@/components/UpdateBanner';

export const metadata: Metadata = {
  title: 'PharmaCare — Pharmacy OS',
  description: 'Pharmacy management with one-tap WhatsApp + SMS refill reminders.',
  manifest: '/manifest.webmanifest',
  applicationName: 'PharmaCare',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PharmaCare',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#1c6878',
  width: 'device-width',
  initialScale: 1,
  // viewportFit: 'cover' lets the app extend under the iPhone notch when in standalone mode
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=window.matchMedia('(max-width: 767px)');function u(){document.body.classList.toggle('mobile',m.matches);}u();m.addEventListener('change',u);})();`,
          }}
        />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <OfflineBanner />
        <UpdateBanner />
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'PharmaCare — Pharmacy OS',
  description: 'Pharmacy management with WhatsApp refill reminders.',
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
      </body>
    </html>
  );
}

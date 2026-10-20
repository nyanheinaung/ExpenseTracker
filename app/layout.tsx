import type { Metadata, Viewport } from 'next';
import AppProvider from '@/components/AppProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Expenses',
  description: 'Shared monthly expense tracker',
  appleWebApp: { capable: true, title: 'Expenses', statusBarStyle: 'default' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0E6B5C'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

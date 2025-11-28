import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Animated ? Video Converter',
  description: 'Turn animated GIF/WebP/APNG into real MP4/WebM videos entirely in your browser.',
  icons: { icon: '/favicon.ico' }
};

export const viewport: Viewport = {
  themeColor: '#0b0f17',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}


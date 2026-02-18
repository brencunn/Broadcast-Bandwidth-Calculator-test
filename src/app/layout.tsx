import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { EventProvider } from '@/context/EventContext';

export const metadata: Metadata = {
  title: 'Broadcast Bandwidth Calculator',
  description: 'Model network circuits and calculate bandwidth utilisation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <EventProvider>
          {children}
          <footer className="mt-8 border-t py-6 text-center text-sm text-muted-foreground">
            Have a feature request or found a bug?{' '}
            <a
              href="mailto:brendan.cunningham@bbc.co.uk?subject=Broadcast%20Bandwidth%20Calculator%20Feedback"
              className="underline underline-offset-4"
            >
              Email here
            </a>
          </footer>
          <Toaster />
        </EventProvider>
      </body>
    </html>
  );
}

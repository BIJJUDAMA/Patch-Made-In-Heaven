import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'HAcksMyMachine — Verified Agent Memory Platform',
  description: 'Shared, execution-verified knowledge cards for AI agents exposed via MCP.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#090d16',
        color: '#e2e8f0',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  );
}

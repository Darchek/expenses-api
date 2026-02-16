import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notifications Map - Push Tracker",
  description: "Track and visualize push notifications on a map",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}

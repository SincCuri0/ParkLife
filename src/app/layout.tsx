import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParkLife",
  description: "Live community challenge map",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}

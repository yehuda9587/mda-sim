import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// הגדרות Viewport - חשוב מאוד למנוע קפיצות וזום בזמן הקלדה במובייל
export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Metadata של האפליקציה (PWA ו-SEO)
export const metadata: Metadata = {
  title: "סימולטור מע\"ר מד\"א",
  description: "מערכת תרגול סכימת טיפול בטראומה ורפואה דחופה למתנדבי מד\"א",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "סימולטור מד\"א",
  },
  icons: {
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Mada_logo.svg",
    apple: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Mada_logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* תגיות מטא נוספות לשיפור חוויית ה-PWA באייפון */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}


import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "סימולטור מע\"ר מד\"א",
  description: "אימון סכמת ABCDE",
};

// הגדרות Viewport למניעת זום ויישור למסך מלא
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}

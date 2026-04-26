import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'סימולטור מע"ר מד"א',
  description: "אימון סכמת ABCDE ופרוטוקולי הצלת חיים",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",        // safe-area-inset על iPhone notch
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      {/*
        suppressHydrationWarning — מונע אזהרות על תוסף דפדפן שמוסיף attributes.
        style inline על body — מבטיח שהגובה נעול גם לפני שה-CSS נטען.
      */}
      <body className="antialiased" style={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}

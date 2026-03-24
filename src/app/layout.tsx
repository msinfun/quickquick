import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "iOS 26 Expense Tracker",
  description: "A mobile-first personal expense tracker with iOS 26 glassmorphism UI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Expense App",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased text-text-primary overflow-hidden bg-bg-base`}
      >


        <main className="w-full h-[100dvh] flex flex-col relative text-text-primary">
          <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}

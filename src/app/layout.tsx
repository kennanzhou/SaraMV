import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sara Music Video Studio",
  description: "创作旖旎夜色的音乐盒 MTV",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Studio ambient background effect */}
        <div className="studio-ambient" />
        
        {/* Sidebar Navigation */}
        <Sidebar />
        
        {/* Main Content：留白与呼吸感 */}
        <main className="ml-16 min-h-screen relative z-10 pl-2">
          {children}
        </main>
      </body>
    </html>
  );
}

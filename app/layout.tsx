import type { Metadata, Viewport } from "next";
import { Mitr, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const body = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "700"], variable: "--font-body" });
const head = Mitr({ subsets: ["thai", "latin"], weight: ["400", "500"], variable: "--font-head" });

export const metadata: Metadata = {
  metadataBase: new URL("https://brain.bcsmethai.com"),
  title: "สมอง BC — คลังความรู้ BC Ai Account",
  description: "คู่มือใช้งาน วิธีแก้ปัญหา และข้อมูลระบบ BC Ai Account ภาษาเข้าใจง่าย พร้อม MCP ให้ AI ผู้ช่วยตอบลูกค้า",
  alternates: { canonical: "/" },
  openGraph: {
    title: "สมอง BC",
    description: "คู่มือใช้งานและแก้ปัญหา BC Ai Account + MCP สำหรับ AI ผู้ช่วยตอบลูกค้า",
    url: "https://brain.bcsmethai.com",
    siteName: "สมอง BC",
    locale: "th_TH",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b0820" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${body.variable} ${head.variable}`}>
      <body>{children}</body>
    </html>
  );
}

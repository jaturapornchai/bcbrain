import type { Metadata, Viewport } from "next";
import { Mitr, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const body = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "700"], variable: "--font-body" });
const head = Mitr({ subsets: ["thai", "latin"], weight: ["400", "500"], variable: "--font-head" });

export const metadata: Metadata = {
  metadataBase: new URL("https://brain.bcsmethai.com"),
  title: "สมอง BC — คลังความรู้ BC Ai Account (ผู้ใช้ทั่วไป & นักพัฒนา)",
  description:
    "คลังความรู้ BC Ai Account ครบทั้งโซนผู้ใช้ทั่วไป (คู่มือใช้งาน แก้ปัญหา ข้อมูลการขาย) และโซนนักพัฒนา (Schema ตาราง, SQL SELECT, trans_flag, ผังบัญชี, API/MCP) พร้อม MCP server รองรับตัวกรอง audience",
  alternates: { canonical: "/" },
  openGraph: {
    title: "สมอง BC — คลังความรู้ BC Ai Account",
    description:
      "คลังความรู้ BC Ai Account สำหรับผู้ใช้ทั่วไป (Call Center/Sales) และนักพัฒนา (Schema/SQL/API/Architecture) พร้อม MCP แบบกรอง audience",
    url: "https://brain.bcsmethai.com",
    siteName: "สมอง BC",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "สมอง BC — คลังความรู้ BC Ai Account",
    description:
      "คลังความรู้ BC Ai Account สำหรับผู้ใช้ทั่วไป (Call Center/Sales) และนักพัฒนา (Schema/SQL/API/Architecture) พร้อม MCP แบบกรอง audience",
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

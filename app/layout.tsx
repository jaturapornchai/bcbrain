import type { Metadata, Viewport } from "next";
import { Mitr, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const body = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "700"], variable: "--font-body" });
const head = Mitr({ subsets: ["thai", "latin"], weight: ["400", "500"], variable: "--font-head" });

export const metadata: Metadata = {
  metadataBase: new URL("https://brain.bcsmethai.com"),
  title: "สมอง BC — คลังความรู้ BC Ai Account",
  description: "Second brain ของระบบ BC Ai Account: ความรู้ที่สกัดจากซอร์สโค้ดจริง เป็นโน้ต Obsidian พร้อม MCP ให้ AI ถาม-ตอบ",
  alternates: { canonical: "/" },
  openGraph: {
    title: "สมอง BC",
    description: "คลังความรู้ BC Ai Account แบบเส้นประสาทสมอง 3 มิติ + MCP สำหรับ AI",
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

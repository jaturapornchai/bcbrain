import Link from "next/link";
import { ViewTransition } from "react";
import { updatedAt } from "@/lib/vault";

export default function Shell({ q = "", children }: { q?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <Link className="brand" href="/">
          สมอง BC
        </Link>
        <form className="search" action="/n" role="search">
          <input type="search" name="q" defaultValue={q} placeholder="ค้นคู่มือ เช่น ออกใบกำกับภาษี, วางบิล, ตรวจนับสต็อก" aria-label="ค้นหา" />
        </form>
        <span className="updated">อัปเดตล่าสุด {updatedAt}</span>
      </header>
      {/* route changes are transitions, so this fades/slides each page in (see globals.css .page-in/.page-out) */}
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <div className="page">{children}</div>
      </ViewTransition>
    </>
  );
}

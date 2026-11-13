import Link from "next/link";
import { ViewTransition } from "react";
import type { AudienceFilter } from "@/lib/groups";
import { updatedAt } from "@/lib/vault";

export default function Shell({
  q = "",
  mode = "all",
  children,
}: {
  q?: string;
  mode?: AudienceFilter;
  children: React.ReactNode;
}) {
  const placeholder =
    mode === "dev"
      ? "ค้นหาฝั่ง Dev เช่น ic_trans, gl_journal, trans_flag, MCP"
      : "ค้นคู่มือ เช่น ออกใบกำกับภาษี, วางบิล, ตรวจนับสต็อก";

  return (
    <>
      <header className="top">
        <Link className="brand" href="/">
          สมอง BC
        </Link>
        <form className="search" action="/n" role="search">
          {mode !== "all" && <input type="hidden" name="mode" value={mode} />}
          <input key={`${mode}:${q}`} type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label="ค้นหา" />
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

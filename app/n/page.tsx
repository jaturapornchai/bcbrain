import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { groupOf } from "@/lib/groups";
import { search, vault, type Note } from "@/lib/vault";

export const metadata: Metadata = {
  title: "คลังความรู้ทั้งหมด · สมอง BC",
  description: "สารบัญโน้ตความรู้ระบบ BC Ai Account แยกตามกลุ่ม: หลังบ้าน Go, ตรรกะบัญชี, Process Engine, หน้าจอ, มาตรฐาน",
  alternates: { canonical: "/n" },
};

const href = (slug: string) => `/n/${encodeURIComponent(slug)}`;

export default async function Notes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;

  if (q.trim()) {
    const hits = search(q, 30);
    return (
      <Shell q={q}>
        <h1>ผลค้นหา “{q}”</h1>
        {!hits.length && <p className="muted">ไม่พบโน้ตที่ตรง ลองคำอื่น หรือชื่อโค้ด/ตาราง</p>}
        <ul className="results">
          {hits.map((h, i) => (
            <li key={h.slug} style={{ "--i": i } as CSSProperties}>
              <Link href={href(h.slug)}>{h.title}</Link> <span className="chip">{groupOf(h.folder).label}</span>
              <p>{h.snippet}</p>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const byFolder = new Map<string, Note[]>();
  for (const n of vault().values()) byFolder.set(n.folder, [...(byFolder.get(n.folder) ?? []), n]);
  return (
    <Shell>
      <h1>คลังความรู้ทั้งหมด</h1>
      <div className="groups">
        {[...byFolder].map(([folder, notes], i) => (
          <section key={folder} style={{ "--i": i } as CSSProperties}>
            <h2 style={{ color: groupOf(folder).color }}>
              {groupOf(folder).label} <span className="chip">{notes.length}</span>
            </h2>
            <ul>
              {notes
                .sort((a, b) => a.title.localeCompare(b.title, "th"))
                .map((n) => (
                  <li key={n.slug}>
                    <Link href={href(n.slug)}>{n.title}</Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}

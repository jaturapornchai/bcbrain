import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import {
  MODE_OPTIONS,
  ZONE_LABEL,
  groupOf,
  normalizeAudienceFilter,
  type AudienceFilter,
} from "@/lib/groups";
import { groupedVaultNotes, search } from "@/lib/vault";

export const metadata: Metadata = {
  title: "คลังความรู้ทั้งหมด · สมอง BC",
  description:
    "สารบัญความรู้ BC Ai Account แยกตามโซนผู้ใช้ทั่วไป (คู่มือ, แก้ปัญหา, รายงาน, การขาย) และโซนนักพัฒนา (Schema, SQL, API, รหัสเอกสาร, สถาปัตยกรรม)",
  alternates: { canonical: "/n" },
};

function notesHref({ q, mode }: { q?: string; mode?: AudienceFilter }) {
  const p = new URLSearchParams();
  if (mode && mode !== "all") p.set("mode", mode);
  if (q?.trim()) p.set("q", q.trim());
  const qs = p.toString();
  return qs ? `/n?${qs}` : "/n";
}

function noteHref(slug: string, mode: AudienceFilter) {
  const base = `/n/${encodeURIComponent(slug)}`;
  return mode !== "all" ? `${base}?mode=${mode}` : base;
}

export default async function Notes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const { q = "", mode: rawMode } = await searchParams;
  const mode = normalizeAudienceFilter(rawMode);

  const toolbar = (
    <div className="n-toolbar">
      <div className="mode-switch" role="group" aria-label="เลือกโซนความรู้">
        {MODE_OPTIONS.map(([m, label]) => (
          <Link
            key={m}
            href={notesHref({ q, mode: m })}
            className="mode-pill"
            aria-current={mode === m ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </div>
      {q.trim() && (
        <Link className="btn-clear" href={notesHref({ mode })}>
          ล้างคำค้น
        </Link>
      )}
    </div>
  );

  if (q.trim()) {
    const hits = search(q, 30, mode);
    return (
      <Shell q={q} mode={mode}>
        {toolbar}
        <h1>ผลค้นหา “{q}”</h1>
        {!hits.length && (
          <p className="muted">
            ไม่พบโน้ตที่ตรงในโหมดนี้ ลองสลับเป็นโหมด “ทั้งหมด” หรือพิมพ์คำอื่น (ชื่อเมนูบนจอ หรือชื่อตาราง SQL)
          </p>
        )}
        <ul className="results">
          {hits.map((h, i) => (
            <li key={h.slug} style={{ "--i": i } as CSSProperties}>
              <div className="result-head">
                <Link href={noteHref(h.slug, mode)}>{h.title}</Link>
                <span className="chip">{groupOf(h.folder).label}</span>
                <span className={`chip zone zone-${h.audience}`}>{ZONE_LABEL[h.audience]}</span>
              </div>
              <p>{h.snippet}</p>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const orderedFolders = groupedVaultNotes(mode);

  const heading =
    mode === "user"
      ? "คลังความรู้ผู้ใช้ทั่วไป"
      : mode === "dev"
        ? "คลังความรู้นักพัฒนา (Dev)"
        : "คลังความรู้ทั้งหมด";

  return (
    <Shell mode={mode}>
      {toolbar}
      <h1>{heading}</h1>
      {!orderedFolders.length && <p className="muted">ยังไม่มีโน้ตในหมวดนี้</p>}
      <div className="groups">
        {orderedFolders.map(([folder, notes], i) => (
          <section key={folder} style={{ "--i": i } as CSSProperties}>
            <h2 style={{ color: groupOf(folder).color }}>
              <span>{groupOf(folder).label}</span>
              <span className="chip">{notes.length}</span>
            </h2>
            <ul>
              {notes.map((n) => (
                <li key={n.slug}>
                  <Link href={noteHref(n.slug, mode)}>{n.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: heading,
            url: "https://brain.bcsmethai.com/n",
            inLanguage: "th",
          }).replace(/</g, "\\u003c"),
        }}
      />
    </Shell>
  );
}

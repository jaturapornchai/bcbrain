import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { groupOf } from "@/lib/groups";
import { getNote, renderNote, snippet } from "@/lib/vault";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = getNote(decodeURIComponent((await params).slug));
  if (!n) return { title: "ไม่พบโน้ต · สมอง BC" };
  return {
    title: `${n.title} · สมอง BC`,
    description: snippet(n.body, []).replace(/[*_`>|[\]]/g, "").slice(0, 160),
    alternates: { canonical: `/n/${encodeURIComponent(n.slug)}` },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const n = getNote(decodeURIComponent(slug));
  if (!n) notFound();
  const link = (s: string) => (
    <li key={s}>
      <Link href={`/n/${encodeURIComponent(s)}`}>{getNote(s)?.title ?? s}</Link>
    </li>
  );

  return (
    <Shell>
      <p className="crumb">
        <Link href="/n">คลังความรู้</Link> / <span style={{ color: groupOf(n.folder).color }}>{groupOf(n.folder).label}</span>
      </p>
      <div className="note-grid">
        <article>
          <div className="chips">
            {n.tags.map((t) => (
              <span className="chip" key={t}>
                #{t}
              </span>
            ))}
          </div>
          <div className="md" dangerouslySetInnerHTML={{ __html: renderNote(n) }} />
        </article>
        <aside className="side">
          {n.backlinks.length > 0 && (
            <section className="card">
              <h3>โน้ตที่ลิงก์มาหา ({n.backlinks.length})</h3>
              <ul>{n.backlinks.map(link)}</ul>
            </section>
          )}
          {n.links.length > 0 && (
            <section className="card">
              <h3>ลิงก์ออก ({n.links.length})</h3>
              <ul>{n.links.map(link)}</ul>
            </section>
          )}
          {n.sources.length > 0 && (
            <section className="card">
              <h3>ที่มาในโค้ด</h3>
              <ul>
                {n.sources.map((s) => (
                  <li key={s}>
                    <code>{s}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "สมอง BC", item: "https://brain.bcsmethai.com/" },
              { "@type": "ListItem", position: 2, name: "คลังความรู้", item: "https://brain.bcsmethai.com/n" },
              { "@type": "ListItem", position: 3, name: n.title },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
    </Shell>
  );
}

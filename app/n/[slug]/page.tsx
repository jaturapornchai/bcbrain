import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { RELATION_LABEL, ZONE_LABEL, groupOf, matchesAudience, normalizeAudienceFilter, type AudienceFilter, type RelationType } from "@/lib/groups";
import { getNote, noteDescription, renderNote, traverseGraph } from "@/lib/vault";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const n = getNote(decodeURIComponent((await params).slug));
  if (!n) return { title: "ไม่พบโน้ต · สมอง BC" };
  const desc = noteDescription(n);
  const url = `https://brain.bcsmethai.com/n/${encodeURIComponent(n.slug)}`;
  return {
    title: `${n.title} · สมอง BC`,
    description: desc,
    alternates: { canonical: `/n/${encodeURIComponent(n.slug)}` },
    openGraph: {
      title: `${n.title} · สมอง BC`,
      description: desc,
      url,
      type: "article",
      locale: "th_TH",
      siteName: "สมอง BC",
    },
  };
}

export default async function NotePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { mode: rawMode } = await searchParams;
  const n = getNote(decodeURIComponent(slug));
  if (!n) notFound();

  const requestedMode = normalizeAudienceFilter(rawMode);
  const backMode: AudienceFilter = n.audience === "both" ? requestedMode : n.audience;
  const crumbHref = `/n?mode=${backMode}`;
  const linkSuffix = backMode !== "all" ? `?mode=${backMode}` : "";

  const link = (s: string, rel: RelationType) => (
    <li key={`${s}-${rel}`} className="edge-item">
      <Link href={`/n/${encodeURIComponent(s)}${linkSuffix}`}>{getNote(s)?.title ?? s}</Link>
      <span className="chip rel">{RELATION_LABEL[rel]}</span>
    </li>
  );

  const visibleIn = n.inEdges.filter((e) => {
    const nb = getNote(e.slug);
    return nb && matchesAudience(nb.audience, backMode);
  });
  const visibleOut = n.outEdges.filter((e) => {
    const nb = getNote(e.slug);
    return nb && matchesAudience(nb.audience, backMode);
  });
  const hop2 = traverseGraph({ slug: n.slug, depth: 2, audience: backMode, limit: 12 })
    .neighbors.filter((s) => s.hop === 2)
    .slice(0, 6);

  return (
    <Shell mode={backMode}>
      <p className="crumb">
        <Link href={crumbHref}>คลังความรู้</Link> /{" "}
        <span style={{ color: groupOf(n.folder).color }}>{groupOf(n.folder).label}</span>
      </p>
      <div className="note-grid">
        <article>
          <div className="chips">
            <span className={`chip zone zone-${n.audience}`}>{ZONE_LABEL[n.audience]}</span>
            {n.tags.map((t) => (
              <span className="chip" key={t}>
                #{t}
              </span>
            ))}
          </div>
          <div className="md" dangerouslySetInnerHTML={{ __html: renderNote(n) }} />
        </article>
        <aside className="side">
          {visibleIn.length > 0 && (
            <section className="card">
              <h3>โน้ตที่ลิงก์มาหา ({visibleIn.length})</h3>
              <ul className="edge-list">{visibleIn.map((e) => link(e.slug, e.rel))}</ul>
            </section>
          )}
          {visibleOut.length > 0 && (
            <section className="card">
              <h3>ลิงก์ออก ({visibleOut.length})</h3>
              <ul className="edge-list">{visibleOut.map((e) => link(e.slug, e.rel))}</ul>
            </section>
          )}
          {hop2.length > 0 && (
            <section className="card">
              <h3>เชื่อมโยงต่ออีกทอด (2-hop)</h3>
              <ul className="edge-list">{hop2.map((s) => link(s.slug, s.rel))}</ul>
            </section>
          )}
          {/* ponytail: sources stay in frontmatter for internal audit only, never shown to customers */}
        </aside>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "สมอง BC", item: "https://brain.bcsmethai.com/" },
                  { "@type": "ListItem", position: 2, name: "คลังความรู้", item: "https://brain.bcsmethai.com/n" },
                  { "@type": "ListItem", position: 3, name: n.title },
                ],
              },
              {
                "@type": "TechArticle",
                headline: n.title,
                description: noteDescription(n),
                inLanguage: "th",
                url: `https://brain.bcsmethai.com/n/${encodeURIComponent(n.slug)}`,
                keywords: n.tags.join(", "),
              },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
    </Shell>
  );
}

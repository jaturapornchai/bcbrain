import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { marked } from "marked";

export type Note = {
  slug: string;
  folder: string;
  title: string;
  tags: string[];
  aliases: string[];
  sources: string[];
  body: string;
  links: string[];
  backlinks: string[];
  haystack: { title: string; meta: string; body: string };
};

const VAULT_DIR = path.join(process.cwd(), "vault");
const WIKILINK = /\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".")) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".md") ? [p] : [];
  });
}

const linkTarget = (raw: string) => path.basename(raw.trim()).toLowerCase();

function load(): Map<string, Note> {
  const notes = new Map<string, Note>();
  for (const file of walk(VAULT_DIR)) {
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
    const meta = (fm ? parseYaml(fm[1]) : {}) ?? {};
    const body = fm ? text.slice(fm[0].length) : text;
    const slug = path.basename(file, ".md").toLowerCase();
    if (notes.has(slug)) {
      console.warn(`[vault] duplicate slug ${slug}: ${file} ignored`);
      continue;
    }
    const rel = path.relative(VAULT_DIR, file).split(path.sep);
    const title = String(meta.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? slug);
    const tags = asList(meta.tags);
    const aliases = asList(meta.aliases);
    notes.set(slug, {
      slug,
      folder: rel.length > 1 ? rel[0] : "root",
      title,
      tags,
      aliases,
      sources: asList(meta.sources),
      body,
      links: [...new Set([...body.matchAll(WIKILINK)].map((m) => linkTarget(m[1])))],
      backlinks: [],
      haystack: {
        title: title.toLowerCase(),
        meta: [slug, ...tags, ...aliases].join(" ").toLowerCase(),
        body: body.toLowerCase(),
      },
    });
  }
  for (const n of notes.values()) {
    n.links = n.links.filter((l) => notes.has(l) && l !== n.slug);
    for (const l of n.links) notes.get(l)!.backlinks.push(n.slug);
  }
  return notes;
}

// ponytail: whole vault in memory (~470 notes); production reloads on redeploy, dev reloads every call
let cache: Map<string, Note> | null = null;
export function vault(): Map<string, Note> {
  if (!cache || process.env.NODE_ENV !== "production") cache = load();
  return cache;
}

// accepts slug, [[slug|label]], slug.md or folder/slug.md: what AIs tend to paste
const toSlug = (raw: string) => linkTarget(raw.replace(/^\s*\[\[|\]\]\s*$/g, "").split(/[|#]/)[0]).replace(/\.md$/, "");
export const getNote = (slug: string) => vault().get(toSlug(slug));

export function graph() {
  const notes = [...vault().values()];
  const index = new Map(notes.map((n, i) => [n.slug, i]));
  const seen = new Set<string>(); // A→B and B→A are one synapse
  return {
    nodes: notes.map((n) => ({
      slug: n.slug,
      title: n.title,
      folder: n.folder,
      degree: n.links.length + n.backlinks.length,
    })),
    links: notes.flatMap((n, i) =>
      n.links.flatMap((l) => {
        const j = index.get(l)!;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        return seen.has(key) ? [] : (seen.add(key), [[i, j] as [number, number]]);
      }),
    ),
  };
}

// ---------- search (Thai has no spaces: Intl.Segmenter splits words natively) ----------
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
const STOP = new Set(
  "คือ อะไร ยังไง อย่างไร ไหม มั้ย หรือ และ ที่ ของ การ ความ ใน ให้ ได้ มี เป็น จะ ว่า กับ แล้ว บ้าง ช่วย หน่อย ครับ ค่ะ คะ นะ เรา ผม the a an of to is are how what in on and or for does do with".split(" "),
);

export function terms(q: string): string[] {
  const words: string[] = [];
  let prevThai = false;
  for (const s of segmenter.segment(q.toLowerCase())) {
    if (!s.isWordLike) {
      prevThai = false;
      continue;
    }
    const thai = /^[฀-๿]+$/.test(s.segment);
    // ICU's dictionary misses loanwords (สต็อก → สต็|อก): glue ≤2-char Thai fragments back onto the previous word
    if (thai && prevThai && s.segment.length <= 2) words[words.length - 1] += s.segment;
    else words.push(s.segment, ...(s.segment.includes("_") ? s.segment.split(/[_.]/) : [])); // guessed identifiers (bc_mcp_tokens) still meet their parts

    prevThai = thai;
  }
  return [...new Set(words.filter((w) => w.length > 1 && !STOP.has(w)))];
}

// identifiers (with "_") count only as whole names: ic_trans_detail must not hit inside ic_trans_detail_lot
const WORD = /\w/;
const count = (hay: string, t: string) => {
  const whole = t.includes("_");
  let n = 0;
  for (let i = hay.indexOf(t); i !== -1 && n < 8; i = hay.indexOf(t, i + t.length))
    if (!whole || !(WORD.test(hay[i - 1] ?? "") || WORD.test(hay[i + t.length] ?? ""))) n++;
  return n;
};

export function snippet(body: string, ts: string[]): string {
  const lines = body.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const hit = lines.find((l) => ts.some((t) => l.toLowerCase().includes(t))) ?? lines[0] ?? "";
  return hit.replace(/\s+/g, " ").trim().slice(0, 280);
}

// ponytail: keyword scoring over ~470 notes; swap for embeddings if recall gets poor at 1000+ notes
export function search(q: string, limit = 8) {
  const ts = terms(q);
  if (!ts.length) return [];
  const phrase = q.trim().toLowerCase();
  const chunks = phrase.split(/\s+/).filter((c) => c.length > 1);
  const notes = [...vault().values()];
  const raw = notes.map(({ haystack: h }) => ts.map((t) => (count(h.title, t) ? 10 : 0) + (count(h.meta, t) ? 6 : 0) + count(h.body, t)));
  // IDF: a word found in 400 notes (เอกสาร) must not outvote one found in 3 (พุทธศักราช)
  const idf = ts.map((_, j) => Math.log(1 + notes.length / (1 + raw.filter((r) => r[j]).length)));
  const bonus = idf.reduce((a, b) => a + b, 0) / idf.length;
  return notes
    .map((n, i) => {
      let score = 0;
      let matched = 0;
      raw[i].forEach((s, j) => {
        if (s) matched++;
        score += s * idf[j];
      });
      if (matched === ts.length && ts.length > 1) score *= 1.5;
      if (phrase.length > 3 && n.haystack.body.includes(phrase)) score += 8 * bonus;
      // a typed chunk equal to an alias names the note directly; segmentation (เริ่มที่นี่ → เริ่ม|นี่) would lose that
      score += 12 * bonus * chunks.filter((c) => n.aliases.some((a) => a.toLowerCase() === c)).length;
      return { note: n, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ note, score }) => ({
      slug: note.slug,
      title: note.title,
      folder: note.folder,
      tags: note.tags,
      score: Math.round(score),
      snippet: snippet(note.body, ts),
    }));
}

// long notes for ask_brain: the intro plus the "## " sections that mention the query most, within budget, and say what was left out
export function excerpt(body: string, ts: string[], budget: number): string {
  if (body.length <= budget) return body;
  const parts = body.split(/\n(?=## )/);
  const hits = parts.map((p) => ts.reduce((a, t) => a + count(p.toLowerCase(), t), 0));
  const keep = new Set([0]);
  let used = parts[0].length;
  for (const i of parts.map((_, i) => i).slice(1).sort((a, b) => hits[b] - hits[a])) {
    if (used + parts[i].length <= budget) keep.add(i), (used += parts[i].length);
  }
  const omitted = parts.filter((_, i) => !keep.has(i)).map((p) => p.split("\n")[0].replace(/^#+\s*/, ""));
  const out = parts.filter((_, i) => keep.has(i)).join("\n");
  const cut = out.length > budget ? out.slice(0, budget) + " …" : out;
  return `${cut}\n\n[excerpt — ${omitted.length ? `omitted sections: ${omitted.join(" | ")}. ` : ""}read_note for the full note]`;
}

// ---------- render ----------
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

marked.use({
  gfm: true,
  // raw HTML in notes is shown, never executed; HTML comments (e.g. secret-scan pragmas) are dropped
  renderer: { html: ({ text }) => (/^\s*<!--[\s\S]*-->\s*$/.test(text) ? "" : escapeHtml(text)) },
  walkTokens(t) {
    if (t.type === "link" && /^\s*(javascript|data|vbscript):/i.test(t.href)) t.href = "#";
  },
});

export function renderNote(n: Note): string {
  const notes = vault();
  const body = n.body.replace(WIKILINK, (_m, target: string, _h, label?: string) => {
    const slug = linkTarget(target);
    const text = (label ?? notes.get(slug)?.title ?? target).replace(/[[\]]/g, "");
    return `[${text}](${notes.has(slug) ? `/n/${encodeURIComponent(slug)}` : "#missing"})`;
  });
  return marked.parse(body, { async: false });
}

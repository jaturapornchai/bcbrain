import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { marked } from "marked";
import {
  GROUP_ORDER,
  groupOf,
  inferRelation,
  isRelationType,
  matchesAudience,
  type Audience,
  type AudienceFilter,
  type RelationType,
} from "./groups";

export type Edge = {
  slug: string;
  rel: RelationType;
  inferred?: boolean;
};

export type Note = {
  slug: string;
  folder: string;
  audience: Audience;
  title: string;
  tags: string[];
  aliases: string[];
  sources: string[];
  body: string;
  links: string[];
  backlinks: string[];
  outEdges: Edge[];
  inEdges: Edge[];
  haystack: { title: string; meta: string; body: string };
};

export type SearchHit = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  tags: string[];
  score: number;
  snippet: string;
};

export type TraverseStep = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  hop: number;
  via: string;
  rel: RelationType;
  direction: "out" | "in";
};

export type TraverseOptions = {
  slug: string;
  toSlug?: string;
  depth?: number;
  direction?: "both" | "out" | "in";
  relation?: RelationType;
  folder?: string;
  audience?: AudienceFilter;
  limit?: number;
};

export type TraverseResult = {
  start: Note | null;
  target?: Note | null;
  mode: "neighborhood" | "path";
  neighbors: TraverseStep[];
  path?: TraverseStep[];
};

const VAULT_DIR = path.join(process.cwd(), "vault");
const WIKILINK = /\[\[(?:([a-z_]+)::)?([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
const VALID_AUDIENCES = new Set<Audience>(["user", "dev", "both"]);
const TABLE_IDENT = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const BODY_IDENT = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/ภ\.ง\.ด\.\s*(\d+)/g, "ภงด$1")
    .replace(/ภ\.พ\.\s*(\d+)/g, "ภพ$1")
    .replace(/สต๊อก/g, "สต็อก")
    .replace(/ล๊อก/g, "ล็อก")
    .replace(/แพ็คเกจ/g, "แพ็กเกจ")
    .replace(/พ\.ศ\./g, "พศ")
    .replace(/ค\.ศ\./g, "คศ")
    .replace(/เครม/g, "เคลม");

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];

function walk(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name.startsWith(".")) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && e.name.endsWith(".md") ? [p] : [];
  });
}

const linkTarget = (raw: string) => path.basename(raw.trim()).toLowerCase();

function load(): Map<string, Note> {
  const notes = new Map<string, Note>();
  const rawLinks = new Map<string, { target: string; explicitRel?: RelationType }[]>();
  for (const file of walk(VAULT_DIR)) {
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    } catch {
      continue;
    }
    if (!text.trim()) continue;
    const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
    let meta: Record<string, unknown> = {};
    if (fm) {
      try {
        meta = ((parseYaml(fm[1]) as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    }
    const body = fm ? text.slice(fm[0].length) : text;
    const slug = path.basename(file, ".md").toLowerCase();
    if (notes.has(slug)) {
      console.warn(`[vault] duplicate slug ${slug}: ${file} ignored`);
      continue;
    }
    const rel = path.relative(VAULT_DIR, file).split(path.sep);
    const folder = rel.length > 1 ? rel[0] : "root";
    const rawAud = typeof meta.audience === "string" ? meta.audience.trim().toLowerCase() : "";
    const audience: Audience = VALID_AUDIENCES.has(rawAud as Audience)
      ? (rawAud as Audience)
      : groupOf(folder).audience;
    const title = String(meta.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? slug);
    const tags = asList(meta.tags);
    const aliases = asList(meta.aliases);
    const parsedLinks = [...body.matchAll(WIKILINK)].map((m) => ({
      target: linkTarget(m[2]),
      explicitRel: m[1] && isRelationType(m[1]) ? m[1] : undefined,
    }));
    rawLinks.set(slug, parsedLinks);
    notes.set(slug, {
      slug,
      folder,
      audience,
      title,
      tags,
      aliases,
      sources: asList(meta.sources),
      body,
      links: [...new Set(parsedLinks.map((x) => x.target))],
      backlinks: [],
      outEdges: [],
      inEdges: [],
      haystack: {
        title: normalizeText(title),
        meta: normalizeText([slug, folder, ...tags, ...aliases].join(" ")),
        body: normalizeText(body),
      },
    });
  }

  // 1) Resolve explicit [[rel::target]] or infer relation from folder pair
  for (const n of notes.values()) {
    const seen = new Map<string, Edge>();
    for (const item of rawLinks.get(n.slug) ?? []) {
      const target = notes.get(item.target);
      if (!target || target.slug === n.slug) continue;
      const edgeRel = item.explicitRel ?? inferRelation(n.folder, target.folder);
      const prev = seen.get(target.slug);
      if (!prev || (item.explicitRel && prev.rel === inferRelation(n.folder, target.folder))) {
        seen.set(target.slug, { slug: target.slug, rel: edgeRel });
      }
    }
    n.outEdges = [...seen.values()];
    n.links = n.outEdges.map((e) => e.slug);
  }

  // 2) Implicit SQL table synapse inference for dev notes (e.g. queries/api/doctypes mentioning schema table names)
  const tableIndex = new Map<string, string>();
  for (const n of notes.values()) {
    if (n.folder !== "schema") continue;
    const candidates: string[] = [];
    if (n.slug.startsWith("tbl-")) candidates.push(n.slug.slice(4).replace(/-/g, "_"));
    for (const a of n.aliases) {
      const id = a.trim().toLowerCase();
      if (TABLE_IDENT.test(id) && id.length >= 5) candidates.push(id);
    }
    for (const id of candidates) {
      if (id.length < 5 || !TABLE_IDENT.test(id)) continue;
      const exactTblSlug = `tbl-${id.replace(/_/g, "-")}`;
      const existing = tableIndex.get(id);
      if (!existing || n.slug === exactTblSlug) tableIndex.set(id, n.slug);
    }
  }
  for (const n of notes.values()) {
    if (n.audience !== "dev" || n.folder === "schema") continue;
    const existingTargets = new Set(n.links);
    let added = 0;
    for (const m of n.body.matchAll(BODY_IDENT)) {
      const id = m[0].toLowerCase();
      const targetSlug = tableIndex.get(id);
      if (!targetSlug || targetSlug === n.slug || existingTargets.has(targetSlug)) continue;
      existingTargets.add(targetSlug);
      const rel: RelationType = n.folder === "doctypes" ? "writes_table" : "uses_table";
      n.outEdges.push({ slug: targetSlug, rel, inferred: true });
      n.links.push(targetSlug);
      added++;
      if (added >= 10) break;
    }
  }

  // 3) Populate reverse edges / backlinks
  for (const n of notes.values()) {
    for (const e of n.outEdges) {
      const target = notes.get(e.slug);
      if (!target) continue;
      target.backlinks.push(n.slug);
      target.inEdges.push({ slug: n.slug, rel: e.rel, inferred: e.inferred });
    }
  }
  return notes;
}

type NoteTokens = {
  title: Set<string>;
  meta: Set<string>;
  body: Map<string, number>;
};

type Posting = {
  idx: Int32Array;
  raw: Float32Array;
  idf: number;
};

type SearchIndex = {
  notes: Note[];
  slugToIdx: Map<string, number>;
  avgLen: number;
  postings: Map<string, Posting>;
  fallbackPostings: Map<string, Posting>;
  bodies: string[];
  titles: string[];
  metas: string[];
  aliasSets: Set<string>[];
  neighborIdx: Int32Array[];
  isHub: Uint8Array;
  baseBuf: Float64Array;
  matchBuf: Int32Array;
};

export type GraphNode = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  degree: number;
  keywords: string;
  pos: [number, number, number];
};

export type GraphData = {
  nodes: GraphNode[];
  links: [number, number][];
  rels: RelationType[];
};

export type VaultRow = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  tags: string[];
};

type VaultBundle = {
  notes: Map<string, Note>;
  builtAt: number;
  graphs: Map<AudienceFilter, GraphData>;
  rendered: Map<string, string>;
  lines: Map<string, { raw: string; norm: string }[]>;
  folders: Map<AudienceFilter, string[]>;
  rows: Map<AudienceFilter, VaultRow[]>;
  grouped: Map<AudienceFilter, [string, Note[]][]>;
  searches: Map<string, SearchHit[]>;
  noteTokens: Map<string, NoteTokens> | null;
  indexes: Map<AudienceFilter, SearchIndex>;
};

// ponytail: whole vault + derived indexes in memory; prod persists per redeploy, dev/test uses 5s TTL for hot reload without thrashing loops
const DEV_TTL_MS = 5000;
let bundleCache: VaultBundle | null = null;

function getBundle(): VaultBundle {
  const now = Date.now();
  if (!bundleCache || (process.env.NODE_ENV !== "production" && now - bundleCache.builtAt > DEV_TTL_MS)) {
    bundleCache = {
      notes: load(),
      builtAt: now,
      graphs: new Map(),
      rendered: new Map(),
      lines: new Map(),
      folders: new Map(),
      rows: new Map(),
      grouped: new Map(),
      searches: new Map(),
      noteTokens: null,
      indexes: new Map(),
    };
  }
  return bundleCache;
}

export function vault(): Map<string, Note> {
  return getBundle().notes;
}

// accepts slug, [[rel::slug|label]], slug.md or folder/slug.md: what AIs tend to paste
const toSlug = (raw: string) =>
  linkTarget(raw.replace(/^\s*\[\[|\]\]\s*$/g, "").replace(/^[a-z_]+::/, "").split(/[|#]/)[0]).replace(/\.md$/, "");
export const getNote = (slug: string) => vault().get(toSlug(slug));

function computeBrainLayout(
  nodes: { folder: string }[],
  links: [number, number][],
): [number, number, number][] {
  const n = nodes.length;
  if (!n) return [];
  const Rx = 6.2;
  const Ry = 4.8;
  const Rz = 7.4;
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  const folders = [...new Set(nodes.map((x) => x.folder))].filter((f) => f !== "root").sort();
  const centers = new Map<string, [number, number, number]>([["root", [0, 0.4, 0]]]);
  folders.forEach((f, i) => {
    const y = 1 - (2 * (i + 0.5)) / folders.length;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963 + 0.6;
    centers.set(f, [Math.cos(phi) * r * Rx * 0.55, y * Ry * 0.42, Math.sin(phi) * r * Rz * 0.55]);
  });

  const cx = new Float64Array(n);
  const cy = new Float64Array(n);
  const cz = new Float64Array(n);
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const pz = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const vz = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const c = centers.get(nodes[i].folder)!;
    cx[i] = c[0];
    cy[i] = c[1];
    cz[i] = c[2];
    px[i] = c[0] + (rand() - 0.5) * 3;
    py[i] = c[1] + (rand() - 0.5) * 3;
    pz[i] = c[2] + (rand() - 0.5) * 3;
  }

  const invRx2 = 1 / (Rx * Rx);
  const invRy2 = 1 / (Ry * Ry);
  const invRz2 = 1 / (Rz * Rz);
  const steps = 220;
  for (let it = 0; it < steps; it++) {
    const heat = 1 - it / steps;
    for (let i = 0; i < n; i++) {
      const pxi = px[i];
      const pyi = py[i];
      const pzi = pz[i];
      let vxi = vx[i];
      let vyi = vy[i];
      let vzi = vz[i];
      for (let j = i + 1; j < n; j++) {
        const dx = pxi - px[j];
        const dy = pyi - py[j];
        const dz = pzi - pz[j];
        const inv = 0.5 / Math.max(dx * dx + dy * dy + dz * dz, 0.05);
        const fx = dx * inv;
        const fy = dy * inv;
        const fz = dz * inv;
        vxi += fx;
        vyi += fy;
        vzi += fz;
        vx[j] -= fx;
        vy[j] -= fy;
        vz[j] -= fz;
      }
      vx[i] = vxi;
      vy[i] = vyi;
      vz[i] = vzi;
    }
    for (let li = 0; li < links.length; li++) {
      const a = links[li][0];
      const b = links[li][1];
      const dx = px[b] - px[a];
      const dy = py[b] - py[a];
      const dz = pz[b] - pz[a];
      const l = Math.hypot(dx, dy, dz) || 0.01;
      const f = ((l - 2.2) * 0.03) / l;
      const fx = dx * f;
      const fy = dy * f;
      const fz = dz * f;
      vx[a] += fx;
      vy[a] += fy;
      vz[a] += fz;
      vx[b] -= fx;
      vy[b] -= fy;
      vz[b] -= fz;
    }
    for (let i = 0; i < n; i++) {
      const vxi = vx[i] + (cx[i] - px[i]) * 0.012;
      const vyi = vy[i] + (cy[i] - py[i]) * 0.012;
      const vzi = vz[i] + (cz[i] - pz[i]) * 0.012;
      let nxp = px[i] + vxi * heat;
      let nyp = py[i] + vyi * heat;
      let nzp = pz[i] + vzi * heat;
      vx[i] = vxi * 0.55;
      vy[i] = vyi * 0.55;
      vz[i] = vzi * 0.55;
      const k = nxp * nxp * invRx2 + nyp * nyp * invRy2 + nzp * nzp * invRz2;
      if (k > 0.78) {
        const s = Math.sqrt(0.78 / k);
        nxp *= s;
        nyp *= s;
        nzp *= s;
      }
      px[i] = nxp;
      py[i] = nyp;
      pz[i] = nzp;
    }
  }

  const out: [number, number, number][] = new Array(n);
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  for (let i = 0; i < n; i++) out[i] = [r4(px[i]), r4(py[i]), r4(pz[i])];
  return out;
}

export function graph(filter: AudienceFilter = "all"): GraphData {
  const b = getBundle();
  const cached = b.graphs.get(filter);
  if (cached) return cached;

  const notes = [...b.notes.values()].filter((n) => matchesAudience(n.audience, filter));
  const index = new Map(notes.map((n, i) => [n.slug, i]));
  const seen = new Map<string, number>(); // A→B and B→A are one synapse
  const links: [number, number][] = [];
  const rels: RelationType[] = [];
  const degree = new Int32Array(notes.length);
  notes.forEach((n, i) => {
    for (const e of n.outEdges) {
      const j = index.get(e.slug);
      if (j === undefined) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const existingIdx = seen.get(key);
      if (existingIdx !== undefined) {
        if (rels[existingIdx] === "related" && e.rel !== "related") rels[existingIdx] = e.rel;
        continue;
      }
      seen.set(key, links.length);
      links.push([i, j]);
      rels.push(e.rel);
      degree[i]++;
      degree[j]++;
    }
  });
  const positions = computeBrainLayout(notes, links);
  const built: GraphData = {
    nodes: notes.map((n, i) => ({
      slug: n.slug,
      title: n.title,
      folder: n.folder,
      audience: n.audience,
      degree: degree[i],
      keywords: normalizeText([...n.aliases, ...n.tags].join(" ")),
      pos: positions[i],
    })),
    links,
    rels,
  };
  b.graphs.set(filter, built);
  return built;
}

export function listVaultRows(filter: AudienceFilter = "all"): VaultRow[] {
  const b = getBundle();
  const cached = b.rows.get(filter);
  if (cached) return cached;
  const rows = [...b.notes.values()]
    .filter((n) => matchesAudience(n.audience, filter))
    .map((n) => ({
      slug: n.slug,
      title: n.title,
      folder: n.folder,
      audience: n.audience,
      tags: n.tags,
    }));
  b.rows.set(filter, rows);
  return rows;
}

export function vaultFolders(filter: AudienceFilter = "all"): string[] {
  const b = getBundle();
  const cached = b.folders.get(filter);
  if (cached) return cached;
  const folders = [...new Set(listVaultRows(filter).map((n) => n.folder))].sort();
  b.folders.set(filter, folders);
  return folders;
}

export function groupedVaultNotes(filter: AudienceFilter = "all"): [string, Note[]][] {
  const b = getBundle();
  const cached = b.grouped.get(filter);
  if (cached) return cached;
  const byFolder = new Map<string, Note[]>();
  for (const n of b.notes.values()) {
    if (!matchesAudience(n.audience, filter)) continue;
    let list = byFolder.get(n.folder);
    if (!list) {
      list = [];
      byFolder.set(n.folder, list);
    }
    list.push(n);
  }
  for (const list of byFolder.values()) list.sort((a, c) => a.title.localeCompare(c.title, "th"));
  const ordered = [...byFolder.entries()].sort(([a], [c]) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ic = GROUP_ORDER.indexOf(c);
    return (ia === -1 ? 999 : ia) - (ic === -1 ? 999 : ic);
  });
  b.grouped.set(filter, ordered);
  return ordered;
}

// ---------- search (Thai has no spaces: Intl.Segmenter + script-boundary split + inverted index) ----------
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
const STOP = new Set(
  "คือ อะไร ยังไง อย่างไร ไหม มั้ย หรือ และ ที่ ของ การ ความ ใน ให้ ได้ มี เป็น จะ ว่า กับ แล้ว บ้าง ช่วย หน่อย ครับ ค่ะ คะ นะ เรา ผม the a an of to is are how what in on and or for does do with".split(" "),
);
const THAI_WORD = /^[\u0E00-\u0E7F]+$/;
const NEEDS_GLUE_PREV = /(?:[เแโใไ็]|ั)$/;
const NEEDS_GLUE_CUR = /(?:^[่้๊๋ัิีึืุู็์]|^[\u0E01-\u0E2E]\u0E4C?$|^[\u0E01-\u0E2E]{1,2}\u0E4C$)/;
const MIXED_SCRIPT = /(?=.*[\u0E00-\u0E7F])(?=.*[a-z])/;

function tokenizeNormalized(normText: string): string[] {
  const words: string[] = [];
  let prevThai = false;

  const pushChunk = (raw: string) => {
    const thai = THAI_WORD.test(raw);
    if (thai && prevThai && words.length) {
      const prev = words[words.length - 1];
      if (!STOP.has(prev) && !STOP.has(raw) && STOP.has(prev + raw)) {
        words[words.length - 1] = prev + raw;
        prevThai = false;
        return;
      }
      if (!STOP.has(prev) && !STOP.has(raw) && (NEEDS_GLUE_PREV.test(prev) || NEEDS_GLUE_CUR.test(raw))) {
        words[words.length - 1] = prev + raw;
        prevThai = true;
        return;
      }
    }
    words.push(raw);
    if (raw.includes(".")) {
      for (const dotPart of raw.split(".")) {
        if (!dotPart) continue;
        words.push(dotPart);
        if (dotPart.includes("_")) {
          for (const u of dotPart.split("_")) if (u) words.push(u);
        }
      }
    } else if (raw.includes("_")) {
      for (const u of raw.split("_")) if (u) words.push(u);
    }
    prevThai = thai && !STOP.has(raw);
  };

  for (const s of segmenter.segment(normText)) {
    if (!s.isWordLike) {
      prevThai = false;
      continue;
    }
    const seg = s.segment;
    if (MIXED_SCRIPT.test(seg)) {
      const subs = seg.match(/[\u0E00-\u0E7F]+\d*|[a-z0-9_]+/g);
      if (subs) {
        for (const sub of subs) pushChunk(sub);
        continue;
      }
    }
    pushChunk(seg);
  }
  return words.filter((w) => w.length > 1 && !STOP.has(w));
}

const TERMS_CACHE = new Map<string, string[]>();

export function terms(q: string): string[] {
  const cached = TERMS_CACHE.get(q);
  if (cached) return cached.slice();
  const res = [...new Set(tokenizeNormalized(normalizeText(q)))];
  if (TERMS_CACHE.size >= 512) {
    const oldest = TERMS_CACHE.keys().next().value;
    if (oldest !== undefined) TERMS_CACHE.delete(oldest);
  }
  TERMS_CACHE.set(q, res);
  return res.slice();
}

// identifiers (with "_") count only as whole names: ic_trans_detail must not hit inside ic_trans_detail_lot
const WORD = /\w/;
const count = (hay: string, t: string, max = 16) => {
  const whole = t.includes("_");
  let n = 0;
  for (let i = hay.indexOf(t); i !== -1 && n < max; i = hay.indexOf(t, i + t.length))
    if (!whole || !(WORD.test(hay[i - 1] ?? "") || WORD.test(hay[i + t.length] ?? ""))) n++;
  return n;
};

function linesForNote(b: VaultBundle, n: Note): { raw: string; norm: string }[] {
  let cached = b.lines.get(n.slug);
  if (cached) return cached;
  cached = n.body
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((line) => ({ raw: line.replace(/\s+/g, " ").trim().slice(0, 280), norm: normalizeText(line) }));
  b.lines.set(n.slug, cached);
  return cached;
}

function snippetFromLines(lines: { raw: string; norm: string }[], ts: string[]): string {
  const hit = lines.find((l) => ts.some((t) => l.norm.includes(t))) ?? lines[0];
  return hit?.raw ?? "";
}

export function noteDescription(n: Note): string {
  const first = linesForNote(getBundle(), n)[0]?.raw ?? n.title;
  return first.replace(/[*_`>|[\]]/g, "").slice(0, 160);
}

export function snippet(body: string, ts: string[]): string {
  const lines = body.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const hit = lines.find((l) => ts.some((t) => normalizeText(l).includes(t))) ?? lines[0] ?? "";
  return hit.replace(/\s+/g, " ").trim().slice(0, 280);
}

const SYNONYM_GROUPS: string[][] = [
  ["สต็อก", "สินค้าคงเหลือ", "คงเหลือ", "คลัง", "ic_inventory", "ic_trans_detail"],
  ["คลัง", "คลังสินค้า", "wh_code", "ic_warehouse"],
  ["ที่เก็บ", "ชั้นวาง", "ชั้น", "shelf_code", "ic_shelf"],
  ["ลูกหนี้", "ลูกค้า", "ค้างชำระ", "ค้าง", "วางบิล", "บิล", "ar_customer"],
  ["เจ้าหนี้", "ซัพพลาย", "ซัพพลายเออร์", "ผู้จำหน่าย", "จำหน่าย", "ผู้ขาย", "ap_supplier"],
  ["ลดหนี้", "คืนสินค้า", "รับคืน", "ส่งคืน", "คืน", "ใบลดหนี้"],
  ["เช็ค", "เช็ครับ", "เช็คจ่าย", "เด้ง", "ทะเบียนเช็ค", "cb_chq_list"],
  ["มัดจำ", "เงินมัดจำ", "ล่วงหน้า", "ล่วง"],
  ["ภพ30", "vat", "ภาษีมูลค่าเพิ่ม", "มูลค่า", "ภาษีซื้อ", "ภาษีขาย"],
  ["ภงด3", "ภงด53", "wht", "หักณที่จ่าย", "ทวิ"],
  ["งบการเงิน", "งบทดลอง", "ทดลอง", "งบดุล", "งบกำไรขาดทุน", "ฐานะ"],
  ["ผังบัญชี", "ผัง", "สมุดรายวัน", "สมุด", "เดบิต", "เครดิต", "gl_journal"],
  ["สินทรัพย์", "ทรัพย์สิน", "ค่าเสื่อม", "ค่าเสื่อมราคา", "เสื่อม", "fa_asset"],
  ["บัตรคุม", "บัตรคุมสินค้า", "การ์ด", "สต็อกการ์ด"],
  ["sql", "query", "queries", "คิวรี"],
  ["สิทธิ์", "กำหนดสิทธิ์"],
];

const SYNONYM_MAP = (() => {
  const m = new Map<string, Set<string>>();
  for (const grp of SYNONYM_GROUPS) {
    const norm = grp.map(normalizeText);
    for (const w of norm) {
      if (!m.has(w)) m.set(w, new Set());
      for (const other of norm) if (other !== w) m.get(w)!.add(other);
    }
  }
  return m;
})();

export function expandSynonyms(primaryTerms: string[]): string[] {
  const seen = new Set(primaryTerms);
  const out: string[] = [];
  for (const t of primaryTerms) {
    for (const syn of SYNONYM_MAP.get(t) ?? []) {
      if (seen.has(syn) || STOP.has(syn)) continue;
      seen.add(syn);
      out.push(syn);
      if (out.length >= 8) return out;
    }
  }
  return out;
}

const k1 = 1.2;
const bm25b = 0.75;

function ensureNoteTokens(b: VaultBundle): Map<string, NoteTokens> {
  if (b.noteTokens) return b.noteTokens;
  const tokMap = new Map<string, NoteTokens>();
  for (const n of b.notes.values()) {
    if (!b.lines.has(n.slug)) {
      b.lines.set(
        n.slug,
        n.body
          .split("\n")
          .filter((l) => l.trim() && !l.startsWith("#"))
          .map((line) => ({ raw: line.replace(/\s+/g, " ").trim().slice(0, 280), norm: normalizeText(line) })),
      );
    }
    const title = new Set(tokenizeNormalized(n.haystack.title));
    const meta = new Set(tokenizeNormalized(n.haystack.meta));
    const body = new Map<string, number>();
    for (const w of tokenizeNormalized(n.haystack.body)) {
      const prev = body.get(w) ?? 0;
      if (prev < 16) body.set(w, prev + 1);
    }
    tokMap.set(n.slug, { title, meta, body });
  }
  b.noteTokens = tokMap;
  return tokMap;
}

function getSearchIndex(b: VaultBundle, filter: AudienceFilter): SearchIndex {
  const existing = b.indexes.get(filter);
  if (existing) return existing;

  const allTokens = ensureNoteTokens(b);
  const notes = [...b.notes.values()].filter((n) => matchesAudience(n.audience, filter));
  const N = notes.length;
  const slugToIdx = new Map(notes.map((n, i) => [n.slug, i]));
  const bodies = notes.map((n) => n.haystack.body);
  const titles = notes.map((n) => n.haystack.title);
  const metas = notes.map((n) => n.haystack.meta);
  const aliasSets = notes.map((n) => new Set(n.aliases.map((a) => normalizeText(a))));
  const avgLen = Math.max(1, bodies.reduce((sum, body) => sum + body.length, 0) / Math.max(1, N));

  const tempPostings = new Map<string, { idx: number[]; raw: number[] }>();
  for (let i = 0; i < N; i++) {
    const n = notes[i];
    const nt = allTokens.get(n.slug)!;
    const norm = k1 * (1 - bm25b + (bm25b * bodies[i].length) / avgLen);
    const seenTerms = new Set<string>();
    for (const t of nt.title) seenTerms.add(t);
    for (const t of nt.meta) seenTerms.add(t);
    for (const t of nt.body.keys()) seenTerms.add(t);
    for (const t of seenTerms) {
      const tf = nt.body.get(t) ?? 0;
      const bodyBm25 = tf ? ((tf * (k1 + 1)) / (tf + norm)) * 2.5 : 0;
      const raw = (nt.title.has(t) ? 10 : 0) + (nt.meta.has(t) ? 6 : 0) + bodyBm25;
      if (!raw) continue;
      let bucket = tempPostings.get(t);
      if (!bucket) {
        bucket = { idx: [], raw: [] };
        tempPostings.set(t, bucket);
      }
      bucket.idx.push(i);
      bucket.raw.push(raw);
    }
  }

  const postings = new Map<string, Posting>();
  for (const [t, bucket] of tempPostings) {
    postings.set(t, {
      idx: Int32Array.from(bucket.idx),
      raw: Float32Array.from(bucket.raw),
      idf: Math.log(1 + N / (1 + bucket.idx.length)),
    });
  }

  const neighborIdx = notes.map((n, i) => {
    const set = new Set<number>();
    for (const s of n.links) {
      if (s === "index") continue;
      const j = slugToIdx.get(s);
      if (j !== undefined && j !== i) set.add(j);
    }
    for (const s of n.backlinks) {
      if (s === "index") continue;
      const j = slugToIdx.get(s);
      if (j !== undefined && j !== i) set.add(j);
    }
    return Int32Array.from(set);
  });

  const isHub = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const n = notes[i];
    if (n.slug.endsWith("-overview") || n.folder === "root") isHub[i] = 1;
  }

  const built: SearchIndex = {
    notes,
    slugToIdx,
    avgLen,
    postings,
    fallbackPostings: new Map(),
    bodies,
    titles,
    metas,
    aliasSets,
    neighborIdx,
    isHub,
    baseBuf: new Float64Array(N),
    matchBuf: new Int32Array(N),
  };
  b.indexes.set(filter, built);
  // Pre-warm multi-token synonym phrases once so uncached queries never scan full bodies for synonym expansion
  for (const grp of SYNONYM_GROUPS) {
    for (const rawPhrase of grp) {
      const p = normalizeText(rawPhrase);
      if (!built.postings.has(p)) getPosting(built, p);
    }
  }
  return built;
}

function getPosting(idx: SearchIndex, t: string): Posting {
  const direct = idx.postings.get(t);
  if (direct) return direct;
  const cached = idx.fallbackPostings.get(t);
  if (cached) return cached;

  const N = idx.notes.length;
  const avgLen = idx.avgLen;
  const hitIdx: number[] = [];
  const hitRaw: number[] = [];
  for (let i = 0; i < N; i++) {
    const tf = count(idx.bodies[i], t);
    const tHit = count(idx.titles[i], t, 1);
    const mHit = count(idx.metas[i], t, 1);
    if (!tf && !tHit && !mHit) continue;
    const norm = k1 * (1 - bm25b + (bm25b * idx.bodies[i].length) / avgLen);
    const bodyBm25 = tf ? ((tf * (k1 + 1)) / (tf + norm)) * 2.5 : 0;
    const raw = (tHit ? 10 : 0) + (mHit ? 6 : 0) + bodyBm25;
    if (raw) {
      hitIdx.push(i);
      hitRaw.push(raw);
    }
  }
  const built: Posting = {
    idx: Int32Array.from(hitIdx),
    raw: Float32Array.from(hitRaw),
    idf: Math.log(1 + N / (1 + hitIdx.length)),
  };
  if (idx.fallbackPostings.size >= 256) {
    const oldest = idx.fallbackPostings.keys().next().value;
    if (oldest !== undefined) idx.fallbackPostings.delete(oldest);
  }
  idx.fallbackPostings.set(t, built);
  return built;
}

// ponytail: inverted-index BM25 + Thai-SQL synonym expansion + hub authority + 1-hop graph boost
export function search(q: string, limit = 8, filter: AudienceFilter = "all"): SearchHit[] {
  const b = getBundle();
  const cacheKey = `${filter}\0${limit}\0${q.trim()}`;
  const cachedHit = b.searches.get(cacheKey);
  if (cachedHit) return cachedHit;

  const ts = terms(q);
  if (!ts.length) return [];
  const idx = getSearchIndex(b, filter);
  const N = idx.notes.length;
  if (!N) return [];

  const synTerms = expandSynonyms(ts);
  const phrase = normalizeText(q.trim());
  const chunks = phrase.split(/\s+/).filter((c) => c.length > 1);
  const identChunks = chunks.filter((c) => c.includes("_"));

  const base = idx.baseBuf;
  const matched = idx.matchBuf;
  base.fill(0);
  matched.fill(0);

  let idfSum = 0;
  for (let ti = 0; ti < ts.length; ti++) {
    const p = getPosting(idx, ts[ti]);
    idfSum += p.idf;
    const pidx = p.idx;
    const praw = p.raw;
    const pidf = p.idf;
    for (let k = 0; k < pidx.length; k++) {
      const docId = pidx[k];
      base[docId] += praw[k] * pidf;
      matched[docId]++;
    }
  }
  const bonus = idfSum / ts.length;

  let maxMatched = 0;
  for (let i = 0; i < N; i++) {
    if (matched[i] > maxMatched) maxMatched = matched[i];
    if (ts.length > 1 && matched[i] === ts.length) base[i] *= 1.5;
  }

  for (let si = 0; si < synTerms.length; si++) {
    const sp = getPosting(idx, synTerms[si]);
    const pidx = sp.idx;
    const praw = sp.raw;
    const weight = sp.idf * 0.3;
    for (let k = 0; k < pidx.length; k++) {
      base[pidx[k]] += praw[k] * weight;
    }
  }

  // Exact alias match, SQL table-name identifier match, and gated phrase scan
  const checkPhrase = phrase.length > 3;
  const checkAliasChunks = chunks.length > 1;
  const minPhraseMatch = Math.min(2, ts.length);
  for (let i = 0; i < N; i++) {
    let sc = base[i];
    const hasBase = sc > 0;
    if (hasBase && checkPhrase && matched[i] >= minPhraseMatch && idx.bodies[i].includes(phrase)) sc += 8 * bonus;

    if (hasBase || identChunks.length) {
      const aliasSet = idx.aliasSets[i];
      let exactAlias = phrase.length > 1 && aliasSet.has(phrase) ? 1 : 0;
      if (checkAliasChunks) {
        for (let ci = 0; ci < chunks.length; ci++) {
          if (chunks[ci] !== phrase && aliasSet.has(chunks[ci])) exactAlias++;
        }
      }
      if (exactAlias) sc += 12 * bonus * exactAlias;

      for (let ci = 0; ci < identChunks.length; ci++) {
        const c = identChunks[ci];
        const kebab = c.replace(/_/g, "-");
        const slug = idx.notes[i].slug;
        if (count(idx.titles[i], c, 1) > 0) sc += 10 * bonus;
        if (slug === kebab || slug === `tbl-${kebab}`) sc += 18 * bonus;
      }
    }
    base[i] = sc;
  }

  // 1-hop graph boost (top 3 active neighbors) + hub authority on broad (>=3-term) queries
  const broadQuery = ts.length >= 3;
  const ranked: { idx: number; score: number }[] = [];
  for (let i = 0; i < N; i++) {
    const sc = base[i];
    if (sc <= 0) continue;
    const nbs = idx.neighborIdx[i];
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let activeCount = 0;
    for (let ni = 0; ni < nbs.length; ni++) {
      const nbScore = base[nbs[ni]];
      if (nbScore <= 0) continue;
      activeCount++;
      if (nbScore >= t1) {
        t3 = t2;
        t2 = t1;
        t1 = nbScore;
      } else if (nbScore >= t2) {
        t3 = t2;
        t2 = nbScore;
      } else if (nbScore > t3) {
        t3 = nbScore;
      }
    }
    const graphBoost = (t1 + t2 + t3) * 0.08;
    const hubBoost =
      broadQuery && !identChunks.length && idx.isHub[i] && matched[i] >= maxMatched && activeCount >= 4
        ? sc * Math.min(0.22, Math.log2(activeCount) * 0.07)
        : 0;
    ranked.push({ idx: i, score: sc + graphBoost + hubBoost });
  }

  ranked.sort((a, b2) => b2.score - a.score);
  const result = ranked.slice(0, limit).map(({ idx: docId, score }) => {
    const note = idx.notes[docId];
    return {
      slug: note.slug,
      title: note.title,
      folder: note.folder,
      audience: note.audience,
      tags: note.tags,
      score: Math.round(score),
      snippet: snippetFromLines(linesForNote(b, note), ts),
    };
  });
  if (b.searches.size >= 256) {
    const oldest = b.searches.keys().next().value;
    if (oldest !== undefined) b.searches.delete(oldest);
  }
  b.searches.set(cacheKey, result);
  return result;
}

// ---------- Graph Traversal & Neighborhood Context ----------
const edgeListFor = (n: Note, dir: "both" | "out" | "in"): { slug: string; rel: RelationType; direction: "out" | "in" }[] => {
  const out = dir !== "in" ? n.outEdges.map((e) => ({ slug: e.slug, rel: e.rel, direction: "out" as const })) : [];
  const inn = dir !== "out" ? n.inEdges.map((e) => ({ slug: e.slug, rel: e.rel, direction: "in" as const })) : [];
  return [...out, ...inn];
};

function bfsPath(
  all: Map<string, Note>,
  startSlug: string,
  targetSlug: string,
  dir: "both" | "out" | "in",
  filter: AudienceFilter,
  relation: RelationType | undefined,
  avoidIndex: boolean,
): TraverseStep[] | null {
  if (startSlug === targetSlug) return [];
  const visited = new Set<string>([startSlug]);
  const parent = new Map<string, { prev: string; step: TraverseStep }>();
  const queue: { slug: string; hop: number }[] = [{ slug: startSlug, hop: 0 }];

  for (let qi = 0; qi < queue.length; qi++) {
    const { slug, hop } = queue[qi];
    if (hop >= 6) continue;
    const node = all.get(slug);
    if (!node) continue;
    for (const e of edgeListFor(node, dir)) {
      if (relation && e.rel !== relation) continue;
      if (visited.has(e.slug)) continue;
      const nb = all.get(e.slug);
      if (!nb || !matchesAudience(nb.audience, filter)) continue;
      if (avoidIndex && e.slug === "index" && e.slug !== targetSlug) continue;
      visited.add(e.slug);
      const step: TraverseStep = {
        slug: nb.slug,
        title: nb.title,
        folder: nb.folder,
        audience: nb.audience,
        hop: hop + 1,
        via: slug,
        rel: e.rel,
        direction: e.direction,
      };
      parent.set(nb.slug, { prev: slug, step });
      if (nb.slug === targetSlug) {
        const path: TraverseStep[] = [];
        let cur: string | undefined = targetSlug;
        while (cur && cur !== startSlug) {
          const entry = parent.get(cur);
          if (!entry) break;
          path.push(entry.step);
          cur = entry.prev;
        }
        return path.reverse();
      }
      queue.push({ slug: nb.slug, hop: hop + 1 });
    }
  }
  return null;
}

export function traverseGraph(opts: TraverseOptions): TraverseResult {
  const filter = opts.audience ?? "all";
  const dir = opts.direction ?? "both";
  const all = vault();
  const start = getNote(opts.slug);
  if (!start || !matchesAudience(start.audience, filter)) {
    return { start: null, mode: opts.toSlug ? "path" : "neighborhood", neighbors: [] };
  }

  if (opts.toSlug) {
    const target = getNote(opts.toSlug);
    if (!target || !matchesAudience(target.audience, filter)) {
      return { start, target: null, mode: "path", neighbors: [], path: [] };
    }
    const avoidIdx = start.slug !== "index" && target.slug !== "index";
    const path =
      bfsPath(all, start.slug, target.slug, dir, filter, opts.relation, avoidIdx) ??
      (avoidIdx ? bfsPath(all, start.slug, target.slug, dir, filter, opts.relation, false) : null) ??
      [];
    return { start, target, mode: "path", neighbors: path, path };
  }

  const maxDepth = Math.min(3, Math.max(1, opts.depth ?? 2));
  const maxLimit = Math.min(50, Math.max(1, opts.limit ?? 25));
  const visited = new Set<string>([start.slug]);
  const found: TraverseStep[] = [];
  const queue: { slug: string; hop: number }[] = [{ slug: start.slug, hop: 0 }];

  for (let qi = 0; qi < queue.length; qi++) {
    const { slug, hop } = queue[qi];
    if (hop >= maxDepth) continue;
    // Do not explode hop >= 2 through the central hub unless starting from "index"
    if (hop >= 1 && slug === "index" && start.slug !== "index") continue;
    const node = all.get(slug);
    if (!node) continue;
    for (const e of edgeListFor(node, dir)) {
      if (opts.relation && e.rel !== opts.relation) continue;
      if (visited.has(e.slug)) continue;
      const nb = all.get(e.slug);
      if (!nb || !matchesAudience(nb.audience, filter)) continue;
      visited.add(e.slug);
      const nextHop = hop + 1;
      found.push({
        slug: nb.slug,
        title: nb.title,
        folder: nb.folder,
        audience: nb.audience,
        hop: nextHop,
        via: slug,
        rel: e.rel,
        direction: e.direction,
      });
      queue.push({ slug: nb.slug, hop: nextHop });
    }
  }

  const folderFilter = opts.folder?.trim().toLowerCase();
  const degreeOf = (s: string) => {
    const n = all.get(s);
    return n ? n.links.length + n.backlinks.length : 0;
  };
  const neighbors = found
    .filter((s) => !folderFilter || s.folder === folderFilter)
    .sort((a, b2) => a.hop - b2.hop || degreeOf(b2.slug) - degreeOf(a.slug) || a.slug.localeCompare(b2.slug))
    .slice(0, maxLimit);

  return { start, mode: "neighborhood", neighbors };
}

const REL_PRIORITY: Partial<Record<RelationType, number>> = {
  follows_rule: 6,
  uses_table: 5,
  writes_table: 5,
  posts_rule: 4,
  solves_issue: 4,
  has_query: 3,
  exposes_api: 3,
  has_report: 2,
  guides_howto: 2,
};

export function connectedNeighbors(
  seedSlugs: string[],
  filter: AudienceFilter = "all",
  limit = 6,
): (TraverseStep & { shared: number })[] {
  const all = vault();
  const seeds = new Set(seedSlugs);
  const acc = new Map<string, { step: TraverseStep; shared: number; priority: number }>();

  for (const seedSlug of seedSlugs) {
    const seed = all.get(seedSlug);
    if (!seed || !matchesAudience(seed.audience, filter)) continue;
    const perSeed = new Set<string>();
    for (const e of edgeListFor(seed, "both")) {
      if (seeds.has(e.slug) || e.slug === "index" || perSeed.has(e.slug)) continue;
      const nb = all.get(e.slug);
      if (!nb || !matchesAudience(nb.audience, filter)) continue;
      perSeed.add(e.slug);
      const pri = REL_PRIORITY[e.rel] ?? 1;
      const prev = acc.get(e.slug);
      if (!prev) {
        acc.set(e.slug, {
          step: { slug: nb.slug, title: nb.title, folder: nb.folder, audience: nb.audience, hop: 1, via: seedSlug, rel: e.rel, direction: e.direction },
          shared: 1,
          priority: pri,
        });
      } else {
        prev.shared++;
        if (pri > prev.priority) {
          prev.priority = pri;
          prev.step.rel = e.rel;
          prev.step.via = seedSlug;
          prev.step.direction = e.direction;
        }
      }
    }
  }

  return [...acc.values()]
    .sort((a, b2) => b2.shared - a.shared || b2.priority - a.priority || a.step.slug.localeCompare(b2.step.slug))
    .slice(0, limit)
    .map(({ step, shared }) => ({ ...step, shared }));
}

// long notes for ask_brain: the intro plus the "## " sections that mention the query most, within budget, and say what was left out
export function excerpt(body: string, ts: string[], budget: number): string {
  if (body.length <= budget) return body;
  const parts = body.split(/\n(?=## )/);
  const hits = parts.map((p) => {
    const np = normalizeText(p);
    let h = 0;
    for (let i = 0; i < ts.length; i++) h += count(np, ts[i]);
    return h;
  });
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
  const b = getBundle();
  const isVaultNote = b.notes.get(n.slug) === n;
  if (isVaultNote) {
    const cached = b.rendered.get(n.slug);
    if (cached !== undefined) return cached;
  }
  const notes = b.notes;
  const body = n.body.replace(WIKILINK, (_m, _rel: string | undefined, target: string, _h, label?: string) => {
    const slug = linkTarget(target);
    const text = (label ?? notes.get(slug)?.title ?? target).replace(/[[\]]/g, "");
    return `[${text}](${notes.has(slug) ? `/n/${encodeURIComponent(slug)}` : "#missing"})`;
  });
  const html = marked.parse(body, { async: false });
  if (isVaultNote) b.rendered.set(n.slug, html);
  return html;
}

// last knowledge update shown on every page and in MCP instructions, Thai date + time in Bangkok time
export const updatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" })
  .format(new Date(process.env.BUILD_TIME ?? Date.now())) + " น.";

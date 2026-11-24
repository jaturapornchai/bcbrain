import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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
import {
  buildErrorIndex,
  buildSectionIndex,
  buildSectionSnippet,
  buildSemanticIndex,
  clearSectionNoteBuffers,
  computeRrfScores,
  encodeQueryVector,
  estimateTokens,
  extractNoteFacts,
  extractStructuredFacts,
  extractVaultRecencyMap,
  queryErrorIndex,
  scoreSectionIndex,
  scoreSemanticVectors,
  SEMANTIC_DIM,
  topKIndices,
  trimBlockAware,
  type ErrorIndex,
  type ErrorLookupEntry,
  type FactKind,
  type NoteRecency,
  type NoteRecencyMeta,
  type PreTokenizedSection,
  type RrfSignalInput,
  type SectionSearchHit,
  type SectionSearchIndex,
  type SemanticIndex,
  type StructuredFact,
  type TrimBlockOptions,
  type TrimBlockResult,
} from "./vault-retrieval";

export {
  computeRrfScores,
  estimateTokens,
  extractNoteFacts,
  extractStructuredFacts,
  SEMANTIC_DIM,
  trimBlockAware,
  type ErrorLookupEntry,
  type FactKind,
  type NoteRecency,
  type NoteRecencyMeta,
  type RrfSignalInput,
  type SectionSearchHit,
  type SemanticIndex,
  type StructuredFact,
  type TrimBlockOptions,
  type TrimBlockResult,
};

export type Edge = {
  slug: string;
  rel: RelationType;
  inferred?: boolean;
};

export type ImageMedia = {
  alt: string;
  url: string;
};

export type VideoMedia = {
  title: string;
  url: string;
  videoId?: string;
  listId?: string;
  thumbnailUrl?: string;
  embedUrl: string;
};

export type WebPageLink = {
  title: string;
  url: string;
};

export type NoteMedia = {
  images: ImageMedia[];
  videos: VideoMedia[];
  webPages: WebPageLink[];
};

export type MediaItem = {
  kind: "youtube" | "image" | "webpage";
  title: string;
  url: string;
  videoId?: string;
  listId?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  noteSlug: string;
  noteTitle: string;
};

export type NoteSection = {
  heading: string;
  raw: string;
  norm: string;
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
  cleanBody?: string;
  tldr?: string;
  sections?: NoteSection[];
  facts?: string[];
  updatedAt?: string;
  updatedTs?: number;
  lastCommit?: string;
  links: string[];
  backlinks: string[];
  outEdges: Edge[];
  inEdges: Edge[];
  media?: NoteMedia;
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
  bestSection?: string;
  images?: ImageMedia[];
  videos?: VideoMedia[];
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
    .replace(/เครม/g, "เคลม")
    .replace(/\be-tax\b/g, "etax")
    .replace(/\be-wht\b/g, "ewht")
    .replace(/\be-filing\b/g, "efiling")
    .replace(/\be-pod\b/g, "epod")
    .replace(/\b3-way\b/g, "3way")
    .replace(/\b(ctrl|alt|shift)\s*\+\s*([a-z0-9]+)\b/g, "$1_$2");

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

const ALLOWED_IMAGE_HOST = /^https:\/\/(?:www\.)?bcaccount\.com\/|^https:\/\/qr-official\.line\.me\/|^\//i;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST_RE = /^[A-Za-z0-9_-]{10,40}$/;
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const MD_LINK_RE = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const ASSET_EXT_RE = /\.(?:png|jpe?g|webp|gif|svg|ico|pdf)(?:$|\?)/i;

export function resolveBcImageUrl(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (!ALLOWED_IMAGE_HOST.test(trimmed)) return null;
  // www.bcaccount.com returns 404 on /manual/images/* while apex https://bcaccount.com/* serves all 58 live assets with 200 OK
  return trimmed.replace(/^https:\/\/www\.bcaccount\.com\//i, "https://bcaccount.com/");
}

export function parseYouTubeUrl(rawHref: string): { videoId?: string; listId?: string; embedUrl: string; watchUrl: string; thumbnailUrl?: string } | null {
  let u: URL;
  try {
    u = new URL(rawHref.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  let videoId: string | undefined;
  let listId: string | undefined;
  const listParam = u.searchParams.get("list") ?? undefined;
  if (listParam && YT_LIST_RE.test(listParam)) listId = listParam;

  if (host === "youtu.be") {
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (seg && YT_ID_RE.test(seg)) videoId = seg;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") {
      const v = u.searchParams.get("v") ?? undefined;
      if (v && YT_ID_RE.test(v)) videoId = v;
    } else if (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/")) {
      const seg = u.pathname.split("/")[2];
      if (seg && YT_ID_RE.test(seg)) videoId = seg;
    }
  } else {
    return null;
  }

  if (!videoId && !listId) return null;
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}${listId ? `?list=${listId}&rel=0` : "?rel=0"}`
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}`;
  const watchUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}${listId ? `&list=${listId}` : ""}`
    : `https://www.youtube.com/playlist?list=${listId}`;
  const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
  return { videoId, listId, embedUrl, watchUrl, thumbnailUrl };
}

export function extractNoteMedia(body: string, noteTitle = ""): NoteMedia {
  const images: ImageMedia[] = [];
  const videos: VideoMedia[] = [];
  const webPages: WebPageLink[] = [];
  const seenImg = new Set<string>();
  const seenVid = new Set<string>();
  const seenWeb = new Set<string>();

  for (const m of body.matchAll(MD_IMAGE_RE)) {
    const resolved = resolveBcImageUrl(m[2] ?? "");
    if (!resolved) continue;
    const fullUrl = resolved.startsWith("/") ? `https://brain.bcsmethai.com${resolved}` : resolved;
    if (seenImg.has(fullUrl)) continue;
    seenImg.add(fullUrl);
    images.push({ alt: (m[1] || noteTitle || "ภาพประกอบหน้าจอ BC Ai Account").trim(), url: fullUrl });
  }

  for (const line of body.split("\n")) {
    for (const m of line.matchAll(MD_LINK_RE)) {
      const rawLabel = (m[1] ?? "").replace(/^(?:🎬|▶)\s*/, "").trim();
      const rawUrl = (m[2] ?? "").trim();
      const yt = parseYouTubeUrl(rawUrl);
      if (yt) {
        if (seenVid.has(yt.watchUrl)) continue;
        seenVid.add(yt.watchUrl);
        // If link is inside a markdown table row with generic label like "ดูคลิป YouTube", extract the row's descriptive cell
        let title = rawLabel;
        if ((!title || /^ดูคลิป|^รับชม|^youtube$/i.test(title)) && line.trim().startsWith("|")) {
          const cells = line
            .split("|")
            .map((c) => c.replace(/\*\*/g, "").trim())
            .filter(Boolean);
          if (cells[1]) title = cells[1].split("—")[0].trim();
        }
        videos.push({
          title: title || noteTitle || "วิดีโอสอนใช้งาน BC Ai Account",
          url: yt.watchUrl,
          videoId: yt.videoId,
          listId: yt.listId,
          thumbnailUrl: yt.thumbnailUrl,
          embedUrl: yt.embedUrl,
        });
        continue;
      }
      if (/^https:\/\/(?:www\.)?bcaccount\.com\b/i.test(rawUrl) && !ASSET_EXT_RE.test(rawUrl)) {
        const canonical = rawUrl.replace(/^https:\/\/www\.bcaccount\.com/i, "https://bcaccount.com");
        if (seenWeb.has(canonical)) continue;
        seenWeb.add(canonical);
        webPages.push({ title: rawLabel || canonical, url: canonical });
      }
    }
  }

  return { images, videos, webPages };
}

function buildNoteTldr(title: string, cleanBody: string, explicit?: unknown): string {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim().slice(0, 500);
  const lines = cleanBody.split("\n");
  const picked: string[] = [];
  let chars = 0;
  let inCode = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !trimmed) continue;
    if (trimmed.startsWith("# ")) continue;
    if (trimmed === "---" || /^!\[/.test(trimmed) || /^\[🎬/.test(trimmed) || /^> \[!/.test(trimmed)) continue;
    if (trimmed.startsWith("|---") || trimmed.startsWith("| :---")) continue;
    // Prioritize intro paragraph, menu lines, and concise bullets/steps
    const clean = trimmed
      .replace(/^>\s*/, "")
      .replace(/\[\[(?:[a-z_]+::)?([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, slug, lbl) => lbl ?? slug)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
    if (!clean || clean === title) continue;
    if (picked.length === 0 && clean.startsWith("## ")) continue;
    const nextLen = chars + clean.length + 1;
    if (picked.length >= 1 && nextLen > 420) break;
    picked.push(clean.length > 260 ? `${clean.slice(0, 257)}…` : clean);
    chars = nextLen;
    if (picked.length >= 5) break;
  }
  return picked.join("\n") || title;
}

function splitPrecomputedSections(cleanBody: string): NoteSection[] {
  return cleanBody.split(/\n(?=## )/).map((raw) => ({
    heading: raw.split("\n")[0].replace(/^#+\s*/, "").trim(),
    raw,
    norm: normalizeText(raw),
  }));
}

function readRawVaultEntries(): { slug: string; folder: string; text: string }[] {
  const packFile = process.env.BC_VAULT_PACK_FILE?.trim();
  if (packFile && fs.existsSync(packFile)) {
    try {
      const rawBuf = fs.readFileSync(packFile);
      const jsonText = packFile.endsWith(".gz") || (rawBuf[0] === 0x1f && rawBuf[1] === 0x8b)
        ? zlib.gunzipSync(rawBuf).toString("utf8")
        : rawBuf.toString("utf8");
      const parsed = JSON.parse(jsonText) as { notes?: { slug: string; folder: string; raw: string }[] };
      if (Array.isArray(parsed.notes) && parsed.notes.length > 0) {
        return parsed.notes.map((n) => ({
          slug: String(n.slug).toLowerCase(),
          folder: String(n.folder || "root"),
          text: String(n.raw ?? "").replace(/\r\n/g, "\n"),
        }));
      }
    } catch (e) {
      console.warn(`[vault] failed reading BC_VAULT_PACK_FILE (${packFile}):`, e instanceof Error ? e.message : e);
    }
  }
  const out: { slug: string; folder: string; text: string }[] = [];
  for (const file of walk(VAULT_DIR)) {
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    } catch {
      continue;
    }
    const slug = path.basename(file, ".md").toLowerCase();
    const rel = path.relative(VAULT_DIR, file).split(path.sep);
    const folder = rel.length > 1 ? rel[0] : "root";
    out.push({ slug, folder, text });
  }
  return out;
}

function load(): Map<string, Note> {
  const notes = new Map<string, Note>();
  const rawLinks = new Map<string, { target: string; explicitRel?: RelationType }[]>();
  for (const { slug, folder, text } of readRawVaultEntries()) {
    if (!text.trim()) continue;
    if (notes.has(slug)) {
      console.warn(`[vault] duplicate slug ${slug}: ignored`);
      continue;
    }
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
    const rawAud = typeof meta.audience === "string" ? meta.audience.trim().toLowerCase() : "";
    const audience: Audience = VALID_AUDIENCES.has(rawAud as Audience)
      ? (rawAud as Audience)
      : groupOf(folder).audience;
    const title = String(meta.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? slug);
    const tags = asList(meta.tags);
    const aliases = asList(meta.aliases);
    const cleanBody = stripSeeAlso(body);
    const tldr = buildNoteTldr(title, cleanBody, meta.tldr);
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
      cleanBody,
      tldr,
      links: [...new Set(parsedLinks.map((x) => x.target))],
      backlinks: [],
      outEdges: [],
      inEdges: [],
      media: extractNoteMedia(body, title),
      haystack: {
        title: normalizeText(title),
        meta: normalizeText([slug, folder, ...tags, ...aliases].join(" ")),
        body: normalizeText(body.replace(/\[\[([a-z_]+)::/g, (_m, r) => (isRelationType(r) ? "[[" : _m))),
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
      if (added >= 16) break;
    }
  }

  // 2b) Smart source-code synapses:
  //     - implements_code: connects dev notes across different folders sharing focused module files (freq 2..8)
  //     - bridges_zone: connects dev notes -> user notes sharing the exact same screen/process source file (freq 2..8)
  const sourceIndex = new Map<string, string[]>();
  for (const n of notes.values()) {
    const uniqSrc = new Set<string>();
    for (const raw of n.sources) {
      const clean = raw.split(":")[0]?.replace(/\\/g, "/").trim() ?? "";
      if (!clean.includes("/") || clean.startsWith("scripts/sql/") || clean.startsWith("bcaiwebsite-live/")) continue;
      uniqSrc.add(clean);
    }
    for (const srcPath of uniqSrc) {
      const bucket = sourceIndex.get(srcPath);
      if (bucket) bucket.push(n.slug);
      else sourceIndex.set(srcPath, [n.slug]);
    }
  }
  for (const n of notes.values()) {
    if (n.audience !== "dev") continue;
    const existingTargets = new Set(n.links);
    let addedCode = 0;
    let addedBridge = 0;
    for (const raw of n.sources) {
      const clean = raw.split(":")[0]?.replace(/\\/g, "/").trim() ?? "";
      const peers = sourceIndex.get(clean);
      if (!peers || peers.length < 2 || peers.length > 8) continue;
      for (const peerSlug of peers) {
        if (peerSlug === n.slug || existingTargets.has(peerSlug)) continue;
        const peer = notes.get(peerSlug);
        if (!peer) continue;
        if (peer.audience === "dev" && peer.folder !== n.folder && addedCode < 6) {
          existingTargets.add(peerSlug);
          n.outEdges.push({ slug: peerSlug, rel: "implements_code", inferred: true });
          n.links.push(peerSlug);
          addedCode++;
        } else if (peer.audience === "user" && addedBridge < 8) {
          existingTargets.add(peerSlug);
          n.outEdges.push({ slug: peerSlug, rel: "bridges_zone", inferred: true });
          n.links.push(peerSlug);
          addedBridge++;
        }
      }
    }
  }

  // 2c) Automatic 4-digit menu-code synapses (`shares_menu`):
  //     Connects focused user notes referencing the same menu code (e.g. 1004, 2050, 4013) without exploding broad catalogs.
  const menuIndex = new Map<string, string[]>();
  const MENU_CODE_CTX = /(?:เมนู|รหัสเมนู|รหัส|menu)\s*([1-9]\d{3})\b/gi;
  const isExcludedYear = (c: string) => {
    const n = Number(c);
    return (n >= 2015 && n <= 2035) || (n >= 2555 && n <= 2580);
  };
  for (const n of notes.values()) {
    if (n.audience !== "user" || n.slug === "index" || n.slug.startsWith("menu-cat")) continue;
    const foundMenus = new Set<string>();
    for (const m of `${n.title} ${n.aliases.join(" ")} ${n.body}`.matchAll(MENU_CODE_CTX)) {
      const code = m[1];
      if (code && !isExcludedYear(code)) foundMenus.add(code);
    }
    for (const a of n.aliases) {
      const t = a.trim();
      if (/^[1-9]\d{3}$/.test(t) && !isExcludedYear(t)) foundMenus.add(t);
    }
    for (const code of foundMenus) {
      const bucket = menuIndex.get(code);
      if (bucket) bucket.push(n.slug);
      else menuIndex.set(code, [n.slug]);
    }
  }
  for (const n of notes.values()) {
    if (n.audience !== "user" || n.slug === "index" || n.slug.startsWith("menu-cat")) continue;
    const existingTargets = new Set(n.links);
    let addedMenu = 0;
    for (const [code, peers] of menuIndex) {
      if (peers.length < 2 || peers.length > 6 || !peers.includes(n.slug)) continue;
      for (const peerSlug of peers) {
        if (peerSlug === n.slug || existingTargets.has(peerSlug)) continue;
        existingTargets.add(peerSlug);
        n.outEdges.push({ slug: peerSlug, rel: "shares_menu", inferred: true });
        n.links.push(peerSlug);
        addedMenu++;
        if (addedMenu >= 5) break;
      }
      if (addedMenu >= 5) break;
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
  neighborWeights: Float32Array[];
  isHub: Uint8Array;
  baseBuf: Float64Array;
  matchBuf: Int32Array;
  graphBuf: Float64Array;
  lexBuf: Float64Array;
  rrfBuf: Float64Array;
  semantic: SemanticIndex;
  sectionIndex: SectionSearchIndex;
  queryVecBuf: Float32Array;
  semScoreBuf: Float32Array;
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

export type MenuLookupEntry = {
  code: string;
  legacyCode: string;
  name: string;
  menuPath: string;
  edition: string;
  catalogSlug: string;
  relatedSlugs: string[];
  haystack: string;
};

export type TableLookupEntry = {
  table: string;
  schemaSlug: string;
  schemaTitle: string;
  relatedSlugs: string[];
};

export type DirectLookupResult = {
  kind: "menu" | "table" | "mixed" | "none";
  menus: (Omit<MenuLookupEntry, "haystack"> & { docs: { slug: string; title: string; folder: string; audience: Audience }[] })[];
  tables: (TableLookupEntry & { docs: { slug: string; title: string; folder: string }[] })[];
};

type DirectIndex = {
  menuByCode: Map<string, MenuLookupEntry>;
  menuByLegacy: Map<string, MenuLookupEntry>;
  menus: MenuLookupEntry[];
  tableByName: Map<string, TableLookupEntry>;
  tables: TableLookupEntry[];
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
  sectionTokens: Map<string, PreTokenizedSection[]>;
  indexes: Map<AudienceFilter, SearchIndex>;
  directIndex: DirectIndex | null;
  errorIndex: ErrorIndex | null;
  recencyMap: Map<string, NoteRecencyMeta> | null;
  vaultPackGzip: { gz: Buffer; etag: string; noteCount: number; rawBytes: number } | null;
  bootstrapPacks: Map<"user" | "dev", { text: string; etag: string; chars: number }>;
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
      sectionTokens: new Map(),
      indexes: new Map(),
      directIndex: null,
      errorIndex: null,
      recencyMap: null,
      vaultPackGzip: null,
      bootstrapPacks: new Map(),
    };
  }
  return bundleCache;
}

export function bundleVersion(): number {
  return getBundle().builtAt;
}

export function reloadVaultBundle(): void {
  bundleCache = null;
  indexesWarmed = false;
  warmVaultIndexes();
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
    if (raw.includes(".") && !/^\d+(?:\.\d+)+$/.test(raw)) {
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
  const lines = linesForNote(getBundle(), n);
  const prose = lines.find((l) => !/^!\[|^\[(?:🎬|▶)|^https?:\/\//.test(l.raw)) ?? lines[0];
  return (prose?.raw ?? n.title).replace(/[*_`>|[\]]/g, "").slice(0, 160);
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
  ["รหัสเมนู", "เลขเมนู", "สารบัญเมนู", "ผังเมนู"],
  ["คีย์ลัด", "ปุ่มลัด", "shortcut", "shortcuts"],
  ["หาเมนูไม่เจอ", "เมนูหาย", "ซ่อนเมนู", "switchboard"],
  ["สต็อกไม่ตรง", "สต็อกเพี้ยน", "คำนวณยอดสต็อกใหม่"],
  ["พิมพ์ไม่ออก", "ปริ้นไม่ออก", "แบบฟอร์ม", "ตั้งค่าหน้ากระดาษ"],
  ["วิดีโอ", "คลิป", "คลิปสอน", "ยูทูป", "ยูทูบ", "youtube", "สอนใช้งาน"],
  ["ราคา", "แพ็กเกจ", "ค่าบริการ", "ใบเสนอราคา", "ทดลองใช้", "pricing"],
  ["สำนักงานบัญชี", "พาร์ตเนอร์", "partner"],
  ["ข้อเลือกพิเศษ", "ตั้งค่าพิเศษ", "erp_option", "1004"],
  ["ปรับราคา", "ศูนย์ราคา", "ตารางสูตรราคา", "สูตรราคา", "ic_inventory_price"],
  ["shopee", "lazada", "tiktok", "ช้อปปี้", "ลาซาด้า", "ติ๊กต็อก", "marketplace", "ใบกำกับอย่างย่อ", "abb", "ar_marketplace_settlement"],
  ["เงินเดือน", "ประกันสังคม", "สปส", "ภงด1", "payroll", "erp_payroll_run"],
  ["dbd", "efiling", "สบช3", "taxonomy", "ส่งงบ", "กรมพัฒนาธุรกิจ", "gl_dbd_taxonomy_map"],
  ["นักท่องเที่ยว", "ภพ10", "evrt", "vrt", "คืนภาษีนักท่องเที่ยว"],
  ["สองภาษา", "แปลภาษา", "ภาษาอังกฤษ", "bilingual", "i18n", "bc_language"],
  ["ประวัติการพิมพ์", "พิมพ์ซ้ำ", "ต้นฉบับ", "สำเนา", "erp_print_audit_log"],
  ["บัญชีย่อย", "กระทบยอดบัญชีย่อย", "subledger"],
  ["พักบิล", "ปิดกะ", "ลิ้นชัก", "จอลูกค้า", "เครื่องพิมพ์ใบเสร็จ", "objectbox"],
  ["ทุจริต", "เฝ้าระวัง", "จอพนักงาน", "fraud", "workmonitor"],
  ["ป้ายขนส่ง", "ป้ายชื่อขนส่ง", "สติกเกอร์บาร์โค้ด"],
  ["นิติบุคคล", "บุคคลธรรมดา", "คำนำหน้า", "ชื่อบุคคล", "ar_customer", "ap_supplier"],
  ["ขายติดลบ", "สต็อกติดลบ", "ห้ามติดลบ", "สินค้าติดลบ", "negative"],
  ["รูปแบบเอกสาร", "เลขที่เอกสาร", "เล่มเอกสาร", "erp_doc_format", "1014", "1015"],
  ["ออกแบบฟอร์ม", "พิมพ์เอกสาร", "ตัวอย่างก่อนพิมพ์", "print", "1096", "1097"],
  ["ข้อมูลเริ่มต้น", "preset", "starter", "ค่าเริ่มต้น"],
  ["ปรับปรุงภาษา", "language_manage", "พจนานุกรมภาษา", "1005"],
  ["คิวงาน", "ประมวลผลเบื้องหลัง", "procqueue", "ar_rebuild", "ap_rebuild", "jobs_enqueue"],
  ["พารามิเตอร์กลาง", "runtime_options", "options_runtime"],
  ["ปิดเครดิต", "วันปิดเครดิต", "close_credit_date"],
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

  const STRONG_REL = new Set<RelationType>([
    "follows_rule",
    "uses_table",
    "writes_table",
    "posts_rule",
    "solves_issue",
    "shares_menu",
    "implements_code",
    "bridges_zone",
    "has_query",
    "exposes_api",
    "has_report",
  ]);
  const nbIdxList: Int32Array[] = [];
  const nbWeightList: Float32Array[] = [];
  for (let i = 0; i < N; i++) {
    const n = notes[i];
    const wMap = new Map<number, number>();
    for (const e of n.outEdges) {
      if (e.slug === "index") continue;
      const j = slugToIdx.get(e.slug);
      if (j === undefined || j === i) continue;
      const w = STRONG_REL.has(e.rel) ? 1.15 : 0.9;
      if (w > (wMap.get(j) ?? 0)) wMap.set(j, w);
    }
    for (const e of n.inEdges) {
      if (e.slug === "index") continue;
      const j = slugToIdx.get(e.slug);
      if (j === undefined || j === i) continue;
      const w = STRONG_REL.has(e.rel) ? 1.15 : 0.9;
      if (w > (wMap.get(j) ?? 0)) wMap.set(j, w);
    }
    nbIdxList.push(Int32Array.from(wMap.keys()));
    nbWeightList.push(Float32Array.from(wMap.values()));
  }
  const neighborIdx = nbIdxList;
  const neighborWeights = nbWeightList;

  const isHub = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const n = notes[i];
    if (n.slug.endsWith("-overview") || n.folder === "root") isHub[i] = 1;
    if (!n.sections) n.sections = splitPrecomputedSections(n.cleanBody ?? stripSeeAlso(n.body));
  }

  const defaultIdf = Math.log(1 + N);
  const idfLookup = (term: string) => postings.get(term)?.idf ?? defaultIdf;
  const semantic = buildSemanticIndex(notes, idfLookup, tokenizeNormalized, allTokens);
  const sectionIndex = buildSectionIndex(notes, tokenizeNormalized, normalizeText, b.sectionTokens);
  getDirectIndex(b);

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
    neighborWeights,
    isHub,
    baseBuf: new Float64Array(N),
    matchBuf: new Int32Array(N),
    graphBuf: new Float64Array(N),
    lexBuf: new Float64Array(N),
    rrfBuf: new Float64Array(N),
    semantic,
    sectionIndex,
    queryVecBuf: new Float32Array(SEMANTIC_DIM),
    semScoreBuf: new Float32Array(N),
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

export type SearchConfidence = "high" | "medium" | "low";

export type SearchMetaResult = {
  hits: SearchHit[];
  confidence: SearchConfidence;
  totalTerms: number;
  bestMatchedTerms: number;
  topScore: number;
};

let indexesWarmed = false;
export function warmVaultIndexes(): void {
  if (indexesWarmed) return;
  const b = getBundle();
  for (const n of b.notes.values()) {
    if (!n.sections) n.sections = splitPrecomputedSections(n.cleanBody ?? stripSeeAlso(n.body));
    if (!n.facts) n.facts = extractNoteFacts(n);
  }
  getSearchIndex(b, "all");
  getSearchIndex(b, "user");
  getSearchIndex(b, "dev");
  getDirectIndex(b);
  getErrorIndex(b);
  ensureRecency(b);
  indexesWarmed = true;
}

export function getSemanticIndexStats(filter: AudienceFilter = "all"): { dim: number; count: number; byteLength: number } {
  const idx = getSearchIndex(getBundle(), filter);
  return { dim: idx.semantic.dim, count: idx.semantic.count, byteLength: idx.semantic.byteLength };
}

export function searchSemantic(q: string, limit = 8, filter: AudienceFilter = "all"): (SearchHit & { cosine: number })[] {
  const b = getBundle();
  const ts = terms(q);
  if (!ts.length) return [];
  const idx = getSearchIndex(b, filter);
  const N = idx.notes.length;
  if (!N) return [];
  const synTerms = expandSynonyms(ts);
  const defaultIdf = Math.log(1 + N);
  const qVec = encodeQueryVector(ts, synTerms, (t) => idx.postings.get(t)?.idf ?? defaultIdf, idx.queryVecBuf);
  const scores = scoreSemanticVectors(idx.semantic, qVec, idx.semScoreBuf);
  const topIds = topKIndices(scores, N, Math.min(limit, N), 0.05);
  return topIds.map((docId) => {
    const note = idx.notes[docId];
    const cosine = Math.round(scores[docId] * 10000) / 10000;
    const hit: SearchHit & { cosine: number } = {
      slug: note.slug,
      title: note.title,
      folder: note.folder,
      audience: note.audience,
      tags: note.tags,
      score: Math.round(cosine * 100),
      cosine,
      snippet: snippetFromLines(linesForNote(b, note), ts),
    };
    if (note.media?.images.length) hit.images = note.media.images.slice(0, 3);
    if (note.media?.videos.length) hit.videos = note.media.videos.slice(0, 3);
    return hit;
  });
}

export function searchSections(q: string, limit = 8, filter: AudienceFilter = "all"): SectionSearchHit[] {
  const b = getBundle();
  const ts = terms(q);
  if (!ts.length) return [];
  const idx = getSearchIndex(b, filter);
  const synTerms = expandSynonyms(ts);
  const phrase = normalizeText(q.trim());
  const menuCodes = ts.filter((t) => /^[1-9]\d{3}$/.test(t) || /^[1-9](?:\.\d+){1,3}$/.test(t));
  const { touchedNoteCount, topSections } = scoreSectionIndex(idx.sectionIndex, ts, synTerms, phrase, menuCodes, Math.min(30, Math.max(limit, 8)));
  clearSectionNoteBuffers(idx.sectionIndex, touchedNoteCount);
  return topSections.slice(0, limit).map(({ secIdx, score, matched }) => {
    const sec = idx.sectionIndex.sections[secIdx];
    return {
      slug: sec.slug,
      title: sec.title,
      folder: sec.folder,
      audience: sec.audience,
      sectionIndex: sec.sectionIndex,
      heading: sec.heading,
      score: Math.round(score),
      matchedTerms: matched,
      snippet: buildSectionSnippet(sec.raw, ts, normalizeText),
      raw: sec.raw,
    };
  });
}

// ponytail: inverted-index BM25 + Section BM25 + 256-dim dense semantic + Direct Menu/SQL + 1-hop graph Multi-Signal RRF
export function searchWithMeta(q: string, limit = 8, filter: AudienceFilter = "all"): SearchMetaResult {
  const ts = terms(q);
  const hits = search(q, limit, filter);
  if (!hits.length || !ts.length) {
    return { hits, confidence: "low", totalTerms: ts.length, bestMatchedTerms: 0, topScore: 0 };
  }
  const topNote = getNote(hits[0].slug);
  let bestMatchedTerms = 0;
  if (topNote) {
    const combined = `${topNote.haystack.title} ${topNote.haystack.meta} ${topNote.haystack.body}`;
    for (const t of ts) {
      if (combined.includes(t)) bestMatchedTerms++;
    }
  }
  const coverage = bestMatchedTerms / Math.max(1, ts.length);
  const topScore = hits[0].score;
  let confidence: SearchConfidence = "low";
  if ((coverage >= 0.6 && topScore >= 35) || (ts.length === 1 && topScore >= 25) || (coverage === 1 && topScore >= 20)) {
    confidence = "high";
  } else if (coverage >= 0.5 && topScore >= 18) {
    confidence = "medium";
  }
  return { hits, confidence, totalTerms: ts.length, bestMatchedTerms, topScore };
}

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
  const menuCodes = ts.filter((t) => /^[1-9]\d{3}$/.test(t) || /^[1-9](?:\.\d+){1,3}$/.test(t));

  const base = idx.baseBuf;
  const matched = idx.matchBuf;
  const graphBuf = idx.graphBuf;
  base.fill(0);
  matched.fill(0);
  graphBuf.fill(0);

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

  // Exact 4-digit menu code (`1001`–`9070`) and legacy dotted menu code (`1.3.1`) boost via inverted index
  for (let mi = 0; mi < menuCodes.length; mi++) {
    const mp = getPosting(idx, menuCodes[mi]);
    const pidx = mp.idx;
    for (let k = 0; k < pidx.length; k++) {
      const docId = pidx[k];
      const slug = idx.notes[docId].slug;
      if (slug === "index") continue;
      const isCatalog = slug.startsWith("menu-cat");
      base[docId] += (isCatalog ? 18 : 24) * bonus;
    }
  }

  // Signal 1: Exact Direct Menu Code / SQL Table Match ranked list (O(1) direct index lookup)
  const directRanked: number[] = [];
  const directSeen = new Set<number>();
  if (menuCodes.length || (filter !== "user" && identChunks.length)) {
    const directIdx = getDirectIndex(b);
    const pushDirect = (slug?: string) => {
      if (!slug) return;
      const docId = idx.slugToIdx.get(slug);
      if (docId !== undefined && !directSeen.has(docId)) {
        directSeen.add(docId);
        directRanked.push(docId);
      }
    };
    for (const code of menuCodes) {
      const m = directIdx.menuByCode.get(code) ?? directIdx.menuByLegacy.get(code);
      if (!m) continue;
      for (const relSlug of m.relatedSlugs) pushDirect(relSlug);
      pushDirect(m.catalogSlug);
    }
    if (filter !== "user") {
      for (const ident of identChunks) {
        const tbl = directIdx.tableByName.get(ident);
        if (!tbl) continue;
        pushDirect(tbl.schemaSlug);
        for (const relSlug of tbl.relatedSlugs) pushDirect(relSlug);
      }
    }
  }

  // Exact alias match, SQL table-name identifier match, and gated phrase scan
  const checkPhrase = phrase.length > 3 && phrase.length <= 48 && chunks.length <= 4 && ts.length > 1;
  const checkAliasChunks = chunks.length > 1;
  const minPhraseMatch = ts.length;
  let topBase = 0;
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
    if (sc > topBase) topBase = sc;
  }

  // Signal 2: Note-level BM25 top-K ranks
  const bm25Ranked = topKIndices(base, N, 24, 0);

  // Signal 3: Section-level BM25 (zero-alloc sparse O(postings) over ~2,000 "## Section" chunks)
  const secIdxObj = idx.sectionIndex;
  const { touchedNoteCount } = scoreSectionIndex(secIdxObj, ts, synTerms, phrase, menuCodes, 0);
  const sectionRanked = topKIndices(secIdxObj.noteBestScore, N, 20, 0);

  // Signal 4: 1-hop graph proximity + hub authority on broad (>=3-term) queries
  const broadQuery = ts.length >= 3;
  const lexBuf = idx.lexBuf;
  const rrfBuf = idx.rrfBuf;
  lexBuf.fill(0);
  rrfBuf.fill(0);
  for (let i = 0; i < N; i++) {
    const sc = base[i];
    if (sc <= 0) continue;
    const nbs = idx.neighborIdx[i];
    const nbW = idx.neighborWeights[i];
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let activeCount = 0;
    for (let ni = 0; ni < nbs.length; ni++) {
      const rawNb = base[nbs[ni]];
      if (rawNb <= 0) continue;
      activeCount++;
      const nbScore = rawNb * nbW[ni];
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
    graphBuf[i] = graphBoost;
    const hubBoost =
      broadQuery && !identChunks.length && idx.isHub[i] && matched[i] >= maxMatched && activeCount >= 4
        ? sc * Math.min(0.22, Math.log2(activeCount) * 0.07)
        : 0;
    lexBuf[i] = sc + graphBoost + hubBoost;
  }
  const graphRanked = topKIndices(graphBuf, N, 20, 0);

  // Signal 5: Lightweight 256-dim Dense Semantic Cosine Similarity (runs when BM25 is not already clear-high or sparse)
  const bm25High = maxMatched === ts.length && topBase >= 45 && bm25Ranked.length >= limit;
  let semRanked: number[] = [];
  let semScores: Float32Array | null = null;
  if (!bm25High) {
    const defaultIdf = Math.log(1 + N);
    const qVec = encodeQueryVector(ts, synTerms, (t) => idx.postings.get(t)?.idf ?? defaultIdf, idx.queryVecBuf);
    semScores = scoreSemanticVectors(idx.semantic, qVec, idx.semScoreBuf);
    semRanked = topKIndices(semScores, N, 20, 0.16);
  }

  // Zero-alloc Multi-Signal Reciprocal Rank Fusion (Exact Menu/SQL + Note BM25 + Section BM25 + 1-Hop Graph + Semantic)
  const RRF_K = 40;
  const addRrf = (ids: number[], weight: number) => {
    for (let r = 0; r < ids.length; r++) rrfBuf[ids[r]] += weight / (RRF_K + r + 1);
  };
  if (directRanked.length) addRrf(directRanked, 1.5);
  if (bm25Ranked.length) addRrf(bm25Ranked, 1.4);
  if (sectionRanked.length) addRrf(sectionRanked, bm25High ? 0.6 : 1.05);
  if (graphRanked.length) addRrf(graphRanked, 0.45);
  if (semRanked.length) addRrf(semRanked, 1.05);

  const coverageRatio = maxMatched / Math.max(1, ts.length);
  const weakTrapGuard = coverageRatio < 0.5 && topBase < 18;
  const anchor = Math.min(75, Math.max(0, topBase));
  const rrfScale = bm25High ? anchor * 2.0 : Math.max(16, anchor) * 3.6;

  const ranked: { idx: number; score: number }[] = [];
  for (let docId = 0; docId < N; docId++) {
    const lex = lexBuf[docId];
    if (lex > 0) {
      const rawFused = lex + rrfBuf[docId] * rrfScale;
      // Preserve strict trap abstention: never let RRF push an out-of-domain low-coverage query over topScore=18
      ranked.push({ idx: docId, score: weakTrapGuard ? Math.min(17, rawFused) : rawFused });
    }
  }
  // Admit high-similarity semantic fallback candidates when BM25 is weak/sparse (strictly bounded below abstain threshold)
  if (semScores && semRanked.length) {
    for (let k = 0; k < Math.min(8, semRanked.length); k++) {
      const docId = semRanked[k];
      if (lexBuf[docId] <= 0 && semScores[docId] >= 0.24) {
        const finalScore = Math.min(15, semScores[docId] * 28 + rrfBuf[docId] * 50);
        if (finalScore > 0) ranked.push({ idx: docId, score: finalScore });
      }
    }
  }

  ranked.sort((a, b2) => b2.score - a.score);
  const result = ranked.slice(0, limit).map(({ idx: docId, score }) => {
    const note = idx.notes[docId];
    const hit: SearchHit = {
      slug: note.slug,
      title: note.title,
      folder: note.folder,
      audience: note.audience,
      tags: note.tags,
      score: Math.round(score),
      snippet: snippetFromLines(linesForNote(b, note), ts),
    };
    const bestSecIdx = secIdxObj.noteBestSecIdx[docId];
    if (bestSecIdx >= 0) {
      const heading = secIdxObj.sections[bestSecIdx].heading;
      if (heading && heading !== note.title) hit.bestSection = heading;
    }
    if (note.media?.images.length) hit.images = note.media.images.slice(0, 3);
    if (note.media?.videos.length) hit.videos = note.media.videos.slice(0, 3);
    return hit;
  });
  clearSectionNoteBuffers(secIdxObj, touchedNoteCount);
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
  posts_rule: 5,
  solves_issue: 5,
  shares_menu: 4,
  implements_code: 4,
  bridges_zone: 4,
  has_query: 3,
  exposes_api: 3,
  has_report: 3,
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

const SEE_ALSO_HEADING = /^##\s+(?:ดูต่อที่เกี่ยวข้อง|ดูเพิ่มเติม|ลิงก์ที่เกี่ยวข้อง)(?:\s|$)/;

export function stripSeeAlso(body: string): string {
  const parts = body.split(/\n(?=## )/);
  const kept = parts.filter((p, idx) => idx === 0 || !SEE_ALSO_HEADING.test(p.trimStart()));
  return kept.join("\n").replace(/\n---\s*$/, "").trimEnd();
}

export function getNoteTldr(n: Note): string {
  if (n.tldr) return n.tldr;
  n.cleanBody ??= stripSeeAlso(n.body);
  n.tldr = buildNoteTldr(n.title, n.cleanBody);
  return n.tldr;
}

export function getNoteFacts(n: Note): string[] {
  if (n.facts) return n.facts;
  n.cleanBody ??= stripSeeAlso(n.body);
  n.facts = extractNoteFacts(n);
  return n.facts;
}

// Fast block-aware excerpt using pre-split & pre-normalized note sections (never slices mid-table row, mid-list step, or mid-code-fence)
export function excerptNote(
  n: Note,
  ts: string[],
  budget: number,
  stripFooter = true,
  trimOpts?: TrimBlockOptions,
): string {
  if (!stripFooter) return excerpt(n.body, ts, budget, false, trimOpts);
  const clean = n.cleanBody ?? (n.cleanBody = stripSeeAlso(n.body));
  const fitsToken = trimOpts?.maxTokens === undefined || estimateTokens(clean) <= trimOpts.maxTokens;
  if (clean.length <= budget && fitsToken) return clean;
  const secs = n.sections ?? (n.sections = splitPrecomputedSections(clean));
  const hits = new Int32Array(secs.length);
  for (let si = 0; si < secs.length; si++) {
    const np = secs[si].norm;
    let h = 0;
    for (let i = 0; i < ts.length; i++) {
      const w = /^[1-9]\d{3}$|^[1-9](?:\.\d+){1,3}$/.test(ts[i]) ? 20 : 1;
      h += count(np, ts[i]) * w;
    }
    hits[si] = h;
  }
  const keep = new Set([0]);
  let used = secs[0]?.raw.length ?? 0;
  const order = Array.from({ length: Math.max(0, secs.length - 1) }, (_, k) => k + 1).sort((a, b) => hits[b] - hits[a]);
  for (const i of order) {
    if (used + secs[i].raw.length <= budget) {
      keep.add(i);
      used += secs[i].raw.length;
    }
  }
  // If intro alone left room for part of the top matching section, include it and let trimBlockAware trim cleanly at block boundaries
  if (keep.size === 1 && order.length > 0 && hits[order[0]] > 0 && budget - used >= 160) {
    keep.add(order[0]);
  }
  const omitted: string[] = [];
  const keptRaw: string[] = [];
  for (let i = 0; i < secs.length; i++) {
    if (keep.has(i)) keptRaw.push(secs[i].raw);
    else if (secs[i].heading) omitted.push(secs[i].heading);
  }
  const out = keptRaw.join("\n");
  const trimmed = trimBlockAware(out, budget, trimOpts);
  let cut = trimmed.text;
  if (trimmed.truncated) {
    const lastLine = cut.slice(cut.lastIndexOf("\n") + 1).trim();
    const endsAtomicLine = lastLine.endsWith("```") || lastLine.startsWith("|") || lastLine.endsWith("|");
    cut = endsAtomicLine ? `${cut}\n…` : `${cut} …`;
  }
  return `${cut}\n\n[excerpt — ${omitted.length ? `omitted sections: ${omitted.slice(0, 6).join(" | ")}${omitted.length > 6 ? " …" : ""}. ` : ""}read_note for the full note]`;
}

// Pre-gzipped full vault pack (~670 KB) for Local Stdio MCP / Mirror sync (ETag-cached)
export function getVaultPackGzip(): { gz: Buffer; etag: string; noteCount: number; rawBytes: number } {
  const b = getBundle();
  if (b.vaultPackGzip) return b.vaultPackGzip;
  const entries = readRawVaultEntries();
  const payload = JSON.stringify({
    version: "2.3.0",
    syncCommit,
    updatedAt,
    noteCount: entries.length,
    notes: entries.map((e) => ({ slug: e.slug, folder: e.folder, raw: e.text })),
  });
  const rawBuf = Buffer.from(payload, "utf8");
  const gz = zlib.gzipSync(rawBuf, { level: 6 });
  const hash = crypto.createHash("sha256").update(gz).digest("hex").slice(0, 16);
  const etag = `"bcbrain-${syncCommit || "local"}-${hash}"`;
  b.vaultPackGzip = { gz, etag, noteCount: entries.length, rawBytes: rawBuf.length };
  return b.vaultPackGzip;
}

// Compact Context-Caching Bootstrap Pack for bots (Call Center / Voice / LINE OA / Dev IDE) -> 0ms basic answers
export function getBootstrapPack(audience: "user" | "dev"): { text: string; etag: string; chars: number } {
  const b = getBundle();
  const cached = b.bootstrapPacks.get(audience);
  if (cached) return cached;

  const idx = getDirectIndex(b);
  const lines: string[] = [];
  if (audience === "user") {
    lines.push(
      `# BC Brain Bootstrap Pack (User / Call Center / Voice / LINE OA)`,
      `updated: ${updatedAt}${syncCommit ? ` · source bcaiaccount@${syncCommit}` : ""} · 735 screens (1001–9070)`,
      `กฎตอบลูกค้า: ภาษาไทยเข้าใจง่ายเป็นขั้นตอน ระบุชื่อเมนู+รหัส 4 หลัก ห้ามพูดชื่อตาราง SQL/โค้ด หากเกินข้อมูลให้เรียก quick_answer(audience:"user") หรือ lookup_menu`,
      "",
      "## รหัสเมนูยอดฮิต (Hot 4-Digit Menu Codes)",
    );
    const hotCodes = [
      "1002", "1003", "1004", "1005", "1015", "1097", "1098",
      "2001", "2007", "2020", "2034", "2050",
      "3001", "3003", "3009", "3011", "3014", "3021", "3026",
      "4001", "4005", "4011", "4013", "4014", "4017", "4026",
      "5001", "5012", "5023",
      "6001", "6012", "6023", "6024", "6032",
      "7001", "7006", "7009", "7036", "7037",
      "8001", "9001", "9006", "9029",
    ];
    for (const c of hotCodes) {
      const m = idx.menuByCode.get(c);
      if (m) lines.push(`- **${m.code}** ${m.name} (${m.menuPath})`);
    }
    const coreSlugs = [
      "sales-pricing-packages",
      "sales-support-implementation-contact",
      "start-first-day",
      "ts-common-period-closed",
      "ts-stock-negative-control",
      "ts-stock-cost-mismatch-rebuild",
      "ts-arap-balance-recalc",
      "ts-menu-missing-switchboard",
      "howto-sale-invoice",
      "howto-buy-invoice",
      "howto-ar-receipt-fifo",
      "howto-cheque-received",
      "howto-tax-vat-input-output",
      "howto-gl-period-open-close",
      "faq-stock-cost",
    ];
    lines.push("", "## สรุปสั้นหัวข้อหลัก (TL;DR)");
    for (const slug of coreSlugs) {
      const n = b.notes.get(slug);
      if (!n || n.audience === "dev") continue;
      lines.push(`### ${n.title} [${n.slug}]`, getNoteTldr(n), "");
    }
    lines.push("สื่อทางการ: https://bcaccount.com · YouTube Playlist: https://www.youtube.com/playlist?list=PLO9P7tPZLXB0 · ใบเสนอราคา: https://bcaccount.com/quotation · LINE @bcaccount · โทร 089-922-3131");
  } else {
    lines.push(
      `# BC Brain Bootstrap Pack (Developer / SQL / Schema / API)`,
      `updated: ${updatedAt}${syncCommit ? ` · source bcaiaccount@${syncCommit}` : ""}`,
      `กฎเหล็ก: PostgreSQL NUMERIC (ห้าม float/double), กรอง COALESCE(last_status, 0) = 0 เสมอ, ตาราง ic_trans_detail ต้องกรอง trans_flag + COALESCE(is_doc_copy,0)=0 + notpos, เขียนเอกสารผ่าน /process/* เท่านั้น (WritePolicy บล็อก /query/exec บนตารางเงิน/สต็อก)`,
      "",
      "## ตารางหลัก (Core SQL Tables — เรียก lookup_menu หรือ batch_read เมื่อต้องการรายละเอียด)",
    );
    const hotTables = [
      "ic_trans", "ic_trans_detail", "ic_inventory", "ic_unit_use", "ic_warehouse", "ic_shelf", "ic_bom_header",
      "ar_customer", "ap_supplier", "ap_ar_trans", "ap_ar_trans_detail",
      "cb_trans", "cb_trans_detail", "cb_chq_list",
      "gl_journal", "gl_journal_detail", "gl_chart_of_account", "gl_vat_list", "gl_wht_list",
      "erp_option", "erp_doc_format", "erp_user",
    ];
    for (const t of hotTables) {
      const entry = idx.tableByName.get(t);
      if (entry) lines.push(`- \`${entry.table}\` → \`${entry.schemaSlug}\` (${entry.schemaTitle})`);
    }
    const coreDevSlugs = [
      "dev-rules-accounting-sql",
      "doctypes-overview",
      "api-overview",
      "api-process-engine",
      "api-query-gateway",
      "arch-overview",
    ];
    lines.push("", "## สรุปสั้นสถาปัตยกรรมและกฎกลาง (TL;DR)");
    for (const slug of coreDevSlugs) {
      const n = b.notes.get(slug);
      if (!n) continue;
      lines.push(`### ${n.title} [${n.slug}]`, getNoteTldr(n), "");
    }
  }

  const text = lines.join("\n").trim();
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  const pack = { text, etag: `"bcpack-${audience}-${syncCommit || "local"}-${hash}"`, chars: text.length };
  b.bootstrapPacks.set(audience, pack);
  return pack;
}

// long notes for ask_brain / quick_answer: intro plus matching "## " sections within budget, block-aware trimming (never slices mid-table/list/code)
export function excerpt(
  body: string,
  ts: string[],
  budget: number,
  stripFooter = false,
  trimOpts?: TrimBlockOptions,
): string {
  const source = stripFooter ? stripSeeAlso(body) : body;
  const fitsToken = trimOpts?.maxTokens === undefined || estimateTokens(source) <= trimOpts.maxTokens;
  if (source.length <= budget && fitsToken) return source;
  const parts = source.split(/\n(?=## )/);
  const hits = parts.map((p) => {
    const np = normalizeText(p);
    let h = 0;
    for (let i = 0; i < ts.length; i++) {
      const w = /^[1-9]\d{3}$|^[1-9](?:\.\d+){1,3}$/.test(ts[i]) ? 20 : 1;
      h += count(np, ts[i]) * w;
    }
    return h;
  });
  const keep = new Set([0]);
  let used = parts[0].length;
  const order = parts.map((_, i) => i).slice(1).sort((a, b) => hits[b] - hits[a]);
  for (const i of order) {
    if (used + parts[i].length <= budget) keep.add(i), (used += parts[i].length);
  }
  if (keep.size === 1 && order.length > 0 && hits[order[0]] > 0 && budget - used >= 160) {
    keep.add(order[0]);
  }
  const omitted = parts.filter((_, i) => !keep.has(i)).map((p) => p.split("\n")[0].replace(/^#+\s*/, ""));
  const out = parts.filter((_, i) => keep.has(i)).join("\n");
  const trimmed = trimBlockAware(out, budget, trimOpts);
  let cut = trimmed.text;
  if (trimmed.truncated) {
    const lastLine = cut.slice(cut.lastIndexOf("\n") + 1).trim();
    const endsAtomicLine = lastLine.endsWith("```") || lastLine.startsWith("|") || lastLine.endsWith("|");
    cut = endsAtomicLine ? `${cut}\n…` : `${cut} …`;
  }
  return `${cut}\n\n[excerpt — ${omitted.length ? `omitted sections: ${omitted.slice(0, 6).join(" | ")}${omitted.length > 6 ? " …" : ""}. ` : ""}read_note for the full note]`;
}

// ---------- O(1) Error-Message Lookup Index & Temporal Recency Metadata ----------
function getErrorIndex(b: VaultBundle): ErrorIndex {
  if (b.errorIndex) return b.errorIndex;
  b.errorIndex = buildErrorIndex([...b.notes.values()], tokenizeNormalized, normalizeText);
  return b.errorIndex;
}

export function lookupError(query: string, audience: AudienceFilter = "all", limit = 5): ErrorLookupEntry[] {
  const idx = getErrorIndex(getBundle());
  return queryErrorIndex(idx, query, audience, limit, tokenizeNormalized, normalizeText);
}

export function getErrorCatalog(audience: AudienceFilter = "all"): ErrorLookupEntry[] {
  const idx = getErrorIndex(getBundle());
  return idx.entries.filter((e) => matchesAudience(e.audience, audience));
}

function ensureRecency(b: VaultBundle): Map<string, NoteRecencyMeta> {
  if (b.recencyMap) return b.recencyMap;
  const map = extractVaultRecencyMap(VAULT_DIR, b.notes.values(), syncCommit, b.builtAt);
  for (const [slug, meta] of map) {
    const n = b.notes.get(slug);
    if (n) {
      n.updatedAt = meta.updatedAt;
      n.updatedTs = meta.updatedTs;
      n.lastCommit = meta.lastCommit;
    }
  }
  b.recencyMap = map;
  return map;
}

export function getWhatsNew(days = 7, audience: AudienceFilter = "all", limit = 20): NoteRecency[] {
  const b = getBundle();
  const map = ensureRecency(b);
  const maxItems = Math.min(100, Math.max(1, limit));
  const cutoff = Date.now() - Math.max(0, days) * 86_400_000;
  const rows: NoteRecency[] = [];
  for (const n of b.notes.values()) {
    if (!matchesAudience(n.audience, audience)) continue;
    const meta = map.get(n.slug);
    if (!meta || meta.updatedTs < cutoff) continue;
    rows.push({
      slug: n.slug,
      title: n.title,
      folder: n.folder,
      audience: n.audience,
      updatedAt: meta.updatedAt,
      updatedTs: meta.updatedTs,
      lastCommit: meta.lastCommit,
      tldr: getNoteTldr(n),
    });
  }
  rows.sort((a, c) => c.updatedTs - a.updatedTs || a.slug.localeCompare(c.slug));
  return rows.slice(0, maxItems);
}

// ---------- O(1) Direct Menu Code (1001–9070) & SQL Table Lookup Index ----------
const MENU_ROW_RE =
  /^\|\s*\*\*(\d{4})\*\*\s*\|\s*(?:\*\*)?([^|*\n]+?)(?:\*\*)?\s*\|\s*\*\*([^*\n]+)\*\*(?:<br>([^|\n]+))?\s*\|\s*([^|\n]+?)\s*\|$/gm;
const MENU_REF_RE = /(?:รหัสเมนู|เมนู|menu)\s*\*{0,2}`?([1-9]\d{3})`?\*{0,2}|\*\*([1-9]\d{3})\*\*/gi;

function getDirectIndex(b: VaultBundle): DirectIndex {
  if (b.directIndex) return b.directIndex;
  const menuByCode = new Map<string, MenuLookupEntry>();
  const menuByLegacy = new Map<string, MenuLookupEntry>();
  const menus: MenuLookupEntry[] = [];
  const menuNoteRefs = new Map<string, Set<string>>();

  // Collect menu-code citations across non-catalog notes so lookup_menu links directly to howto/troubleshoot/dev notes
  for (const n of b.notes.values()) {
    if (n.slug.startsWith("menu-cat-") || n.slug === "menu-catalog-overview" || n.slug === "index") continue;
    for (const m of n.body.matchAll(MENU_REF_RE)) {
      const code = m[1] || m[2];
      if (!code) continue;
      const num = Number(code);
      if ((num >= 2015 && num <= 2035) || (num >= 2555 && num <= 2585)) continue;
      let s = menuNoteRefs.get(code);
      if (!s) {
        s = new Set();
        menuNoteRefs.set(code, s);
      }
      s.add(n.slug);
    }
  }

  for (const n of b.notes.values()) {
    if (!n.slug.startsWith("menu-cat-")) continue;
    for (const m of n.body.matchAll(MENU_ROW_RE)) {
      const code = m[1].trim();
      if (menuByCode.has(code)) continue;
      const legacyCode = m[2].trim();
      const name = m[3].trim();
      const menuPath = (m[4] ?? "").trim() || name;
      const edition = m[5].trim();
      const refs = [...(menuNoteRefs.get(code) ?? [])].sort((a, z) => {
        const na = b.notes.get(a);
        const nz = b.notes.get(z);
        const pa = na?.folder === "howto" ? 0 : na?.folder === "start" ? 1 : na?.folder === "troubleshoot" ? 2 : 3;
        const pz = nz?.folder === "howto" ? 0 : nz?.folder === "start" ? 1 : nz?.folder === "troubleshoot" ? 2 : 3;
        return pa - pz || a.localeCompare(z);
      });
      const entry: MenuLookupEntry = {
        code,
        legacyCode,
        name,
        menuPath,
        edition,
        catalogSlug: n.slug,
        relatedSlugs: refs.slice(0, 6),
        haystack: normalizeText(`${code} ${legacyCode} ${name} ${menuPath}`),
      };
      menuByCode.set(code, entry);
      if (legacyCode && /^\d+(?:\.\d+)+$/.test(legacyCode) && !menuByLegacy.has(legacyCode)) {
        menuByLegacy.set(legacyCode, entry);
      }
      menus.push(entry);
    }
  }
  menus.sort((a, z) => a.code.localeCompare(z.code));

  const tableByName = new Map<string, TableLookupEntry>();
  const tables: TableLookupEntry[] = [];
  for (const n of b.notes.values()) {
    if (n.folder !== "schema") continue;
    const candidates = new Set<string>();
    const fromSlug = n.slug.replace(/^tbl-/, "").replace(/-/g, "_");
    if (TABLE_IDENT.test(fromSlug)) candidates.add(fromSlug);
    for (const a of n.aliases) {
      const low = a.trim().toLowerCase();
      if (TABLE_IDENT.test(low)) candidates.add(low);
    }
    for (const m of n.title.matchAll(BODY_IDENT)) {
      candidates.add(m[0].toLowerCase());
    }
    const related = [
      ...new Set([
        ...n.inEdges.filter((e) => b.notes.get(e.slug)?.audience === "dev").map((e) => e.slug),
        ...n.outEdges.filter((e) => b.notes.get(e.slug)?.audience === "dev").map((e) => e.slug),
      ]),
    ].slice(0, 6);
    for (const tbl of candidates) {
      if (tableByName.has(tbl)) continue;
      const entry: TableLookupEntry = {
        table: tbl,
        schemaSlug: n.slug,
        schemaTitle: n.title,
        relatedSlugs: related,
      };
      tableByName.set(tbl, entry);
      tables.push(entry);
    }
  }
  tables.sort((a, z) => a.table.localeCompare(z.table));

  b.directIndex = { menuByCode, menuByLegacy, menus, tableByName, tables };
  return b.directIndex;
}

export function lookupDirect(query: string, filter: AudienceFilter = "all", limit = 6): DirectLookupResult {
  const b = getBundle();
  const idx = getDirectIndex(b);
  const maxItems = Math.min(15, Math.max(1, limit));
  const raw = query.trim();
  const norm = normalizeText(raw);
  if (!norm) return { kind: "none", menus: [], tables: [] };

  const hydrateMenu = (m: MenuLookupEntry) => {
    const docs = m.relatedSlugs
      .map((s) => b.notes.get(s))
      .filter((n): n is Note => Boolean(n && matchesAudience(n.audience, filter)))
      .slice(0, 4)
      .map((n) => ({ slug: n.slug, title: n.title, folder: n.folder, audience: n.audience }));
    return {
      code: m.code,
      legacyCode: m.legacyCode,
      name: m.name,
      menuPath: m.menuPath,
      edition: m.edition,
      catalogSlug: m.catalogSlug,
      relatedSlugs: docs.map((d) => d.slug),
      docs,
    };
  };

  const hydrateTable = (t: TableLookupEntry) => {
    const docs = t.relatedSlugs
      .map((s) => b.notes.get(s))
      .filter((n): n is Note => Boolean(n && matchesAudience(n.audience, filter)))
      .slice(0, 4)
      .map((n) => ({ slug: n.slug, title: n.title, folder: n.folder }));
    return { ...t, docs };
  };

  const foundMenus: MenuLookupEntry[] = [];
  const seenMenu = new Set<string>();
  const addMenu = (m?: MenuLookupEntry) => {
    if (!m || seenMenu.has(m.code)) return;
    seenMenu.add(m.code);
    foundMenus.push(m);
  };

  const foundTables: TableLookupEntry[] = [];
  const seenTable = new Set<string>();
  const addTable = (t?: TableLookupEntry) => {
    if (!t || seenTable.has(t.table)) return;
    seenTable.add(t.table);
    foundTables.push(t);
  };

  // 1. O(1) exact 4-digit menu codes & legacy dotted codes (e.g. "4013", "เมนู 1005", "4.13")
  for (const m of raw.matchAll(/\b([1-9]\d{3})\b/g)) addMenu(idx.menuByCode.get(m[1]));
  for (const m of raw.matchAll(/\b([1-9](?:\.\d+){1,3})\b/g)) addMenu(idx.menuByLegacy.get(m[1]));

  // 2. O(1) exact SQL table lookup (dev / all only — strictly hidden from user zone)
  if (filter !== "user") {
    for (const m of norm.matchAll(BODY_IDENT)) {
      addTable(idx.tableByName.get(m[0]));
    }
    if (!foundTables.length && norm.includes("_")) {
      for (const t of idx.tables) {
        if (t.table.includes(norm)) {
          addTable(t);
          if (foundTables.length >= maxItems) break;
        }
      }
    }
  }

  // 3. Fast in-memory scan over 735 menu names/paths when query has Thai/English words
  if (foundMenus.length < maxItems && (filter !== "dev" || foundTables.length === 0)) {
    const qTerms = terms(raw).filter((t) => !/^(?:เมนู|รหัส|รหัสเมนู|menu|หน้าจอ|เข้า|ตาราง|table)$/.test(t));
    if (qTerms.length) {
      const scored: { entry: MenuLookupEntry; score: number }[] = [];
      for (const m of idx.menus) {
        if (seenMenu.has(m.code)) continue;
        let hitCount = 0;
        let score = 0;
        if (m.haystack.includes(norm)) score += 30;
        const nameNorm = normalizeText(m.name);
        if (nameNorm === norm) score += 60;
        else if (nameNorm.includes(norm)) score += 25;
        for (const qt of qTerms) {
          if (nameNorm.includes(qt)) {
            hitCount++;
            score += 10;
          } else if (m.haystack.includes(qt)) {
            hitCount++;
            score += 4;
          }
        }
        if (hitCount > 0 && (hitCount === qTerms.length || score >= 14)) {
          scored.push({ entry: m, score: score + (hitCount === qTerms.length ? 15 : 0) });
        }
      }
      scored.sort((a, z) => z.score - a.score || a.entry.code.localeCompare(z.entry.code));
      for (const s of scored) {
        addMenu(s.entry);
        if (foundMenus.length >= maxItems) break;
      }
    }
  }

  // 4. Dev table prefix/keyword fallback when user asked for table in dev mode
  if (filter !== "user" && foundTables.length < maxItems && !foundMenus.length) {
    const qTerms = terms(raw);
    for (const t of idx.tables) {
      if (seenTable.has(t.table)) continue;
      const titleNorm = normalizeText(`${t.table} ${t.schemaTitle}`);
      if (qTerms.length && qTerms.every((qt) => titleNorm.includes(qt))) {
        addTable(t);
        if (foundTables.length >= maxItems) break;
      }
    }
  }

  const menusOut = filter === "dev" && foundTables.length > 0 ? [] : foundMenus.slice(0, maxItems).map(hydrateMenu);
  const tablesOut = filter === "user" ? [] : foundTables.slice(0, maxItems).map(hydrateTable);
  const kind =
    menusOut.length && tablesOut.length
      ? "mixed"
      : menusOut.length
        ? "menu"
        : tablesOut.length
          ? "table"
          : "none";
  return { kind, menus: menusOut, tables: tablesOut };
}

// ---------- Media Graph Aggregation & Lookup for MCP AI Agents ----------
const BROAD_MEDIA_HUBS = new Set(["index", "video-visual-tutorials", "website-manual-and-blog-directory"]);

export function collectRelatedMedia(
  seedSlugs: string[],
  filter: AudienceFilter = "all",
  maxImages = 5,
  maxVideos = 5,
  maxPages = 5,
): NoteMedia {
  const all = vault();
  const images: ImageMedia[] = [];
  const videos: VideoMedia[] = [];
  const webPages: WebPageLink[] = [];
  const seenImg = new Set<string>();
  const seenVid = new Set<string>();
  const seenWeb = new Set<string>();

  const pushFromNote = (n: Note) => {
    const m = n.media;
    if (!m) return;
    for (const img of m.images) {
      if (images.length >= maxImages || seenImg.has(img.url)) continue;
      seenImg.add(img.url);
      images.push(img);
    }
    for (const vid of m.videos) {
      if (videos.length >= maxVideos || seenVid.has(vid.url)) continue;
      seenVid.add(vid.url);
      videos.push(vid);
    }
    for (const wp of m.webPages) {
      if (webPages.length >= maxPages || seenWeb.has(wp.url)) continue;
      seenWeb.add(wp.url);
      webPages.push(wp);
    }
  };

  for (const s of seedSlugs) {
    const n = all.get(s);
    if (n && matchesAudience(n.audience, filter)) pushFromNote(n);
  }

  // If direct hits lacked either images or videos, hop 1 step to focused topic neighbors (skipping broad directory hubs so media stays on-topic)
  if (images.length === 0 || videos.length === 0) {
    const visited = new Set<string>(seedSlugs);
    for (const s of seedSlugs) {
      const seed = all.get(s);
      if (!seed || !matchesAudience(seed.audience, filter)) continue;
      for (const e of edgeListFor(seed, "both")) {
        if (visited.has(e.slug) || BROAD_MEDIA_HUBS.has(e.slug)) continue;
        visited.add(e.slug);
        const nb = all.get(e.slug);
        if (!nb || !matchesAudience(nb.audience, filter)) continue;
        pushFromNote(nb);
        if (images.length >= maxImages && videos.length >= maxVideos) break;
      }
    }
  }

  return { images, videos, webPages };
}

export function findMedia(opts: {
  query?: string;
  kind?: "all" | "image" | "youtube" | "webpage";
  audience?: AudienceFilter;
  limit?: number;
}): { items: MediaItem[]; matchedNotes: { slug: string; title: string; folder: string }[] } {
  const filter = opts.audience ?? "user";
  const kind = opts.kind ?? "all";
  const maxLimit = Math.min(40, Math.max(1, opts.limit ?? 12));
  const q = opts.query?.trim() ?? "";
  const all = vault();

  const candidateNotes: Note[] = [];
  if (q && q !== "*") {
    const hits = search(q, 10, filter);
    const seenSlugs = new Set<string>();
    for (const h of hits) {
      const n = all.get(h.slug);
      if (n) {
        candidateNotes.push(n);
        seenSlugs.add(n.slug);
      }
    }
    // Also append focused 1-hop neighbors so queries hitting a sub-note still surface its module's screenshot & YouTube video
    for (const h of hits.slice(0, 4)) {
      const seed = all.get(h.slug);
      if (!seed) continue;
      for (const e of edgeListFor(seed, "both")) {
        if (seenSlugs.has(e.slug) || BROAD_MEDIA_HUBS.has(e.slug)) continue;
        const nb = all.get(e.slug);
        if (nb && matchesAudience(nb.audience, filter)) {
          seenSlugs.add(nb.slug);
          candidateNotes.push(nb);
        }
      }
    }
  } else {
    // Full catalog scan: prioritize video-visual-tutorials & website-manual-and-blog-directory first
    for (const hubSlug of ["video-visual-tutorials", "website-manual-and-blog-directory"]) {
      const hn = all.get(hubSlug);
      if (hn && matchesAudience(hn.audience, filter)) candidateNotes.push(hn);
    }
    for (const n of all.values()) {
      if (matchesAudience(n.audience, filter) && !BROAD_MEDIA_HUBS.has(n.slug)) candidateNotes.push(n);
    }
  }

  const items: MediaItem[] = [];
  const seenUrl = new Set<string>();
  const usedNotes = new Map<string, { slug: string; title: string; folder: string }>();

  for (const n of candidateNotes) {
    const m = n.media;
    if (!m) continue;
    if (kind === "all" || kind === "youtube") {
      for (const v of m.videos) {
        if (items.length >= maxLimit) break;
        if (seenUrl.has(v.url)) continue;
        seenUrl.add(v.url);
        items.push({
          kind: "youtube",
          title: v.title,
          url: v.url,
          videoId: v.videoId,
          listId: v.listId,
          thumbnailUrl: v.thumbnailUrl,
          embedUrl: v.embedUrl,
          noteSlug: n.slug,
          noteTitle: n.title,
        });
        usedNotes.set(n.slug, { slug: n.slug, title: n.title, folder: n.folder });
      }
    }
    if (kind === "all" || kind === "image") {
      for (const img of m.images) {
        if (items.length >= maxLimit) break;
        if (seenUrl.has(img.url)) continue;
        seenUrl.add(img.url);
        items.push({
          kind: "image",
          title: img.alt,
          url: img.url,
          noteSlug: n.slug,
          noteTitle: n.title,
        });
        usedNotes.set(n.slug, { slug: n.slug, title: n.title, folder: n.folder });
      }
    }
    if (kind === "all" || kind === "webpage") {
      for (const wp of m.webPages) {
        if (items.length >= maxLimit) break;
        if (seenUrl.has(wp.url)) continue;
        seenUrl.add(wp.url);
        items.push({
          kind: "webpage",
          title: wp.title,
          url: wp.url,
          noteSlug: n.slug,
          noteTitle: n.title,
        });
        usedNotes.set(n.slug, { slug: n.slug, title: n.title, folder: n.folder });
      }
    }
    if (items.length >= maxLimit) break;
  }

  return { items, matchedNotes: [...usedNotes.values()] };
}

// ---------- render (with www.bcaccount.com image connector & YouTube video/playlist connector) ----------
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function renderYouTubeCard(yt: NonNullable<ReturnType<typeof parseYouTubeUrl>>, label: string): string {
  const safeTitle = escapeHtml(label.replace(/^(?:🎬|▶)\s*/, "").trim() || "วิดีโอสอนใช้งาน BC Ai Account");
  const bgStyle = yt.videoId
    ? ` style="background:#070514 url('https://i.ytimg.com/vi/${escapeHtml(yt.videoId)}/hqdefault.jpg') center/cover no-repeat"`
    : "";
  const playlistLink = yt.listId
    ? `<a href="https://www.youtube.com/playlist?list=${escapeHtml(yt.listId)}" target="_blank" rel="noopener noreferrer">เพลย์ลิสต์เต็ม ↗</a>`
    : "";
  return `<div class="yt-card"><div class="yt-frame"${bgStyle}><iframe src="${escapeHtml(yt.embedUrl)}" title="${safeTitle}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div><div class="yt-bar"><span class="yt-badge">▶ YouTube</span><span class="yt-title" title="${safeTitle}">${safeTitle}</span><span class="yt-links"><a href="${escapeHtml(yt.watchUrl)}" target="_blank" rel="noopener noreferrer">ดูบน YouTube ↗</a>${playlistLink}</span></div></div>`;
}

marked.use({
  gfm: true,
  // raw HTML in notes is shown, never executed; HTML comments (e.g. secret-scan pragmas) are dropped
  renderer: {
    html: ({ text }) => (/^\s*<!--[\s\S]*-->\s*$/.test(text) ? "" : escapeHtml(text)),
    image({ href, title, text }) {
      const resolved = resolveBcImageUrl(href ?? "");
      const safeAlt = escapeHtml(text || title || "ภาพประกอบหน้าจอ BC Ai Account");
      if (!resolved) return `<span class="muted">[ภาพประกอบ: ${safeAlt}]</span>`;
      const safeSrc = escapeHtml(resolved);
      const isBcSite = /^https:\/\/bcaccount\.com\//i.test(resolved);
      const sourceBadge = isBcSite
        ? `<a href="${safeSrc}" target="_blank" rel="noopener noreferrer">www.bcaccount.com ↗</a>`
        : `<a href="${safeSrc}" target="_blank" rel="noopener noreferrer">เปิดภาพเต็ม ↗</a>`;
      return `<figure class="md-fig"><a class="md-fig-link" href="${safeSrc}" target="_blank" rel="noopener noreferrer"><img src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async" /></a><figcaption class="md-fig-cap"><span>${safeAlt}</span>${sourceBadge}</figcaption></figure>`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const safeHref = escapeHtml(href ?? "#");
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      if (/^https?:\/\//i.test(href ?? "")) {
        return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return `<a href="${safeHref}"${titleAttr}>${text}</a>`;
    },
    paragraph({ tokens }) {
      if (tokens.length === 1 && tokens[0].type === "link") {
        const lk = tokens[0] as { href?: string; text?: string };
        const yt = lk.href ? parseYouTubeUrl(lk.href) : null;
        if (yt) return renderYouTubeCard(yt, lk.text ?? "");
      }
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },
  },
  walkTokens(t) {
    if ((t.type === "link" || t.type === "image") && /^\s*(javascript|data|vbscript):/i.test(t.href)) t.href = "#";
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
export const syncCommit = (process.env.SYNC_COMMIT ?? "").trim();
export const updatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" })
  .format(new Date(process.env.BUILD_TIME ?? Date.now())) + " น.";

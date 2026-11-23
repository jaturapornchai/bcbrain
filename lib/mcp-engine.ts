import { z } from "zod";
import { matchesAudience, RELATION_LABEL, RELATION_TYPES, type AudienceFilter } from "./groups";
import { emitMcpEvent, type McpEventHit, type McpToolName } from "./mcp-events";
import {
  bundleVersion,
  collectRelatedMedia,
  connectedNeighbors,
  excerptNote,
  findMedia,
  getNote,
  getNoteTldr,
  listVaultRows,
  lookupDirect,
  search,
  searchWithMeta,
  stripSeeAlso,
  syncCommit,
  terms,
  traverseGraph,
  updatedAt,
  vaultFolders,
  warmVaultIndexes,
  type Note,
  type NoteMedia,
} from "./vault";

if (process.env.NODE_ENV === "production") {
  warmVaultIndexes();
}

export const SERVER_INFO = { name: "bcbrain", version: "2.3.0" } as const;
export const DEFAULT_PROTOCOL_VERSION = "2025-03-26";
export const MAX_BODY_BYTES = 32 * 1024;
export const RATE_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 300;
const RATE_MAX_KEYS = 4096;

const INSTRUCTIONS = `BC Brain = ultra-fast dual-audience knowledge base for BC Ai Account & BC suite (sales, purchasing, inventory, AR/AP, cash/bank, assets, GL, VAT/WHT, POS, AutoCare, e-Tax, WMS, TMS, Procure, CRM, LINE OA, Market, Dashboard, MonitorMap, WorkMonitor, Company Brain), verified against real source code.

FASTEST TOOL SELECTION (minimize round-trips & token latency — do NOT pre-read playbooks unless needing full scripts):
1. quick_answer — DEFAULT for real-time Q&A, Call Center, voice/LINE bots, and focused lookups: 1 call (~2k chars normal; pass mode: "ultra" for ~600-char TL;DR ultra-low-latency voice/chat). Set include_media: true for screenshots/YouTube links.
2. batch_ask — Answer 1–5 questions in ONE single call (defaults to mode: "ultra") when user asks compound/multi-part questions.
3. lookup_menu — INSTANT O(1) lookup for 4-digit menu codes (1001–9070), screen names, or SQL table names (ic_trans, gl_journal, etc.).
4. batch_read — Read 1–5 known slugs in ONE call (optional query & max_chars_per_note) instead of sequential read_note loops.
5. ask_brain — Multi-note synthesis with 1-hop graph & aggregated media (use compact: true or max_notes: 2 for speed).

AUDIENCE ISOLATION (MANDATORY):
- Dev (SQL, schema, trans_flag, GL Dr/Cr, API, architecture; optional full guide: playbook-dev): pass audience: "dev" (or "all" for UI+tech). Use exact table/column/trans_flag names, PostgreSQL NUMERIC (no float), and COALESCE(last_status, 0) = 0.
- User / Call Center / Pre-sale (optional full guides: playbook-call-center, playbook-sales): ALWAYS pass audience: "user". Answer in plain Thai step-by-step with NO SQL/code/table names; cite Thai menu path + 4-digit menu code (1001–9070), button names, and ready-to-share bcaccount.com screenshots + YouTube links (PLO9P7tPZLXB0). Missing menus: check 4 editions, Feature Switchboard (1002), and permissions (ts-menu-missing-switchboard). Pricing/partner/support: cite verified notes only (exclude 7% VAT & external AI API costs; https://bcaccount.com/quotation / LINE @bcaccount / 089-922-3131).

GROUNDING: Answer ONLY from verified notes. If abstained (🛑 Abstain) or missing, state clearly without guessing. Never expose secrets or internal slugs to end users.`;

export const FULL_INSTRUCTIONS = `${INSTRUCTIONS}\nKnowledge last updated: ${updatedAt} (Thai time)${syncCommit ? ` · source bcaiaccount@${syncCommit}` : ""}.`;

const AUDIENCE_ENUM = z.enum(["all", "user", "dev"]);
const ANNOTATIONS = { readOnlyHint: true, openWorldHint: false } as const;

export type ToolResult = { content: [{ type: "text"; text: string }]; isError?: boolean };
const textResult = (t: string, isError?: boolean): ToolResult =>
  isError ? { content: [{ type: "text", text: t }], isError: true } : { content: [{ type: "text", text: t }] };

// ---------- Bounded In-Memory LRU Response Cache (invalidated automatically when vault bundle rebuilds) ----------
const CACHE_MAX = 512;
type CachedPayload = {
  text: string;
  hits: McpEventHit[];
  totalHits: number;
  audience: AudienceFilter;
  abstained?: boolean;
  confidence?: "high" | "medium" | "low";
  resultJson: string; // pre-serialized JSON fragment for {"content":[{"type":"text","text":...}]}
};
const responseCache = new Map<string, CachedPayload>();

let logEnabled = true;
export function setMcpLogging(enabled: boolean): void {
  logEnabled = enabled;
}

function runCachedTool(
  tool: McpToolName,
  cacheKey: string,
  rawArg: string,
  compute: () => Omit<CachedPayload, "resultJson">,
): { result: ToolResult; resultJson: string; payload: CachedPayload; ms: number; cached: boolean } {
  const t0 = performance.now();
  const fullKey = `${bundleVersion()}\0${tool}\0${cacheKey}`;
  const hit = responseCache.get(fullKey);
  if (hit) {
    responseCache.delete(fullKey);
    responseCache.set(fullKey, hit);
    const ms = performance.now() - t0;
    if (logEnabled) {
      process.stdout.write(`[mcp] tool=${tool} audience=${hit.audience} hits=${hit.totalHits} ms=${ms.toFixed(1)} cached=1\n`);
    }
    emitMcpEvent({ tool, audience: hit.audience, rawArg, hits: hit.hits, totalHits: hit.totalHits, ms });
    return { result: textResult(hit.text), resultJson: hit.resultJson, payload: hit, ms, cached: true };
  }
  const base = compute();
  const res = textResult(base.text);
  const full: CachedPayload = { ...base, resultJson: JSON.stringify(res) };
  if (responseCache.size >= CACHE_MAX) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(fullKey, full);
  const ms = performance.now() - t0;
  if (logEnabled) {
    process.stdout.write(`[mcp] tool=${tool} audience=${full.audience} hits=${full.totalHits} ms=${ms.toFixed(1)}\n`);
  }
  emitMcpEvent({ tool, audience: full.audience, rawArg, hits: full.hits, totalHits: full.totalHits, ms });
  return { result: res, resultJson: full.resultJson, payload: full, ms, cached: false };
}

// ---------- Formatting Helpers ----------
function formatNoteMediaLines(m?: NoteMedia): string[] {
  if (!m) return [];
  const lines: string[] = [];
  if (m.videos.length) {
    lines.push(
      `youtube_videos: ${m.videos
        .slice(0, 6)
        .map((v) => `${v.title} -> ${v.url}${v.thumbnailUrl ? ` (thumbnail: ${v.thumbnailUrl})` : ""}`)
        .join(" | ")}`,
    );
  }
  if (m.images.length) {
    lines.push(`images: ${m.images.slice(0, 6).map((img) => `${img.alt} -> ${img.url}`).join(" | ")}`);
  }
  if (m.webPages.length) {
    lines.push(`web_pages: ${m.webPages.slice(0, 6).map((wp) => `${wp.title} -> ${wp.url}`).join(" | ")}`);
  }
  return lines;
}

function formatAggregatedMediaBlock(m: NoteMedia): string {
  if (!m.videos.length && !m.images.length && !m.webPages.length) return "";
  const sections: string[] = ["## Media & Reference Links"];
  if (m.videos.length) {
    sections.push(
      "### YouTube (Playlist: https://www.youtube.com/playlist?list=PLO9P7tPZLXB0)\n" +
        m.videos.map((v) => `- 🎬 ${v.title}: ${v.url}`).join("\n"),
    );
  }
  if (m.images.length) {
    sections.push(
      "### Official Screenshots (bcaccount.com)\n" +
        m.images.map((img) => `- 🖼️ ${img.alt}: ${img.url}`).join("\n"),
    );
  }
  if (m.webPages.length) {
    sections.push(
      "### Official Pages (bcaccount.com)\n" +
        m.webPages.map((wp) => `- 🔗 ${wp.title}: ${wp.url}`).join("\n"),
    );
  }
  return `\n\n---\n\n${sections.join("\n\n")}`;
}

function formatInlineMediaLine(m: NoteMedia): string {
  const bits: string[] = [];
  if (m.videos.length) bits.push(`🎬 ${m.videos[0].title}: ${m.videos[0].url}`);
  if (m.images.length) bits.push(`🖼️ ${m.images[0].alt}: ${m.images[0].url}`);
  if (!bits.length && m.webPages.length) bits.push(`🔗 ${m.webPages[0].title}: ${m.webPages[0].url}`);
  return bits.length ? `\nmedia: ${bits.join(" | ")}` : "";
}

function formatCompactEdges(edges: { slug: string; rel: string }[], maxItems?: number): string {
  if (!edges.length) return "-";
  if (!maxItems || edges.length <= maxItems) {
    return edges.map((e) => `[[${e.slug}]] (${e.rel})`).join(" ");
  }
  const head = edges
    .slice(0, maxItems)
    .map((e) => `[[${e.slug}]] (${e.rel})`)
    .join(" ");
  return `${head} (+${edges.length - maxItems} more)`;
}

function noteText(
  n: Note,
  body = n.body,
  opts: { includeSources?: boolean; linkCap?: number; includeMedia?: boolean; includeLinks?: boolean } = {},
): string {
  const mediaLines = opts.includeMedia !== false ? formatNoteMediaLines(n.media) : [];
  const srcLine =
    opts.includeSources && n.audience === "dev" && n.sources.length
      ? [`verified_sources: ${n.sources.slice(0, 6).join(", ")}`]
      : [];
  const linkLines =
    opts.includeLinks !== false
      ? [`links: ${formatCompactEdges(n.outEdges, opts.linkCap)}`, `backlinks: ${formatCompactEdges(n.inEdges, opts.linkCap)}`]
      : [];
  return [
    `# ${n.title}`,
    `slug: ${n.slug} | folder: ${n.folder} | audience: ${n.audience} | tags: ${n.tags.join(", ")}`,
    "",
    body.trim(),
    ...(srcLine.length || mediaLines.length || linkLines.length ? ["", ...srcLine, ...mediaLines, ...linkLines] : []),
  ].join("\n");
}

function buildQuickAnswerPayload(
  question: string,
  filter: AudienceFilter,
  mode: "normal" | "ultra",
  maxChars: number | undefined,
  withMedia: boolean,
): Omit<CachedPayload, "resultJson"> {
  const budget = maxChars ?? (mode === "ultra" ? 700 : 2000);
  const { hits, confidence, totalTerms, bestMatchedTerms, topScore } = searchWithMeta(question, 3, filter);
  if (!hits.length) {
    return {
      text: `🛑 Abstain — No matching notes (audience=${filter}). Do not guess—try lookup_menu or search_brain.`,
      hits: [],
      totalHits: 0,
      audience: filter,
      abstained: true,
      confidence: "low",
    };
  }
  const coverage = bestMatchedTerms / Math.max(1, totalTerms);
  if (confidence === "low" && (coverage < 0.5 || topScore < 18)) {
    const candidates = hits
      .slice(0, 3)
      .map((h) => `- ${h.slug} (${h.folder}) — ${h.title}`)
      .join("\n");
    return {
      text: `🛑 Abstain — Insufficient Grounded Evidence in BC Brain (audience=${filter}, confidence=low, coverage=${bestMatchedTerms}/${totalTerms}, topScore=${topScore}) for: ${question}\n\nDo NOT extrapolate or guess. State clearly that BC Brain has no verified record for this question.\nClosest candidates:\n${candidates}`,
      hits: hits.slice(0, 2).map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
      totalHits: hits.length,
      audience: filter,
      abstained: true,
      confidence: "low",
    };
  }

  if (mode === "ultra") {
    const top = getNote(hits[0].slug)!;
    const ts = terms(question);
    const tldr = getNoteTldr(top);
    const body = tldr.length <= budget ? tldr : excerptNote(top, ts, budget, true);
    const src =
      filter === "dev" && top.audience === "dev" && top.sources.length
        ? `\nverified_sources: ${top.sources.slice(0, 3).join(", ")}`
        : "";
    const mediaLine =
      withMedia && filter !== "dev" ? formatInlineMediaLine(collectRelatedMedia([top.slug], filter, 1, 1, 1)) : "";
    const outText = `[quick_answer:ultra | audience=${filter} | confidence=${confidence} | slug: ${top.slug}]\n# ${top.title}\n${body.trim()}${src}${mediaLine}`;
    return {
      text: outText,
      hits: [{ slug: top.slug, title: top.title, folder: top.folder }],
      totalHits: 1,
      audience: filter,
      abstained: false,
      confidence,
    };
  }

  const useSecond =
    hits.length > 1 &&
    !(confidence === "high" && hits[0].score >= hits[1].score * 1.22) &&
    hits[1].score >= topScore * 0.72;
  const picked = useSecond ? hits.slice(0, 2) : hits.slice(0, 1);
  const ts = terms(question);
  const showDevSources = filter === "dev";
  const caps = picked.length === 1 ? [budget] : [Math.round(budget * 0.65), Math.max(450, Math.round(budget * 0.35))];
  const blocks = picked.map((h, i) => {
    const n = getNote(h.slug)!;
    const body = excerptNote(n, ts, caps[i], true);
    const src =
      showDevSources && n.audience === "dev" && n.sources.length
        ? `\nverified_sources: ${n.sources.slice(0, 4).join(", ")}`
        : "";
    return `# ${n.title}\nslug: ${n.slug} | folder: ${n.folder} | audience: ${n.audience}\n\n${body.trim()}${src}`;
  });
  const mediaLine =
    withMedia && filter !== "dev"
      ? formatInlineMediaLine(
          collectRelatedMedia(
            picked.map((h) => h.slug),
            filter,
            1,
            1,
            1,
          ),
        )
      : "";
  const relatedSlugs = connectedNeighbors(
    picked.map((h) => h.slug),
    filter,
    3,
  ).map((g) => g.slug);
  const relLine = relatedSlugs.length ? `\nrelated: ${relatedSlugs.join(", ")}` : "";
  const outText = `[quick_answer | audience=${filter} | confidence=${confidence} | coverage=${bestMatchedTerms}/${totalTerms}]\n\n${blocks.join("\n\n---\n\n")}${mediaLine}${relLine}`;
  return {
    text: outText,
    hits: picked.map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
    totalHits: picked.length,
    audience: filter,
    abstained: false,
    confidence,
  };
}

// ---------- Pre-Compiled Zod Schemas (constructed ONCE at module load) ----------
const QUICK_ANSWER_SCHEMA = z.object({
  question: z.string().min(2).max(500),
  audience: AUDIENCE_ENUM.optional(),
  mode: z.enum(["normal", "ultra"]).optional(),
  max_chars: z.number().int().min(300).max(4500).optional(),
  include_media: z.boolean().optional(),
});

const BATCH_ASK_SCHEMA = z.object({
  questions: z.array(z.string().min(2).max(300)).min(1).max(5),
  audience: AUDIENCE_ENUM.optional(),
  mode: z.enum(["normal", "ultra"]).optional(),
  max_chars_per_answer: z.number().int().min(300).max(2500).optional(),
  include_media: z.boolean().optional(),
});

const LOOKUP_MENU_SCHEMA = z.object({
  query: z.string().min(1).max(120),
  audience: AUDIENCE_ENUM.optional(),
  limit: z.number().int().min(1).max(15).optional(),
});

const BATCH_READ_SCHEMA = z.object({
  slugs: z.array(z.string().min(1).max(120)).min(1).max(5),
  audience: AUDIENCE_ENUM.optional(),
  query: z.string().max(300).optional(),
  max_chars_per_note: z.number().int().min(500).max(6000).optional(),
  strip_links: z.boolean().optional(),
});

const ASK_SCHEMA = z.object({
  question: z.string().min(2).max(500),
  audience: AUDIENCE_ENUM.optional(),
  compact: z.boolean().optional(),
  max_notes: z.number().int().min(1).max(4).optional(),
});

const SEARCH_SCHEMA = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(20).optional(),
  audience: AUDIENCE_ENUM.optional(),
});

const TRAVERSE_SCHEMA = z.object({
  slug: z.string().min(1).max(120),
  to_slug: z.string().min(1).max(120).optional(),
  depth: z.number().int().min(1).max(3).optional(),
  direction: z.enum(["both", "out", "in"]).optional(),
  relation: z.enum(RELATION_TYPES).optional(),
  folder: z.string().max(40).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  audience: AUDIENCE_ENUM.optional(),
});

const READ_SCHEMA = z.object({
  slug: z.string().min(1).max(120),
  query: z.string().max(300).optional(),
  max_chars: z.number().int().min(500).max(20000).optional(),
});

const LIST_SCHEMA = z.object({
  folder: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
  audience: AUDIENCE_ENUM.optional(),
});

const FIND_MEDIA_SCHEMA = z.object({
  query: z.string().max(300).optional(),
  kind: z.enum(["all", "image", "youtube", "webpage"]).optional(),
  limit: z.number().int().min(1).max(40).optional(),
  audience: AUDIENCE_ENUM.optional(),
});

// ---------- Static MCP Tool Descriptors (JSON Schema draft-07, pre-built ONCE) ----------
const AUDIENCE_JSON_PROP = {
  type: "string",
  enum: ["all", "user", "dev"],
  description: 'Audience zone: "user" (plain Thai guides/sales), "dev" (schema/SQL/API/architecture), or "all" (default).',
};

const FOLDERS_DESC =
  vaultFolders().join(", ") ||
  "root, playbook, start, howto, troubleshoot, faq, reports, systems, glossary, sales, dev-playbook, schema, queries, api, doctypes, architecture";

export const TOOL_DESCRIPTORS = [
  {
    name: "quick_answer",
    title: "Ultra-fast single-shot answer",
    description:
      "FASTEST default tool for real-time Q&A, Call Center, voice/LINE bots, and focused lookups. Returns ~2,000 chars (mode: 'normal') or ~600-char TL;DR (mode: 'ultra') in 1 call with strict anti-hallucination abstention.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        question: { type: "string", minLength: 2, maxLength: 500, description: "Thai or English question." },
        audience: AUDIENCE_JSON_PROP,
        mode: { type: "string", enum: ["normal", "ultra"], description: "'normal' (~2000 chars) or 'ultra' (~600-char TL;DR for voice/LINE bots)." },
        max_chars: { type: "integer", minimum: 300, maximum: 4500, description: "Char budget (default 2000 normal, 700 ultra)." },
        include_media: { type: "boolean", description: "Append 1 compact YouTube/screenshot line (default false for max speed)." },
      },
      required: ["question"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "batch_ask",
    title: "Answer 1–5 questions in one round-trip",
    description:
      "Answer up to 5 independent or compound questions in ONE single MCP call (defaults to mode: 'ultra' for minimal tokens & fastest LLM TTFT). Enforces strict abstention and audience isolation per question.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: { type: "string", minLength: 2, maxLength: 300 },
          minItems: 1,
          maxItems: 5,
          description: "1–5 questions to answer in one call.",
        },
        audience: AUDIENCE_JSON_PROP,
        mode: { type: "string", enum: ["normal", "ultra"], description: "Default 'ultra' (TL;DR) or 'normal'." },
        max_chars_per_answer: { type: "integer", minimum: 300, maximum: 2500, description: "Char cap per answer (default 700 ultra, 1400 normal)." },
        include_media: { type: "boolean", description: "Append compact media line per answer (default false)." },
      },
      required: ["questions"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "lookup_menu",
    title: "Instant O(1) menu code & SQL table lookup",
    description:
      "Instant O(1) lookup for 4-digit BC menu codes (1001–9070), legacy dotted codes (4.13), Thai menu names, or SQL table names (ic_trans, gl_journal, etc. in dev/all mode). Returns exact menu path, edition, and linked slugs in <1ms.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 120, description: "4-digit menu code (e.g. '4013', '1005'), menu name, or SQL table name." },
        audience: AUDIENCE_JSON_PROP,
        limit: { type: "integer", minimum: 1, maximum: 15, description: "Max rows to return (default 6)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "batch_read",
    title: "Read multiple notes in one round-trip",
    description:
      "Read 1–5 notes by slug in ONE single MCP call (eliminates sequential read_note round-trips). Supports query-focused section excerpting, per-note char budget, and strict audience isolation.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        slugs: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 120 },
          minItems: 1,
          maxItems: 5,
          description: "1–5 note slugs to read in parallel.",
        },
        audience: AUDIENCE_JSON_PROP,
        query: { type: "string", maxLength: 300, description: "Optional focus keywords to extract only matching sections." },
        max_chars_per_note: { type: "integer", minimum: 500, maximum: 6000, description: "Char cap per note (default 2000)." },
        strip_links: { type: "boolean", description: "Omit trailing See-Also & links/backlinks footers for speed (default true)." },
      },
      required: ["slugs"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "ask_brain",
    title: "Ask the BC brain",
    description:
      "Multi-note answer (Thai or English) with aggregated media links and 1-hop graph context. Pass audience: 'user' or 'dev' or 'all'. Use compact: true (or quick_answer) for fastest response.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        question: { type: "string", minLength: 2, maxLength: 500 },
        audience: AUDIENCE_JSON_PROP,
        compact: { type: "boolean", description: "Token-saving mode: up to 2 tightly-trimmed notes." },
        max_notes: { type: "integer", minimum: 1, maximum: 4, description: "Max notes (1–4; default 3 high-conf / 2 compact)." },
      },
      required: ["question"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "search_brain",
    title: "Search notes",
    description:
      "Keyword search (Thai word segmentation + SQL table/identifier matching + BM25). Supports audience ('all' | 'user' | 'dev'). Default limit 5 for low latency.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 300 },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "Max hits (default 5)." },
        audience: AUDIENCE_JSON_PROP,
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "traverse_brain",
    title: "Traverse knowledge graph",
    description:
      "Follow typed synapses 1–3 hops from a note (or find the shortest graph path to to_slug). Respects audience isolation ('all' | 'user' | 'dev').",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        slug: { type: "string", minLength: 1, maxLength: 120 },
        to_slug: { type: "string", minLength: 1, maxLength: 120 },
        depth: { type: "integer", minimum: 1, maximum: 3 },
        direction: { type: "string", enum: ["both", "out", "in"] },
        relation: { type: "string", enum: [...RELATION_TYPES] },
        folder: { type: "string", maxLength: 40 },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        audience: AUDIENCE_JSON_PROP,
      },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "read_note",
    title: "Read a note",
    description:
      "Markdown of one note by slug (accepts [[slug]] or slug.md), plus audience, media, and links. Pass optional query/max_chars for focused faster reads.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        slug: { type: "string", minLength: 1, maxLength: 120 },
        query: { type: "string", maxLength: 300, description: "Optional focus terms to excerpt relevant sections only." },
        max_chars: { type: "integer", minimum: 500, maximum: 20000, description: "Optional char budget." },
      },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "list_notes",
    title: "List notes",
    description: `Index of notes (slug, folder, audience, title, tags). Filter by folder (${FOLDERS_DESC}), tag, or audience ('all' | 'user' | 'dev').`,
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        folder: { type: "string", maxLength: 40 },
        tag: { type: "string", maxLength: 40 },
        audience: AUDIENCE_JSON_PROP,
      },
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "find_media",
    title: "Find screenshots, YouTube videos & website links",
    description:
      "Retrieve ready-to-share official screenshot URLs (https://bcaccount.com/...), YouTube tutorial video/playlist URLs (PLO9P7tPZLXB0 with thumbnailUrl and embedUrl), and website reference pages matching a topic or 4-digit menu code.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        query: { type: "string", maxLength: 300, description: "Topic or 4-digit menu code (omit or '*' for canonical media)." },
        kind: { type: "string", enum: ["all", "image", "youtube", "webpage"] },
        limit: { type: "integer", minimum: 1, maximum: 40 },
        audience: AUDIENCE_JSON_PROP,
      },
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
];

// Pre-serialized static JSON fragments for 0-allocation hot methods
const TOOLS_LIST_RESULT_JSON = JSON.stringify({ tools: TOOL_DESCRIPTORS });
const EMPTY_RESOURCES_JSON = '{"resources":[]}';
const EMPTY_PROMPTS_JSON = '{"prompts":[]}';
const EMPTY_OBJ_JSON = "{}";

type ToolRunResult = { result: ToolResult; resultJson: string; payload?: CachedPayload; ms?: number; cached?: boolean };
type ToolEntry = {
  schema: z.ZodTypeAny;
  run: (args: Record<string, unknown>) => ToolRunResult;
};

const TOOL_MAP = new Map<string, ToolEntry>([
  [
    "quick_answer",
    {
      schema: QUICK_ANSWER_SCHEMA,
      run: (raw) => {
        const { question, audience, mode, max_chars, include_media } = raw as z.infer<typeof QUICK_ANSWER_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const m = mode ?? "normal";
        const budget = max_chars ?? (m === "ultra" ? 700 : 2000);
        const withMedia = Boolean(include_media);
        const key = `${filter}|${m}|${budget}|${withMedia ? 1 : 0}|${question.trim()}`;
        return runCachedTool("quick_answer", key, question, () =>
          buildQuickAnswerPayload(question, filter, m, budget, withMedia),
        );
      },
    },
  ],
  [
    "batch_ask",
    {
      schema: BATCH_ASK_SCHEMA,
      run: (raw) => {
        const { questions, audience, mode, max_chars_per_answer, include_media } = raw as z.infer<typeof BATCH_ASK_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const m = mode ?? "ultra";
        const budget = max_chars_per_answer ?? (m === "ultra" ? 700 : 1400);
        const withMedia = Boolean(include_media);
        const normQs = questions.map((q) => q.trim()).filter(Boolean);
        const key = `${filter}|${m}|${budget}|${withMedia ? 1 : 0}|${normQs.join(" || ")}`;
        return runCachedTool("batch_ask", key, normQs.join(" | "), () => {
          const allHits: McpEventHit[] = [];
          const seen = new Set<string>();
          const blocks = normQs.map((q, idx) => {
            const sub = buildQuickAnswerPayload(q, filter, m, budget, withMedia);
            for (const h of sub.hits) {
              if (!seen.has(h.slug) && allHits.length < 6) {
                seen.add(h.slug);
                allHits.push(h);
              }
            }
            return `## Q${idx + 1}: ${q}\n${sub.text}`;
          });
          return {
            text: `[batch_ask | count=${normQs.length} | audience=${filter} | mode=${m}]\n\n${blocks.join("\n\n---\n\n")}`,
            hits: allHits,
            totalHits: allHits.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "lookup_menu",
    {
      schema: LOOKUP_MENU_SCHEMA,
      run: (raw) => {
        const { query, audience, limit } = raw as z.infer<typeof LOOKUP_MENU_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const maxItems = limit ?? 6;
        const key = `${filter}|${maxItems}|${query.trim()}`;
        return runCachedTool("lookup_menu", key, query, () => {
          const res = lookupDirect(query, filter, maxItems);
          if (res.kind === "none") {
            return {
              text: `No direct menu code or SQL table match for "${query}" (audience=${filter}). Try quick_answer or search_brain.`,
              hits: [],
              totalHits: 0,
              audience: filter,
            };
          }
          const lines: string[] = [];
          const eventHits: McpEventHit[] = [];
          if (res.menus.length) {
            lines.push(`## Menus (${res.menus.length})`);
            for (const m of res.menus) {
              const docList = m.docs.length ? ` | docs: ${m.docs.map((d) => d.slug).join(", ")}` : ` | catalog: ${m.catalogSlug}`;
              lines.push(
                `- **${m.code}**${m.legacyCode && m.legacyCode !== "—" ? ` (${m.legacyCode})` : ""} **${m.name}** — ${m.menuPath} · ${m.edition}${docList}`,
              );
              if (eventHits.length < 6) {
                const topDoc = m.docs[0];
                eventHits.push(
                  topDoc
                    ? { slug: topDoc.slug, title: topDoc.title, folder: topDoc.folder }
                    : { slug: m.catalogSlug, title: `${m.code} ${m.name}`, folder: "start" },
                );
              }
            }
          }
          if (res.tables.length) {
            lines.push(`## SQL Tables (${res.tables.length})`);
            for (const t of res.tables) {
              const rel = t.docs.length ? ` | related: ${t.docs.map((d) => d.slug).join(", ")}` : "";
              lines.push(`- \`${t.table}\` → schema: \`${t.schemaSlug}\` (${t.schemaTitle})${rel}`);
              if (eventHits.length < 6) {
                eventHits.push({ slug: t.schemaSlug, title: t.schemaTitle, folder: "schema" });
              }
            }
          }
          return {
            text: lines.join("\n"),
            hits: eventHits,
            totalHits: res.menus.length + res.tables.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "batch_read",
    {
      schema: BATCH_READ_SCHEMA,
      run: (raw) => {
        const { slugs, audience, query, max_chars_per_note, strip_links } = raw as z.infer<typeof BATCH_READ_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const cap = max_chars_per_note ?? 2000;
        const strip = strip_links !== false;
        const q = query?.trim() ?? "";
        const normSlugs = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
        const key = `${filter}|${cap}|${strip ? 1 : 0}|${q}|${normSlugs.join(",")}`;
        return runCachedTool("batch_read", key, normSlugs.join(", "), () => {
          const ts = q ? terms(q) : [];
          const sections: string[] = [];
          const eventHits: McpEventHit[] = [];
          for (const slug of normSlugs) {
            const n = getNote(slug);
            if (!n) {
              sections.push(`# [Not Found] ${slug}\nNote "${slug}" not found.`);
              continue;
            }
            if (!matchesAudience(n.audience, filter)) {
              sections.push(`# [Filtered] ${n.slug}\nNote "${n.slug}" is outside audience=${filter}.`);
              continue;
            }
            eventHits.push({ slug: n.slug, title: n.title, folder: n.folder });
            const baseBody = strip ? (n.cleanBody ?? stripSeeAlso(n.body)) : n.body;
            const body = baseBody.length > cap || ts.length > 0 ? excerptNote(n, ts, cap, strip) : baseBody;
            sections.push(
              noteText(n, body, {
                includeSources: filter !== "user" && n.audience === "dev",
                includeMedia: false,
                includeLinks: !strip,
                linkCap: 6,
              }),
            );
          }
          return {
            text: sections.join("\n\n---\n\n"),
            hits: eventHits,
            totalHits: eventHits.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "ask_brain",
    {
      schema: ASK_SCHEMA,
      run: (raw) => {
        const { question, audience, compact, max_notes } = raw as z.infer<typeof ASK_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const isCompact = Boolean(compact);
        const defaultMax = isCompact ? 2 : 3;
        const maxHitCount = Math.min(max_notes ?? defaultMax, isCompact ? 2 : 4);
        const key = `${filter}|${isCompact ? 1 : 0}|${maxHitCount}|${question.trim()}`;
        return runCachedTool("ask_brain", key, question, () => {
          const { hits, confidence, totalTerms, bestMatchedTerms, topScore } = searchWithMeta(question, maxHitCount, filter);
          if (!hits.length) {
            return {
              text: `🛑 Abstain — No matching notes (audience=${filter}). Do not guess—try other keywords (Thai or SQL/API identifiers) or list_notes.`,
              hits: [],
              totalHits: 0,
              audience: filter,
            };
          }
          const coverage = bestMatchedTerms / Math.max(1, totalTerms);
          if (confidence === "low" && (coverage < 0.5 || topScore < 18)) {
            const candidates = hits
              .slice(0, 3)
              .map((h) => `- ${h.slug} (${h.folder}) — ${h.title}`)
              .join("\n");
            return {
              text: `🛑 Abstain — Insufficient Grounded Evidence in BC Brain (audience=${filter}, confidence=low, coverage=${bestMatchedTerms}/${totalTerms}, topScore=${topScore}) for: ${question}\n\nDo NOT extrapolate or guess. State clearly that BC Brain has no verified record for this question.\nClosest topic candidates (inspect with read_note only if relevant):\n${candidates}`,
              hits: hits.slice(0, 2).map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
              totalHits: hits.length,
              audience: filter,
            };
          }
          let selectedHits = confidence === "low" ? hits.slice(0, Math.min(2, maxHitCount)) : hits.slice(0, maxHitCount);
          if (confidence === "high" && selectedHits.length > 2) {
            selectedHits = selectedHits.filter((h, i) => i < 2 || h.score >= topScore * 0.5);
          }
          const ts = terms(question);
          const showDevSources = filter === "dev";
          const highCaps = isCompact ? [2200, 1100] : [3600, 1800, 1200, 1000];
          const lowCaps = isCompact ? [1800, 1000] : [2600, 1400];
          const parts = selectedHits.map((h, i) => {
            const n = getNote(h.slug)!;
            const cap = confidence === "low" ? (lowCaps[i] ?? 1200) : (highCaps[i] ?? 1200);
            return noteText(n, excerptNote(n, ts, cap, true), {
              includeSources: showDevSources,
              linkCap: isCompact ? 3 : 5,
              includeMedia: false,
            });
          });
          const graphCtx = connectedNeighbors(
            selectedHits.map((h) => h.slug),
            filter,
            isCompact ? 2 : confidence === "low" ? 3 : 4,
          );
          const ctxBlock = graphCtx.length
            ? `\n\n---\n\n## Connected Graph Context (1-hop — use batch_read or traverse_brain to inspect)\n${graphCtx
                .map((g) => `- [${g.rel} · ${RELATION_LABEL[g.rel]}] ${g.slug} (${g.folder}) — ${g.title} (via ${g.via})`)
                .join("\n")}`
            : "";
          const mediaCtx =
            filter !== "dev"
              ? formatAggregatedMediaBlock(
                  collectRelatedMedia(
                    selectedHits.map((h) => h.slug),
                    filter,
                    isCompact ? 2 : 3,
                    isCompact ? 2 : 3,
                    isCompact ? 1 : 2,
                  ),
                )
              : "";
          const guardrailBanner =
            confidence === "low"
              ? `\n> ⚠️ Low-confidence match (matched ${bestMatchedTerms}/${totalTerms} query terms, top score ${topScore}). Verify carefully before answering; if the notes below do not directly answer the question, state honestly that BC Brain has no verified record instead of guessing.\n`
              : "";
          return {
            text: `Top ${selectedHits.length} notes (audience=${filter}, confidence=${confidence}, coverage=${bestMatchedTerms}/${totalTerms}) for: ${question}${guardrailBanner}\n\n${parts.join("\n\n---\n\n")}${mediaCtx}${ctxBlock}`,
            hits: selectedHits.map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
            totalHits: selectedHits.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "search_brain",
    {
      schema: SEARCH_SCHEMA,
      run: (raw) => {
        const { query, limit, audience } = raw as z.infer<typeof SEARCH_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const lim = limit ?? 5;
        const key = `${filter}|${lim}|${query.trim()}`;
        return runCachedTool("search_brain", key, query, () => {
          const hits = search(query, lim, filter);
          const compactHits = hits.map((h) => ({
            slug: h.slug,
            title: h.title,
            folder: h.folder,
            audience: h.audience,
            tags: h.tags,
            score: h.score,
            snippet: h.snippet.length > 150 ? `${h.snippet.slice(0, 147)}...` : h.snippet,
            ...(h.images?.length ? { images: h.images.slice(0, 2).map((img) => ({ alt: img.alt, url: img.url })) } : {}),
            ...(h.videos?.length ? { videos: h.videos.slice(0, 2).map((v) => ({ title: v.title, url: v.url, videoId: v.videoId })) } : {}),
          }));
          return {
            text: JSON.stringify(compactHits),
            hits: hits.slice(0, 6).map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
            totalHits: hits.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "traverse_brain",
    {
      schema: TRAVERSE_SCHEMA,
      run: (raw) => {
        const { slug, to_slug, depth, direction, relation, folder, limit, audience } = raw as z.infer<typeof TRAVERSE_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const rawArg = to_slug ? `${slug} → ${to_slug}` : `${slug} (depth=${depth ?? 2}${relation ? `, ${relation}` : ""})`;
        const key = `${filter}|${slug}|${to_slug ?? ""}|${depth ?? ""}|${direction ?? ""}|${relation ?? ""}|${folder ?? ""}|${limit ?? ""}`;
        return runCachedTool("traverse_brain", key, rawArg, () => {
          const res = traverseGraph({ slug, toSlug: to_slug, depth, direction, relation, folder, limit, audience: filter });
          if (!res.start) {
            return { text: `Start note "${slug}" not found in audience=${filter}.`, hits: [], totalHits: 0, audience: filter };
          }
          const stepHits = (res.mode === "path" ? (res.path ?? []) : res.neighbors)
            .slice(0, 5)
            .map((s) => ({ slug: s.slug, title: s.title, folder: s.folder }));
          const eventHits = [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }, ...stepHits];
          const totalHits = res.mode === "path" ? (res.path?.length ?? 0) : res.neighbors.length;
          const header = `# Traverse from ${res.start.slug} | audience: ${filter} | ${res.start.title}`;
          if (res.mode === "path") {
            if (!res.target) {
              return {
                text: `${header}\nTarget note "${to_slug}" not found in audience=${filter}.`,
                hits: [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }],
                totalHits: 0,
                audience: filter,
              };
            }
            if (!res.path?.length) {
              return {
                text:
                  res.start.slug === res.target.slug
                    ? `${header}\nSame note (0 hops).`
                    : `${header}\nNo path found to ${res.target.slug} within 6 hops (audience=${filter}).`,
                hits: [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }],
                totalHits: 0,
                audience: filter,
              };
            }
            const chain = [
              res.start.slug,
              ...res.path.map((s) => `${s.direction === "out" ? `--[${s.rel}]-->` : `<--[${s.rel}]--`} ${s.slug}`),
            ].join(" ");
            const lines = res.path.map(
              (s) => `${s.hop}. ${s.slug} | ${s.folder} | ${s.audience} | [${s.rel}] via ${s.via} — ${s.title}`,
            );
            return { text: `${header}\nPath (${res.path.length} hops): ${chain}\n\n${lines.join("\n")}`, hits: eventHits, totalHits, audience: filter };
          }
          if (!res.neighbors.length) {
            return {
              text: `${header}\nNo matching connected notes (depth=${depth ?? 2}, audience=${filter}).`,
              hits: [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }],
              totalHits: 0,
              audience: filter,
            };
          }
          const grouped = new Map<number, typeof res.neighbors>();
          for (const s of res.neighbors) grouped.set(s.hop, [...(grouped.get(s.hop) ?? []), s]);
          const sections = [...grouped.entries()]
            .sort(([a], [b]) => a - b)
            .map(
              ([hop, steps]) =>
                `## Hop ${hop} (${steps.length})\n${steps
                  .map((s) => `- ${s.slug} | ${s.folder} | ${s.audience} | [${s.rel} ${s.direction} via ${s.via}] ${s.title}`)
                  .join("\n")}`,
            );
          return { text: `${header}\n\n${sections.join("\n\n")}`, hits: eventHits, totalHits, audience: filter };
        });
      },
    },
  ],
  [
    "read_note",
    {
      schema: READ_SCHEMA,
      run: (raw) => {
        const { slug, query, max_chars } = raw as z.infer<typeof READ_SCHEMA>;
        const q = query?.trim() ?? "";
        const key = `${slug.trim()}|${q}|${max_chars ?? ""}`;
        return runCachedTool("read_note", key, slug, () => {
          const n = getNote(slug);
          if (n) {
            const aud: AudienceFilter = n.audience === "both" ? "all" : n.audience;
            const body =
              q || (max_chars && n.body.length > max_chars)
                ? excerptNote(n, q ? terms(q) : [], max_chars ?? 4000, Boolean(q))
                : n.body;
            return {
              text: noteText(n, body, { includeSources: n.audience === "dev", linkCap: 16, includeMedia: true }),
              hits: [{ slug: n.slug, title: n.title, folder: n.folder }],
              totalHits: 1,
              audience: aud,
            };
          }
          const near = search(slug.replace(/[-_]/g, " "), 5).map((h) => h.slug);
          return {
            text: `Note "${slug}" not found.${near.length ? ` Closest: ${near.join(", ")}.` : ""} Use search_brain or list_notes.`,
            hits: [],
            totalHits: 0,
            audience: "all",
          };
        });
      },
    },
  ],
  [
    "list_notes",
    {
      schema: LIST_SCHEMA,
      run: (raw) => {
        const { folder, tag, audience } = raw as z.infer<typeof LIST_SCHEMA>;
        const f = folder?.toLowerCase();
        const t = tag?.toLowerCase();
        const filter: AudienceFilter = audience ?? "all";
        const rawArg = [folder ? `folder=${folder}` : "", tag ? `tag=${tag}` : ""].filter(Boolean).join(" ") || "*";
        const key = `${filter}|${f ?? ""}|${t ?? ""}`;
        return runCachedTool("list_notes", key, rawArg, () => {
          const matched = listVaultRows(filter).filter(
            (n) => (!f || n.folder === f) && (!t || n.tags.some((x) => x.toLowerCase() === t)),
          );
          const rows = matched.map((n) => `${n.slug} | ${n.folder} | ${n.audience} | ${n.title} | ${n.tags.join(",")}`);
          return {
            text: rows.join("\n") || "No notes match.",
            hits: matched.slice(0, 5).map((n) => ({ slug: n.slug, title: n.title, folder: n.folder })),
            totalHits: matched.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "find_media",
    {
      schema: FIND_MEDIA_SCHEMA,
      run: (raw) => {
        const { query, kind, limit, audience } = raw as z.infer<typeof FIND_MEDIA_SCHEMA>;
        const filter: AudienceFilter = audience ?? "user";
        const mediaKind = kind ?? "all";
        const lim = limit ?? 12;
        const rawArg = [query?.trim() || "*", mediaKind !== "all" ? `kind=${mediaKind}` : ""].filter(Boolean).join(" ");
        const key = `${filter}|${mediaKind}|${lim}|${query?.trim() ?? "*"}`;
        return runCachedTool("find_media", key, rawArg, () => {
          const res = findMedia({ query, kind: mediaKind, limit: lim, audience: filter });
          return {
            text: JSON.stringify({
              playlistUrl: "https://www.youtube.com/playlist?list=PLO9P7tPZLXB0",
              websiteUrl: "https://bcaccount.com",
              count: res.items.length,
              items: res.items,
            }),
            hits: res.matchedNotes.slice(0, 5),
            totalHits: res.items.length,
            audience: filter,
          };
        });
      },
    },
  ],
]);

// ---------- Public Fast REST API helper (/api/fast) ----------
export function runFastRestQuery(opts: {
  q?: string;
  menu?: string;
  audience?: AudienceFilter;
  mode?: "normal" | "ultra";
  includeMedia?: boolean;
  maxChars?: number;
}): { ok: boolean; kind: "menu" | "answer"; audience: AudienceFilter; mode: string; answer: string; abstained: boolean; confidence: string; hits: McpEventHit[]; ms: number; cached: boolean } {
  const filter: AudienceFilter = opts.audience ?? "user";
  if (opts.menu?.trim()) {
    const entry = TOOL_MAP.get("lookup_menu")!;
    const out = entry.run({ query: opts.menu.trim(), audience: filter, limit: 6 });
    return {
      ok: true,
      kind: "menu",
      audience: filter,
      mode: "direct",
      answer: out.result.content[0].text,
      abstained: out.payload?.totalHits === 0,
      confidence: out.payload?.totalHits ? "high" : "low",
      hits: out.payload?.hits ?? [],
      ms: Math.round((out.ms ?? 0) * 100) / 100,
      cached: Boolean(out.cached),
    };
  }
  const q = opts.q?.trim() ?? "";
  const m = opts.mode ?? "ultra";
  if (q.length < 2) {
    return {
      ok: false,
      kind: "answer",
      audience: filter,
      mode: m,
      answer: "Missing query parameter ?q=... (min 2 chars) or ?menu=4013",
      abstained: true,
      confidence: "low",
      hits: [],
      ms: 0,
      cached: false,
    };
  }
  const entry = TOOL_MAP.get("quick_answer")!;
  const out = entry.run({
    question: q,
    audience: filter,
    mode: m,
    max_chars: opts.maxChars,
    include_media: Boolean(opts.includeMedia),
  });
  return {
    ok: true,
    kind: "answer",
    audience: filter,
    mode: m,
    answer: out.result.content[0].text,
    abstained: Boolean(out.payload?.abstained),
    confidence: out.payload?.confidence ?? "medium",
    hits: out.payload?.hits ?? [],
    ms: Math.round((out.ms ?? 0) * 100) / 100,
    cached: Boolean(out.cached),
  };
}

// ---------- Headers & Rate Limiting ----------
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Retry-After, Mcp-Protocol-Version",
  "Mcp-Protocol-Version": DEFAULT_PROTOCOL_VERSION,
  "Cache-Control": "no-store",
};

export const JSON_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  "Content-Type": "application/json; charset=utf-8",
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cur = rateBuckets.get(ip);
  if (!cur || cur.resetAt <= now) {
    if (!cur && rateBuckets.size >= RATE_MAX_KEYS) {
      for (const [k, v] of rateBuckets) {
        if (v.resetAt <= now) rateBuckets.delete(k);
      }
      if (rateBuckets.size >= RATE_MAX_KEYS) {
        const oldest = rateBuckets.keys().next().value;
        if (oldest !== undefined) rateBuckets.delete(oldest);
      }
    }
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  cur.count += 1;
  if (cur.count > RATE_LIMIT_MAX) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

// ---------- Zero-Allocation Stateless JSON-RPC 2.0 Dispatcher ----------
export type JsonRpcReq = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

// Returns pre-serialized JSON string (or null for notifications) to avoid double JSON.stringify on cached tool responses
export function dispatchJsonRpcRaw(msg: JsonRpcReq): string | null {
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
    return JSON.stringify({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32600, message: "Invalid Request" } });
  }
  const { method, params } = msg;
  const isNotification = msg.id === undefined || method.startsWith("notifications/");
  if (isNotification) return null;

  const idJson = JSON.stringify(msg.id);
  switch (method) {
    case "initialize": {
      const requestedVer = typeof params?.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL_VERSION;
      return JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: requestedVer,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: FULL_INSTRUCTIONS,
        },
      });
    }
    case "ping":
      return `{"jsonrpc":"2.0","id":${idJson},"result":${EMPTY_OBJ_JSON}}`;
    case "tools/list":
      return `{"jsonrpc":"2.0","id":${idJson},"result":${TOOLS_LIST_RESULT_JSON}}`;
    case "resources/list":
      return `{"jsonrpc":"2.0","id":${idJson},"result":${EMPTY_RESOURCES_JSON}}`;
    case "prompts/list":
      return `{"jsonrpc":"2.0","id":${idJson},"result":${EMPTY_PROMPTS_JSON}}`;
    case "tools/call": {
      const toolName = typeof params?.name === "string" ? params.name : "";
      const entry = TOOL_MAP.get(toolName);
      if (!entry) {
        return JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: `Unknown tool: ${toolName}` } });
      }
      const parsed = entry.schema.safeParse(params?.arguments ?? {});
      if (!parsed.success) {
        const issue = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
        return JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: textResult(`Invalid arguments for ${toolName}: ${issue}`, true),
        });
      }
      try {
        const { resultJson } = entry.run(parsed.data as Record<string, unknown>);
        return `{"jsonrpc":"2.0","id":${idJson},"result":${resultJson}}`;
      } catch (err) {
        const msgText = err instanceof Error ? err.message : "Internal tool error";
        return JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: textResult(`Error running ${toolName}: ${msgText}`, true),
        });
      }
    }
    default:
      return JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

export function handleJsonRpcPayload(rawText: string): { status: number; body: string | null } {
  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return {
      status: 413,
      body: '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}',
    };
  }
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    return {
      status: 400,
      body: '{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: invalid JSON."}}',
    };
  }
  if (Array.isArray(parsedBody)) {
    if (!parsedBody.length) {
      return {
        status: 400,
        body: '{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Invalid Request: empty batch."}}',
      };
    }
    const items = parsedBody
      .map((item) => dispatchJsonRpcRaw(item as JsonRpcReq))
      .filter((r): r is string => r !== null);
    if (!items.length) return { status: 202, body: null };
    return { status: 200, body: `[${items.join(",")}]` };
  }
  const single = dispatchJsonRpcRaw(parsedBody as JsonRpcReq);
  if (single === null) return { status: 202, body: null };
  return { status: 200, body: single };
}

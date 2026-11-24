import { z } from "zod";
import { getGapReport, recordGap, type GapReason, type GapReport } from "./gap-log";
import { getGroundingStats, verifyReferences, type VerifyReferenceInput, type VerifyReferenceResult } from "./grounding-runtime";
import { matchesAudience, RELATION_LABEL, RELATION_TYPES, type AudienceFilter } from "./groups";
import { emitMcpEvent, type McpEventHit, type McpToolName } from "./mcp-events";
import {
  bundleVersion,
  collectRelatedMedia,
  connectedNeighbors,
  excerptNote,
  findMedia,
  getNote,
  getNoteFacts,
  getNoteTldr,
  getWhatsNew,
  listVaultRows,
  lookupDirect,
  lookupError,
  search,
  searchSections,
  searchWithMeta,
  stripSeeAlso,
  syncCommit,
  terms,
  traverseGraph,
  trimBlockAware,
  updatedAt,
  vault,
  vaultFolders,
  warmVaultIndexes,
  type FactKind,
  type Note,
  type NoteMedia,
} from "./vault";

if (process.env.NODE_ENV === "production") {
  warmVaultIndexes();
}

export const SERVER_INFO = { name: "bcbrain", version: "3.0.0" } as const;
export const DEFAULT_PROTOCOL_VERSION = "2025-03-26";
export const MAX_BODY_BYTES = 32 * 1024;
export const RATE_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 300;
const RATE_MAX_KEYS = 4096;

const INSTRUCTIONS = `BC Brain v3 = ultra-fast dual-audience knowledge base for BC Ai Account & BC suite (sales, purchasing, inventory, AR/AP, cash/bank, assets, GL, VAT/WHT, POS, AutoCare, e-Tax, WMS, TMS, Procure, CRM, LINE OA, Market, Dashboard, MonitorMap, WorkMonitor, Company Brain), verified against real source code (hybrid RRF, section BM25, 256-dim semantic, structured facts, O(1) error index, and ground-truth verifier).

FASTEST TOOL SELECTION (15 tools — minimize round-trips & token latency; do NOT pre-read playbooks unless needing full scripts):
1. quick_answer — DEFAULT for real-time Q&A, Call Center, voice/LINE bots, and focused lookups: 1 call (~2k chars normal, ~1.4k fast, or ~600-char TL;DR ultra) with top structured facts. Set include_media: true for screenshots/YouTube links.
2. batch_ask — Answer 1–5 questions in ONE single call (defaults to mode: "ultra") when user asks compound/multi-part questions.
3. lookup_menu — INSTANT O(1) lookup for 4-digit menu codes (1001–9070), screen names, or SQL table names (ic_trans, gl_journal, etc.).
4. lookup_error — INSTANT O(1) Thai validation/error alert lookup returning exact cause, fix snippet, and canonical note slug.
5. search_sections — Surgical ## Section BM25 search returning block-aware excerpts + structured facts without whole-note bloat.
6. get_facts — Typed structured facts ([menu], [rule], [limit], [error], [formula]) filtered by query, slugs, or kinds.
7. verify_reference — Anti-hallucination ground-truth verifier for 4-digit menu codes (all modes) and SQL tables/table.column refs (dev/all only; strictly blocked in user mode).
8. whats_new — Recently updated knowledge base notes feed (days/audience/limit).
9. batch_read / ask_brain — Read 1–5 known slugs or synthesize multi-note answers with 1-hop graph & aggregated media.

AUDIENCE ISOLATION (MANDATORY):
- Dev (SQL, schema, trans_flag, GL Dr/Cr, API, architecture; optional full guide: playbook-dev): pass audience: "dev" (or "all" for UI+tech). Use exact table/column/trans_flag names, PostgreSQL NUMERIC (no float), and COALESCE(last_status, 0) = 0.
- User / Call Center / Pre-sale (optional full guides: playbook-call-center, playbook-sales): ALWAYS pass audience: "user". Answer in plain Thai step-by-step with NO SQL/code/table names; cite Thai menu path + 4-digit menu code (1001–9070), button names, and ready-to-share bcaccount.com screenshots + YouTube links (PLO9P7tPZLXB0). Missing menus: check 4 editions, Feature Switchboard (1002), and permissions (ts-menu-missing-switchboard). Pricing/partner/support: cite verified notes only (exclude 7% VAT & external AI API costs; https://bcaccount.com/quotation / LINE @bcaccount / 089-922-3131).

GROUNDING: Answer ONLY from verified notes. If abstained (🛑 Abstain) or missing, state clearly without guessing. Never expose secrets or internal slugs to end users.`;

export const FULL_INSTRUCTIONS = `${INSTRUCTIONS}\nKnowledge last updated: ${updatedAt} (Thai time)${syncCommit ? ` · source bcaiaccount@${syncCommit}` : ""}.`;

const AUDIENCE_ENUM = z.enum(["all", "user", "dev"]);
const SMART_AUDIENCE_ENUM = z.enum(["all", "user", "dev", "both"]);
const FACT_KIND_ENUM = z.enum(["menu", "rule", "limit", "error", "formula"]);
const ANNOTATIONS = { readOnlyHint: true, openWorldHint: false } as const;

export function normalizeRestAudience(raw?: string | null, defaultFilter: AudienceFilter = "user"): AudienceFilter {
  if (raw === "user") return "user";
  if (raw === "dev") return "dev";
  if (raw === "all" || raw === "both") return "all";
  return defaultFilter;
}

function normalizeToolAudience(raw?: "all" | "user" | "dev" | "both", defaultFilter: AudienceFilter = "all"): AudienceFilter {
  if (raw === "user") return "user";
  if (raw === "dev") return "dev";
  if (raw === "all" || raw === "both") return "all";
  return defaultFilter;
}

const USER_TECH_LEAK_RE =
  /\b(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|COALESCE|NUMERIC|VARCHAR|BIGINT|trans_flag|last_status|ic_trans|ic_trans_detail|ic_inventory|gl_journal|ar_customer|ap_supplier|cb_chq_list|erp_option|fa_asset|bc_user_list|bc_mcp_access_tokens)\b|\b[a-z]{2,12}_[a-z0-9]+(?:_[a-z0-9]+)+\b|\.(?:go|tsx?|sql):\d+/i;
const FACT_PREFIX_RE = /^\[(menu|rule|limit|error|formula)\]\s+(.+)$/;

type ParsedFact = { kind: FactKind; text: string; formatted: string };

function safeNoteFacts(n: Note, filter: AudienceFilter, kinds?: Set<FactKind>, maxPerNote = 8): ParsedFact[] {
  if (!matchesAudience(n.audience, filter)) return [];
  const out: ParsedFact[] = [];
  for (const formatted of getNoteFacts(n)) {
    const m = formatted.match(FACT_PREFIX_RE);
    if (!m) continue;
    const kind = m[1] as FactKind;
    const text = m[2];
    if (kinds && kinds.size > 0 && !kinds.has(kind)) continue;
    if (filter === "user" && USER_TECH_LEAK_RE.test(text)) continue;
    out.push({ kind, text, formatted });
    if (out.length >= maxPerNote) break;
  }
  return out;
}

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
  topScore?: number;
  facts?: string[];
  resultJson: string; // pre-serialized JSON fragment for {"content":[{"type":"text","text":...}]}
};
const responseCache = new Map<string, CachedPayload>();

const GAP_TRACKED_TOOLS = new Set<McpToolName>([
  "ask_brain",
  "quick_answer",
  "search_brain",
  "lookup_error",
  "search_sections",
]);

function maybeRecordToolGap(tool: McpToolName, rawArg: string, payload: CachedPayload): void {
  if (!GAP_TRACKED_TOOLS.has(tool)) return;
  if (!payload.abstained && payload.totalHits > 0 && payload.confidence !== "low") return;
  const reason: GapReason =
    payload.totalHits === 0 ? "zero_hit" : payload.abstained ? "abstain" : "low_conf";
  recordGap({
    tool,
    query: rawArg,
    audience: payload.audience,
    reason,
    topScore: payload.topScore,
  });
}

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
    maybeRecordToolGap(tool, rawArg, hit);
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
  maybeRecordToolGap(tool, rawArg, full);
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
  mode: "normal" | "ultra" | "fast",
  maxChars: number | undefined,
  withMedia: boolean,
  withFacts = true,
): Omit<CachedPayload, "resultJson"> {
  const defaultBudget = mode === "ultra" ? 700 : mode === "fast" ? 1400 : 2000;
  const budget = maxChars ?? defaultBudget;
  const { hits, confidence, totalTerms, bestMatchedTerms, topScore } = searchWithMeta(question, 3, filter);
  if (!hits.length) {
    return {
      text: `🛑 Abstain — No matching notes (audience=${filter}). Do not guess—try lookup_menu, lookup_error, or search_brain.`,
      hits: [],
      totalHits: 0,
      audience: filter,
      abstained: true,
      confidence: "low",
      topScore: 0,
      facts: [],
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
      topScore,
      facts: [],
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
    const topFacts = safeNoteFacts(top, filter, undefined, 3).map((f) => f.formatted);
    const baseText = `[quick_answer:ultra | audience=${filter} | confidence=${confidence} | slug: ${top.slug}]\n# ${top.title}\n${body.trim()}${src}${mediaLine}`;
    let outText = baseText;
    if (withFacts && topFacts.length) {
      const twoFacts = `\nfacts: ${topFacts.slice(0, 2).join(" | ")}`;
      const oneFact = `\nfacts: ${topFacts[0]}`;
      if (baseText.length + twoFacts.length <= 980) outText = `${baseText}${twoFacts}`;
      else if (baseText.length + oneFact.length <= 980) outText = `${baseText}${oneFact}`;
    }
    return {
      text: outText,
      hits: [{ slug: top.slug, title: top.title, folder: top.folder }],
      totalHits: 1,
      audience: filter,
      abstained: false,
      confidence,
      topScore,
      facts: topFacts,
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
  const collectedFacts: string[] = [];
  const seenFact = new Set<string>();
  const blocks = picked.map((h, i) => {
    const n = getNote(h.slug)!;
    for (const f of safeNoteFacts(n, filter, undefined, 2)) {
      if (!seenFact.has(f.formatted) && collectedFacts.length < 3) {
        seenFact.add(f.formatted);
        collectedFacts.push(f.formatted);
      }
    }
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
  const headerTag = mode === "fast" ? "quick_answer:fast" : "quick_answer";
  const baseText = `[${headerTag} | audience=${filter} | confidence=${confidence} | coverage=${bestMatchedTerms}/${totalTerms}]\n\n${blocks.join("\n\n---\n\n")}${mediaLine}${relLine}`;
  let outText = baseText;
  if (withFacts && collectedFacts.length) {
    const factsLine = `\nfacts: ${collectedFacts.slice(0, 3).join(" | ")}`;
    if (baseText.length + factsLine.length <= 2950) {
      outText = `${baseText}${factsLine}`;
    } else if (baseText.length + collectedFacts[0].length + 8 <= 2950) {
      outText = `${baseText}\nfacts: ${collectedFacts[0]}`;
    }
  }
  return {
    text: outText,
    hits: picked.map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
    totalHits: picked.length,
    audience: filter,
    abstained: false,
    confidence,
    topScore,
    facts: collectedFacts,
  };
}

// ---------- Pre-Compiled Zod Schemas (constructed ONCE at module load) ----------
const QUICK_ANSWER_SCHEMA = z.object({
  question: z.string().min(2).max(500),
  audience: AUDIENCE_ENUM.optional(),
  mode: z.enum(["normal", "ultra", "fast"]).optional(),
  max_chars: z.number().int().min(300).max(4500).optional(),
  include_media: z.boolean().optional(),
  include_facts: z.boolean().optional(),
});

const BATCH_ASK_SCHEMA = z.object({
  questions: z.array(z.string().min(2).max(300)).min(1).max(5),
  audience: AUDIENCE_ENUM.optional(),
  mode: z.enum(["normal", "ultra", "fast"]).optional(),
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

const LOOKUP_ERROR_SCHEMA = z.object({
  query: z.string().min(1).max(300),
  audience: SMART_AUDIENCE_ENUM.optional(),
  limit: z.number().int().min(1).max(15).optional(),
});

const SEARCH_SECTIONS_SCHEMA = z.object({
  query: z.string().min(1).max(300),
  audience: SMART_AUDIENCE_ENUM.optional(),
  limit: z.number().int().min(1).max(15).optional(),
  max_chars: z.number().int().min(200).max(6000).optional(),
});

const GET_FACTS_SCHEMA = z.object({
  query: z.string().max(300).optional(),
  slugs: z.array(z.string().min(1).max(120)).max(10).optional(),
  kinds: z.array(FACT_KIND_ENUM).max(5).optional(),
  audience: SMART_AUDIENCE_ENUM.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const WHATS_NEW_SCHEMA = z.object({
  days: z.number().int().min(1).max(365).optional(),
  audience: SMART_AUDIENCE_ENUM.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const VERIFY_REFERENCE_SCHEMA = z.object({
  menus: z.array(z.string().min(1).max(20)).max(50).optional(),
  tables: z.array(z.string().min(1).max(100)).max(50).optional(),
  columns: z.array(z.string().min(1).max(160)).max(100).optional(),
  audience: SMART_AUDIENCE_ENUM.optional(),
});

// ---------- Static MCP Tool Descriptors (JSON Schema draft-07, pre-built ONCE) ----------
const AUDIENCE_JSON_PROP = {
  type: "string",
  enum: ["all", "user", "dev"],
  description: 'Audience zone: "user" (plain Thai guides/sales), "dev" (schema/SQL/API/architecture), or "all" (default).',
};

const SMART_AUDIENCE_JSON_PROP = {
  type: "string",
  enum: ["user", "dev", "both", "all"],
  description: 'Audience zone: "user" (plain Thai guides/sales, zero SQL/code), "dev" (schema/SQL/API/architecture), or "both"/"all" (default).',
};

const FOLDERS_DESC =
  vaultFolders().join(", ") ||
  "root, playbook, start, howto, troubleshoot, faq, reports, systems, glossary, sales, dev-playbook, schema, queries, api, doctypes, architecture";

export const TOOL_DESCRIPTORS = [
  {
    name: "quick_answer",
    title: "Ultra-fast single-shot answer",
    description:
      "FASTEST default tool for real-time Q&A, Call Center, voice/LINE bots, and focused lookups. Returns ~2,000 chars ('normal'), ~1,400 chars ('fast'), or ~600-char TL;DR ('ultra') with top structured facts in 1 call and strict anti-hallucination abstention.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        question: { type: "string", minLength: 2, maxLength: 500, description: "Thai or English question." },
        audience: AUDIENCE_JSON_PROP,
        mode: { type: "string", enum: ["normal", "ultra", "fast"], description: "'normal' (~2000 chars), 'fast' (~1400 chars), or 'ultra' (~600-char TL;DR for voice/LINE bots)." },
        max_chars: { type: "integer", minimum: 300, maximum: 4500, description: "Char budget (default 2000 normal, 1400 fast, 700 ultra)." },
        include_media: { type: "boolean", description: "Append 1 compact YouTube/screenshot line (default false for max speed)." },
        include_facts: { type: "boolean", description: "Attach concise structured facts line when budget permits (default true)." },
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
        mode: { type: "string", enum: ["normal", "ultra", "fast"], description: "Default 'ultra' (TL;DR), 'fast', or 'normal'." },
        max_chars_per_answer: { type: "integer", minimum: 300, maximum: 2500, description: "Char cap per answer (default 700 ultra, 1400 normal/fast)." },
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
      "Hybrid multi-signal RRF search (Thai segmentation + BM25 + section BM25 + 256-dim semantic + SQL/menu direct match). Supports audience ('all' | 'user' | 'dev'). Default limit 5 for low latency.",
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
  {
    name: "lookup_error",
    title: "O(1) Thai validation & error message lookup",
    description:
      "Instant O(1) lookup for real BC Ai Account Thai error/validation alerts. Returns exact error message, cause + fix snippet, and canonical troubleshoot/howto note slug, with strict 🛑 Abstain on unmatched queries.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 300, description: "Thai error alert or validation message." },
        audience: SMART_AUDIENCE_JSON_PROP,
        limit: { type: "integer", minimum: 1, maximum: 15, description: "Max matched error entries (default 5)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "search_sections",
    title: "Surgical ## Section BM25 search",
    description:
      "Search individual ## Section chunks across the vault and return exact block-aware Markdown excerpts (never slicing mid-table, mid-list, or mid-code-fence) plus structured facts for matched slugs.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 300, description: "Focused Thai or technical query." },
        audience: SMART_AUDIENCE_JSON_PROP,
        limit: { type: "integer", minimum: 1, maximum: 15, description: "Max sections to return (default 5)." },
        max_chars: { type: "integer", minimum: 200, maximum: 6000, description: "Max chars per section excerpt (default 1200)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "get_facts",
    title: "Get structured typed facts ([menu], [rule], [limit], [error], [formula])",
    description:
      "Extract pre-computed typed facts ([menu], [rule], [limit], [error], [formula]) for explicit slugs or top search matches, with strict audience isolation (zero SQL/code jargon in user mode).",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        query: { type: "string", maxLength: 300, description: "Optional search query to select top relevant notes." },
        slugs: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 120 },
          maxItems: 10,
          description: "Optional explicit note slugs.",
        },
        kinds: {
          type: "array",
          items: { type: "string", enum: ["menu", "rule", "limit", "error", "formula"] },
          maxItems: 5,
          description: "Optional fact kinds filter.",
        },
        audience: SMART_AUDIENCE_JSON_PROP,
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max total facts returned (default 20)." },
      },
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "whats_new",
    title: "Recently updated knowledge base notes",
    description:
      "Return recently updated BC Brain notes within the last N days, sorted newest-first with ISO dates, titles, folders, and TL;DR summaries.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        days: { type: "integer", minimum: 1, maximum: 365, description: "Lookback window in days (default 7)." },
        audience: SMART_AUDIENCE_JSON_PROP,
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max notes to return (default 20)." },
      },
      additionalProperties: false,
    },
    annotations: ANNOTATIONS,
  },
  {
    name: "verify_reference",
    title: "Anti-hallucination ground-truth verifier",
    description:
      "Verify 4-digit BC menu codes (all modes) and SQL table / table.column references (dev/both/all modes only) against compiled real source ground truth. Strictly refuses and omits SQL tables/columns in audience='user' mode.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        menus: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 20 },
          maxItems: 50,
          description: "4-digit BC menu codes to verify (e.g. ['4013', '1005']).",
        },
        tables: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 100 },
          maxItems: 50,
          description: "SQL table names to verify (dev/both/all only; strictly blocked in user mode).",
        },
        columns: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 160 },
          maxItems: 100,
          description: "SQL 'table.column' references to verify (dev/both/all only; strictly blocked in user mode).",
        },
        audience: SMART_AUDIENCE_JSON_PROP,
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

const FACT_FOLDER_PRIORITY_USER: Record<string, number> = {
  start: 0,
  howto: 1,
  troubleshoot: 2,
  sales: 3,
  faq: 4,
  reports: 5,
  systems: 6,
  glossary: 7,
  playbook: 8,
  root: 9,
};

const FACT_FOLDER_PRIORITY_DEV: Record<string, number> = {
  "dev-playbook": 0,
  doctypes: 1,
  schema: 2,
  api: 3,
  queries: 4,
  architecture: 5,
  root: 6,
};

export type FactResultItem = {
  kind: FactKind;
  text: string;
  formatted: string;
  slug: string;
  title: string;
  folder: string;
};

function collectFactsCore(opts: {
  query?: string;
  slugs?: string[];
  kinds?: FactKind[];
  audience: AudienceFilter;
  limit: number;
}): { facts: FactResultItem[]; matchedNotes: McpEventHit[]; filteredSlugs: string[] } {
  const filter = opts.audience;
  const maxFacts = Math.min(50, Math.max(1, opts.limit));
  const kindSet = opts.kinds?.length ? new Set<FactKind>(opts.kinds) : undefined;
  const targetNotes: Note[] = [];
  const seenNote = new Set<string>();
  const filteredSlugs: string[] = [];

  if (opts.slugs?.length) {
    for (const rawSlug of opts.slugs) {
      const n = getNote(rawSlug);
      if (!n) continue;
      if (!matchesAudience(n.audience, filter)) {
        filteredSlugs.push(n.slug);
        continue;
      }
      if (!seenNote.has(n.slug)) {
        seenNote.add(n.slug);
        targetNotes.push(n);
      }
    }
  }

  const q = opts.query?.trim() ?? "";
  if (q) {
    for (const h of search(q, 6, filter)) {
      const n = getNote(h.slug);
      if (n && matchesAudience(n.audience, filter) && !seenNote.has(n.slug)) {
        seenNote.add(n.slug);
        targetNotes.push(n);
      }
    }
  }

  if (!opts.slugs?.length && !q) {
    const priMap = filter === "dev" ? FACT_FOLDER_PRIORITY_DEV : FACT_FOLDER_PRIORITY_USER;
    const pool = [...vault().values()]
      .filter((n) => matchesAudience(n.audience, filter) && n.slug !== "index")
      .sort((a, b) => (priMap[a.folder] ?? 20) - (priMap[b.folder] ?? 20) || a.slug.localeCompare(b.slug));
    for (const n of pool) {
      targetNotes.push(n);
      if (targetNotes.length >= 40) break;
    }
  }

  const facts: FactResultItem[] = [];
  const seenText = new Set<string>();
  const matchedNotesMap = new Map<string, McpEventHit>();

  for (const n of targetNotes) {
    const noteFacts = safeNoteFacts(n, filter, kindSet, 8);
    for (const f of noteFacts) {
      const dedupKey = `${f.kind}\0${f.text.toLowerCase()}`;
      if (seenText.has(dedupKey)) continue;
      seenText.add(dedupKey);
      facts.push({
        kind: f.kind,
        text: f.text,
        formatted: f.formatted,
        slug: n.slug,
        title: n.title,
        folder: n.folder,
      });
      if (!matchedNotesMap.has(n.slug)) {
        matchedNotesMap.set(n.slug, { slug: n.slug, title: n.title, folder: n.folder });
      }
      if (facts.length >= maxFacts) break;
    }
    if (facts.length >= maxFacts) break;
  }

  return { facts, matchedNotes: [...matchedNotesMap.values()], filteredSlugs };
}

export type SectionExcerptItem = {
  slug: string;
  title: string;
  folder: string;
  audience: "user" | "dev" | "both";
  heading: string;
  score: number;
  matchedTerms: number;
  excerpt: string;
  truncated: boolean;
  facts: string[];
};

function searchSectionsCore(opts: {
  query: string;
  audience: AudienceFilter;
  limit: number;
  maxChars: number;
}): {
  sections: SectionExcerptItem[];
  abstained: boolean;
  confidence: "high" | "medium" | "low";
  topScore: number;
} {
  const filter = opts.audience;
  const lim = Math.min(15, Math.max(1, opts.limit));
  const maxChars = Math.min(6000, Math.max(200, opts.maxChars));
  const rawHits = searchSections(opts.query, lim, filter);
  if (!rawHits.length) {
    return { sections: [], abstained: true, confidence: "low", topScore: 0 };
  }

  const ts = terms(opts.query);
  const topScore = rawHits[0].score;
  const bestMatched = rawHits[0].matchedTerms;
  const coverage = bestMatched / Math.max(1, ts.length);
  const confidence: "high" | "medium" | "low" =
    (coverage >= 0.6 && topScore >= 24) || (ts.length <= 1 && topScore >= 18)
      ? "high"
      : coverage >= 0.45 && topScore >= 14
        ? "medium"
        : "low";

  const factsBySlug = new Map<string, string[]>();
  const sections: SectionExcerptItem[] = [];
  for (const hit of rawHits) {
    if (!matchesAudience(hit.audience, filter)) continue;
    const trimmed = trimBlockAware(hit.raw, maxChars);
    let noteFacts = factsBySlug.get(hit.slug);
    if (!noteFacts) {
      const note = getNote(hit.slug);
      noteFacts = note ? safeNoteFacts(note, filter, undefined, 4).map((f) => f.formatted) : [];
      factsBySlug.set(hit.slug, noteFacts);
    }
    sections.push({
      slug: hit.slug,
      title: hit.title,
      folder: hit.folder,
      audience: hit.audience,
      heading: hit.heading,
      score: hit.score,
      matchedTerms: hit.matchedTerms,
      excerpt: trimmed.text,
      truncated: trimmed.truncated,
      facts: noteFacts,
    });
  }

  return {
    sections,
    abstained: sections.length === 0,
    confidence: sections.length === 0 ? "low" : confidence,
    topScore: sections[0]?.score ?? 0,
  };
}

const TOOL_MAP = new Map<string, ToolEntry>([
  [
    "quick_answer",
    {
      schema: QUICK_ANSWER_SCHEMA,
      run: (raw) => {
        const { question, audience, mode, max_chars, include_media, include_facts } = raw as z.infer<typeof QUICK_ANSWER_SCHEMA>;
        const filter: AudienceFilter = audience ?? "all";
        const m = mode ?? "normal";
        const budget = max_chars ?? (m === "ultra" ? 700 : m === "fast" ? 1400 : 2000);
        const withMedia = Boolean(include_media);
        const withFacts = include_facts !== false;
        const key = `${filter}|${m}|${budget}|${withMedia ? 1 : 0}|${withFacts ? 1 : 0}|${question.trim()}`;
        return runCachedTool("quick_answer", key, question, () =>
          buildQuickAnswerPayload(question, filter, m, budget, withMedia, withFacts),
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
            const sub = buildQuickAnswerPayload(q, filter, m, budget, withMedia, true);
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
              abstained: true,
              confidence: "low",
              topScore: 0,
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
              abstained: true,
              confidence: "low",
              topScore,
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
            abstained: false,
            confidence,
            topScore,
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
          const topScore = hits[0]?.score ?? 0;
          const confidence: "high" | "medium" | "low" =
            hits.length === 0 || topScore < 18 ? "low" : topScore >= 35 ? "high" : "medium";
          const compactHits = hits.map((h) => ({
            slug: h.slug,
            title: h.title,
            folder: h.folder,
            audience: h.audience,
            tags: h.tags,
            score: h.score,
            snippet: h.snippet.length > 150 ? `${h.snippet.slice(0, 147)}...` : h.snippet,
            ...(h.bestSection ? { bestSection: h.bestSection } : {}),
            ...(h.images?.length ? { images: h.images.slice(0, 2).map((img) => ({ alt: img.alt, url: img.url })) } : {}),
            ...(h.videos?.length ? { videos: h.videos.slice(0, 2).map((v) => ({ title: v.title, url: v.url, videoId: v.videoId })) } : {}),
          }));
          return {
            text: JSON.stringify(compactHits),
            hits: hits.slice(0, 6).map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
            totalHits: hits.length,
            audience: filter,
            abstained: hits.length === 0,
            confidence,
            topScore,
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
  [
    "lookup_error",
    {
      schema: LOOKUP_ERROR_SCHEMA,
      run: (raw) => {
        const { query, audience, limit } = raw as z.infer<typeof LOOKUP_ERROR_SCHEMA>;
        const filter = normalizeToolAudience(audience, "all");
        const lim = limit ?? 5;
        const q = query.trim();
        const key = `${filter}|${lim}|${q}`;
        return runCachedTool("lookup_error", key, q, () => {
          const entries = lookupError(q, filter, lim);
          if (!entries.length) {
            return {
              text: `🛑 Abstain — No verified BC error message found for "${q}" (audience=${filter}). Do not guess—try search_sections or quick_answer.`,
              hits: [],
              totalHits: 0,
              audience: filter,
              abstained: true,
              confidence: "low",
              topScore: 0,
            };
          }
          const lines = [`[lookup_error | audience=${filter} | hits=${entries.length}]`, ""];
          const eventHits: McpEventHit[] = [];
          const seenSlug = new Set<string>();
          entries.forEach((e, i) => {
            lines.push(
              `${i + 1}. **"${e.errorText}"**\n   - cause/fix: ${e.fixSnippet}\n   - slug: \`${e.slug}\` | folder: ${e.folder} | audience: ${e.audience} — ${e.title}`,
            );
            if (!seenSlug.has(e.slug) && eventHits.length < 6) {
              seenSlug.add(e.slug);
              eventHits.push({ slug: e.slug, title: e.title, folder: e.folder });
            }
          });
          return {
            text: lines.join("\n"),
            hits: eventHits,
            totalHits: entries.length,
            audience: filter,
            abstained: false,
            confidence: "high",
            topScore: 100,
          };
        });
      },
    },
  ],
  [
    "search_sections",
    {
      schema: SEARCH_SECTIONS_SCHEMA,
      run: (raw) => {
        const { query, audience, limit, max_chars } = raw as z.infer<typeof SEARCH_SECTIONS_SCHEMA>;
        const filter = normalizeToolAudience(audience, "all");
        const lim = limit ?? 5;
        const cap = max_chars ?? 1200;
        const q = query.trim();
        const key = `${filter}|${lim}|${cap}|${q}`;
        return runCachedTool("search_sections", key, q, () => {
          const res = searchSectionsCore({ query: q, audience: filter, limit: lim, maxChars: cap });
          if (res.abstained) {
            return {
              text: `🛑 Abstain — No matching sections found for "${q}" (audience=${filter}). Do not guess—try search_brain or quick_answer.`,
              hits: [],
              totalHits: 0,
              audience: filter,
              abstained: true,
              confidence: "low",
              topScore: 0,
            };
          }
          const blocks: string[] = [];
          const eventHits: McpEventHit[] = [];
          const seenSlug = new Set<string>();
          const allFacts: string[] = [];
          const seenFact = new Set<string>();

          for (const sec of res.sections) {
            const srcNote = filter === "dev" ? getNote(sec.slug) : undefined;
            const srcLine =
              filter === "dev" && srcNote?.audience === "dev" && srcNote.sources.length
                ? `\nverified_sources: ${srcNote.sources.slice(0, 4).join(", ")}`
                : "";
            blocks.push(
              `### ${sec.heading}\nslug: ${sec.slug} | folder: ${sec.folder} | audience: ${sec.audience} | score: ${sec.score}\n\n${sec.excerpt}${srcLine}`,
            );
            if (!seenSlug.has(sec.slug) && eventHits.length < 6) {
              seenSlug.add(sec.slug);
              eventHits.push({ slug: sec.slug, title: sec.title, folder: sec.folder });
            }
            for (const f of sec.facts) {
              if (!seenFact.has(f) && allFacts.length < 8) {
                seenFact.add(f);
                allFacts.push(`${f} (${sec.slug})`);
              }
            }
          }
          const factsBlock = allFacts.length
            ? `\n\n---\n\n## Structured Facts\n${allFacts.map((f) => `- ${f}`).join("\n")}`
            : "";
          return {
            text: `[search_sections | audience=${filter} | confidence=${res.confidence} | sections=${res.sections.length}]\n\n${blocks.join("\n\n---\n\n")}${factsBlock}`,
            hits: eventHits,
            totalHits: res.sections.length,
            audience: filter,
            abstained: false,
            confidence: res.confidence,
            topScore: res.topScore,
          };
        });
      },
    },
  ],
  [
    "get_facts",
    {
      schema: GET_FACTS_SCHEMA,
      run: (raw) => {
        const { query, slugs, kinds, audience, limit } = raw as z.infer<typeof GET_FACTS_SCHEMA>;
        const filter = normalizeToolAudience(audience, "all");
        const lim = limit ?? 20;
        const normSlugs = slugs?.map((s) => s.trim()).filter(Boolean) ?? [];
        const normKinds = kinds ?? [];
        const q = query?.trim() ?? "";
        const rawArg = q || normSlugs.join(",") || (normKinds.length ? `kinds=${normKinds.join(",")}` : "*");
        const key = `${filter}|${lim}|${q}|${normSlugs.join(",")}|${normKinds.join(",")}`;
        return runCachedTool("get_facts", key, rawArg, () => {
          const res = collectFactsCore({
            query: q || undefined,
            slugs: normSlugs.length ? normSlugs : undefined,
            kinds: normKinds.length ? normKinds : undefined,
            audience: filter,
            limit: lim,
          });
          if (!res.facts.length) {
            return {
              text: `No matching structured facts found (audience=${filter}). Try broader query, different kinds, or read_note.`,
              hits: [],
              totalHits: 0,
              audience: filter,
            };
          }
          const lines = [
            `[get_facts | audience=${filter} | count=${res.facts.length}]`,
            ...res.facts.map((f) => `- ${f.formatted} (slug: ${f.slug})`),
          ];
          return {
            text: lines.join("\n"),
            hits: res.matchedNotes.slice(0, 6),
            totalHits: res.facts.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "whats_new",
    {
      schema: WHATS_NEW_SCHEMA,
      run: (raw) => {
        const { days, audience, limit } = raw as z.infer<typeof WHATS_NEW_SCHEMA>;
        const filter = normalizeToolAudience(audience, "all");
        const d = days ?? 7;
        const lim = limit ?? 20;
        const key = `${filter}|${d}|${lim}`;
        return runCachedTool("whats_new", key, `days=${d}`, () => {
          const rows = getWhatsNew(d, filter, lim);
          if (!rows.length) {
            return {
              text: `No notes updated within the last ${d} day(s) (audience=${filter}). Try increasing days (e.g. days: 30).`,
              hits: [],
              totalHits: 0,
              audience: filter,
            };
          }
          const lines = [
            `[whats_new | days=${d} | audience=${filter} | count=${rows.length}]`,
            ...rows.map((r) => {
              const summary = r.tldr.replace(/\s+/g, " ").trim().slice(0, 140);
              return `- **${r.updatedAt.slice(0, 10)}** \`${r.slug}\` (${r.folder} | ${r.audience}) — **${r.title}**: ${summary}`;
            }),
          ];
          return {
            text: lines.join("\n"),
            hits: rows.slice(0, 6).map((r) => ({ slug: r.slug, title: r.title, folder: r.folder })),
            totalHits: rows.length,
            audience: filter,
          };
        });
      },
    },
  ],
  [
    "verify_reference",
    {
      schema: VERIFY_REFERENCE_SCHEMA,
      run: (raw) => {
        const { menus, tables, columns, audience } = raw as z.infer<typeof VERIFY_REFERENCE_SCHEMA>;
        const filter = normalizeToolAudience(audience, "all");
        const rawArg = [
          menus?.length ? `menus=${menus.length}` : "",
          tables?.length ? `tables=${tables.length}` : "",
          columns?.length ? `cols=${columns.length}` : "",
        ]
          .filter(Boolean)
          .join(" ") || "empty";
        const key = `${filter}|m:${(menus ?? []).join(",")}|t:${(tables ?? []).join(",")}|c:${(columns ?? []).join(",")}`;
        return runCachedTool("verify_reference", key, rawArg, () => {
          const res = verifyReferences({ menus, tables, columns, audience: filter });
          const totalChecked =
            res.summary.checkedMenus + res.summary.checkedTables + res.summary.checkedColumns;
          return {
            text: JSON.stringify(res),
            hits: [],
            totalHits: totalChecked,
            audience: filter,
          };
        });
      },
    },
  ],
]);

// ---------- Server Manifest & Capabilities (v3.0.0) ----------
export function getManifest() {
  return {
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    updatedAt,
    ...(syncCommit ? { syncCommit } : {}),
    toolCount: TOOL_DESCRIPTORS.length,
    tools: TOOL_DESCRIPTORS.map((t) => ({ name: t.name, title: t.title })),
    capabilities: {
      hybridRrf: true,
      sectionBm25: true,
      semanticVectors256d: true,
      structuredFacts: true,
      errorIndex: true,
      groundingVerifier: true,
      gapTelemetry: true,
      recencyFeed: true,
      openApiVersion: "3.1.0",
    },
    grounding: getGroundingStats(),
    endpoints: {
      mcp: "/mcp",
      fast: "/api/fast",
      error: "/api/error",
      sections: "/api/sections",
      facts: "/api/facts",
      whatsNew: "/api/whats-new",
      verify: "/api/verify",
      gaps: "/api/gaps",
      bootstrapPack: "/api/bootstrap-pack",
      vaultPack: "/api/vault-pack",
      openApi: "/api/openapi.json",
      healthz: "/healthz",
    },
  };
}

// ---------- Public Fast REST API helpers (/api/*) ----------
export function runFastRestQuery(opts: {
  q?: string;
  menu?: string;
  audience?: AudienceFilter;
  mode?: "normal" | "ultra" | "fast";
  includeMedia?: boolean;
  maxChars?: number;
}): {
  ok: boolean;
  kind: "menu" | "answer";
  audience: AudienceFilter;
  mode: string;
  answer: string;
  abstained: boolean;
  confidence: string;
  facts: string[];
  hits: McpEventHit[];
  ms: number;
  cached: boolean;
} {
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
      facts: [],
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
      facts: [],
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
    include_facts: true,
  });
  return {
    ok: true,
    kind: "answer",
    audience: filter,
    mode: m,
    answer: out.result.content[0].text,
    abstained: Boolean(out.payload?.abstained),
    confidence: out.payload?.confidence ?? "medium",
    facts: out.payload?.facts ?? [],
    hits: out.payload?.hits ?? [],
    ms: Math.round((out.ms ?? 0) * 100) / 100,
    cached: Boolean(out.cached),
  };
}

export function runErrorRestQuery(opts: {
  q?: string;
  audience?: AudienceFilter;
  limit?: number;
}): {
  ok: boolean;
  error?: string;
  query: string;
  audience: AudienceFilter;
  count: number;
  abstained: boolean;
  hits: { errorText: string; fixSnippet: string; slug: string; title: string; folder: string; audience: "user" | "dev" | "both" }[];
  ms: number;
} {
  const t0 = performance.now();
  const filter: AudienceFilter = opts.audience ?? "user";
  const q = opts.q?.trim() ?? "";
  if (!q) {
    return {
      ok: false,
      error: "Missing query parameter ?q=...",
      query: "",
      audience: filter,
      count: 0,
      abstained: true,
      hits: [],
      ms: 0,
    };
  }
  const lim = Math.min(15, Math.max(1, opts.limit ?? 5));
  const entries = lookupError(q, filter, lim);
  const abstained = entries.length === 0;
  if (abstained) {
    recordGap({ tool: "lookup_error", query: q, audience: filter, reason: "zero_hit", topScore: 0 });
  }
  return {
    ok: true,
    query: q,
    audience: filter,
    count: entries.length,
    abstained,
    hits: entries.map((e) => ({
      errorText: e.errorText,
      fixSnippet: e.fixSnippet,
      slug: e.slug,
      title: e.title,
      folder: e.folder,
      audience: e.audience,
    })),
    ms: Math.round((performance.now() - t0) * 100) / 100,
  };
}

export function runSectionsRestQuery(opts: {
  q?: string;
  audience?: AudienceFilter;
  limit?: number;
  maxChars?: number;
}): {
  ok: boolean;
  error?: string;
  query: string;
  audience: AudienceFilter;
  count: number;
  abstained: boolean;
  sections: SectionExcerptItem[];
  ms: number;
} {
  const t0 = performance.now();
  const filter: AudienceFilter = opts.audience ?? "user";
  const q = opts.q?.trim() ?? "";
  if (!q) {
    return {
      ok: false,
      error: "Missing query parameter ?q=...",
      query: "",
      audience: filter,
      count: 0,
      abstained: true,
      sections: [],
      ms: 0,
    };
  }
  const res = searchSectionsCore({
    query: q,
    audience: filter,
    limit: opts.limit ?? 5,
    maxChars: opts.maxChars ?? 1200,
  });
  if (res.abstained || res.confidence === "low") {
    recordGap({
      tool: "search_sections",
      query: q,
      audience: filter,
      reason: res.abstained ? "zero_hit" : "low_conf",
      topScore: res.topScore,
    });
  }
  return {
    ok: true,
    query: q,
    audience: filter,
    count: res.sections.length,
    abstained: res.abstained,
    sections: res.sections,
    ms: Math.round((performance.now() - t0) * 100) / 100,
  };
}

export function runFactsRestQuery(opts: {
  q?: string;
  slugs?: string[];
  kinds?: FactKind[];
  audience?: AudienceFilter;
  limit?: number;
}): {
  ok: boolean;
  audience: AudienceFilter;
  count: number;
  facts: FactResultItem[];
  ms: number;
} {
  const t0 = performance.now();
  const filter: AudienceFilter = opts.audience ?? "user";
  const res = collectFactsCore({
    query: opts.q,
    slugs: opts.slugs,
    kinds: opts.kinds,
    audience: filter,
    limit: opts.limit ?? 20,
  });
  return {
    ok: true,
    audience: filter,
    count: res.facts.length,
    facts: res.facts,
    ms: Math.round((performance.now() - t0) * 100) / 100,
  };
}

export function runWhatsNewRestQuery(opts: {
  days?: number;
  audience?: AudienceFilter;
  limit?: number;
}): {
  ok: boolean;
  days: number;
  audience: AudienceFilter;
  count: number;
  items: { slug: string; title: string; folder: string; audience: "user" | "dev" | "both"; updatedAt: string; tldr: string }[];
  ms: number;
} {
  const t0 = performance.now();
  const filter: AudienceFilter = opts.audience ?? "user";
  const days = Math.min(365, Math.max(1, Math.floor(opts.days ?? 7)));
  const lim = Math.min(50, Math.max(1, Math.floor(opts.limit ?? 20)));
  const rows = getWhatsNew(days, filter, lim);
  return {
    ok: true,
    days,
    audience: filter,
    count: rows.length,
    items: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      folder: r.folder,
      audience: r.audience,
      updatedAt: r.updatedAt,
      tldr: r.tldr,
    })),
    ms: Math.round((performance.now() - t0) * 100) / 100,
  };
}

export function runVerifyRestQuery(opts: VerifyReferenceInput): VerifyReferenceResult {
  return verifyReferences(opts);
}

export function runGapsRestQuery(limit = 50): { ok: true } & GapReport {
  return { ok: true, ...getGapReport(limit) };
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

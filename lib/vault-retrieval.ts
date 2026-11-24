import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { matchesAudience, type Audience, type AudienceFilter } from "./groups";

// ---------- Shared Lightweight Interfaces (avoids circular runtime import with lib/vault.ts) ----------
export type RetrievalSection = {
  heading: string;
  raw: string;
  norm: string;
};

export type RetrievalNoteInput = {
  slug: string;
  folder: string;
  audience: Audience;
  title: string;
  tags: string[];
  aliases: string[];
  body: string;
  cleanBody?: string;
  tldr?: string;
  sections?: RetrievalSection[];
  haystack: { title: string; meta: string; body: string };
};

// ============================================================================
// 1. Block-Aware Markdown Trimming & Token-Estimate Awareness
// ============================================================================

export type TrimBlockOptions = {
  maxTokens?: number;
  /** Average Thai chars per token (default ~2.2). */
  thaiCharsPerToken?: number;
  /** Average non-Thai/ASCII chars per token (default ~3.8). */
  asciiCharsPerToken?: number;
};

export type TrimBlockResult = {
  text: string;
  truncated: boolean;
  estimatedTokens: number;
};

/** Fast token estimate tuned for Thai + ASCII/SQL mixed text (~2.2 Thai chars/token). */
export function estimateTokens(text: string, thaiCharsPerToken = 2.2, asciiCharsPerToken = 3.8): number {
  if (!text) return 0;
  let thai = 0;
  let other = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0e00 && c <= 0x0e7f) thai++;
    else if (c > 32) other++;
  }
  return Math.ceil(thai / thaiCharsPerToken + other / asciiCharsPerToken);
}

type MdBlock =
  | { kind: "heading" | "hr" | "paragraph" | "list_item" | "code"; text: string }
  | { kind: "table"; header: string; rows: string[]; text: string };

const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const LIST_START_RE = /^\s*(?:\d+[.)]|[-*+])\s+/;
const HEADING_RE = /^#{1,6}\s+/;
const HR_RE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;

function isTableRowLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.indexOf("|", 1) !== -1;
}

function parseMarkdownBlocks(text: string): MdBlock[] {
  const lines = text.split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block (atomic)
    if (trimmed.startsWith("```")) {
      const start = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) i++;
      if (i < lines.length) i++;
      blocks.push({ kind: "code", text: lines.slice(start, i).join("\n") });
      continue;
    }

    // Horizontal rule
    if (HR_RE.test(line)) {
      blocks.push({ kind: "hr", text: line });
      i++;
      continue;
    }

    // Heading
    if (HEADING_RE.test(trimmed)) {
      blocks.push({ kind: "heading", text: line });
      i++;
      continue;
    }

    // Markdown table: header + separator + data rows
    if (isTableRowLine(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const header = `${line}\n${lines[i + 1]}`;
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && isTableRowLine(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      blocks.push({
        kind: "table",
        header,
        rows,
        text: rows.length ? `${header}\n${rows.join("\n")}` : header,
      });
      continue;
    }

    // Numbered or bullet list item (each step + indented continuations is atomic)
    if (LIST_START_RE.test(line)) {
      const baseIndent = line.search(/\S/);
      const start = i;
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextTrim = next.trim();
        if (!nextTrim) break;
        if (nextTrim.startsWith("```") || HEADING_RE.test(nextTrim) || HR_RE.test(next)) break;
        if (isTableRowLine(next) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) break;
        const nextIndent = next.search(/\S/);
        if (LIST_START_RE.test(next) && nextIndent <= baseIndent) break;
        i++;
      }
      blocks.push({ kind: "list_item", text: lines.slice(start, i).join("\n") });
      continue;
    }

    // Regular paragraph / blockquote
    const start = i;
    i++;
    while (i < lines.length) {
      const next = lines[i];
      const nextTrim = next.trim();
      if (!nextTrim) break;
      if (nextTrim.startsWith("```") || HEADING_RE.test(nextTrim) || HR_RE.test(next) || LIST_START_RE.test(next)) break;
      if (isTableRowLine(next) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) break;
      i++;
    }
    blocks.push({ kind: "paragraph", text: lines.slice(start, i).join("\n") });
  }
  return blocks;
}

function trimSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  // Avoid breaking inside an open markdown link or wikilink
  let safeEnd = slice.length;
  const lastOpenWiki = slice.lastIndexOf("[[");
  const lastCloseWiki = slice.lastIndexOf("]]");
  if (lastOpenWiki > lastCloseWiki && lastOpenWiki > maxChars * 0.4) safeEnd = lastOpenWiki;
  const lastOpenLink = slice.lastIndexOf("[");
  const lastCloseParen = slice.lastIndexOf(")");
  if (lastOpenLink > lastCloseParen && lastOpenLink > maxChars * 0.4) safeEnd = Math.min(safeEnd, lastOpenLink);

  const candidate = slice.slice(0, safeEnd);
  for (const sep of ["\n", " — ", ". ", " "]) {
    const idx = candidate.lastIndexOf(sep);
    if (idx >= Math.floor(maxChars * 0.45)) return candidate.slice(0, idx).trimEnd();
  }
  return candidate.trimEnd();
}

/**
 * Block-aware Markdown trimmer:
 * - Never slices mid-table row, mid-numbered/bullet-list step, or mid-code-fence
 * - Drops trailing orphan headings / horizontal rules
 * - Supports optional token-estimate awareness (~2.2 Thai chars/token)
 */
export function trimBlockAware(text: string, maxChars: number, opts?: TrimBlockOptions): TrimBlockResult {
  const thaiCpt = opts?.thaiCharsPerToken ?? 2.2;
  const asciiCpt = opts?.asciiCharsPerToken ?? 3.8;
  const maxTokens = opts?.maxTokens;
  const src = text.trimEnd();

  const fits = (candidate: string): boolean => {
    if (candidate.length > maxChars) return false;
    if (maxTokens !== undefined && estimateTokens(candidate, thaiCpt, asciiCpt) > maxTokens) return false;
    return true;
  };

  if (maxChars <= 0) {
    return { text: "", truncated: src.length > 0, estimatedTokens: 0 };
  }
  if (fits(src)) {
    return { text: src, truncated: false, estimatedTokens: estimateTokens(src, thaiCpt, asciiCpt) };
  }

  const blocks = parseMarkdownBlocks(src);
  const kept: MdBlock[] = [];
  let acc = "";
  let truncated = false;

  const joinSep = (prevKind: MdBlock["kind"] | null, curKind: MdBlock["kind"]): string => {
    if (!prevKind) return "";
    if (prevKind === "list_item" && curKind === "list_item") return "\n";
    if (prevKind === "heading") return "\n";
    return "\n\n";
  };

  const hasSubstantialContent = () => kept.some((b) => b.kind !== "heading" && b.kind !== "hr");

  for (let bi = 0; bi < blocks.length; bi++) {
    const blk = blocks[bi];
    const prevKind = kept.length ? kept[kept.length - 1].kind : null;
    const sep = joinSep(prevKind, blk.kind);
    const nextFull = acc ? `${acc}${sep}${blk.text}` : blk.text;

    if (fits(nextFull)) {
      kept.push(blk);
      acc = nextFull;
      continue;
    }

    truncated = true;

    // Table: include header + separator + complete rows that fit (never slice mid-row, never emit header-only)
    if (blk.kind === "table" && blk.rows.length > 0) {
      let tableAcc = `${blk.header}`;
      let addedRows = 0;
      for (const row of blk.rows) {
        const candidateTable = `${tableAcc}\n${row}`;
        const candidateFull = acc ? `${acc}${sep}${candidateTable}` : candidateTable;
        if (fits(candidateFull)) {
          tableAcc = candidateTable;
          addedRows++;
        } else {
          break;
        }
      }
      if (addedRows > 0) {
        acc = acc ? `${acc}${sep}${tableAcc}` : tableAcc;
        kept.push({ kind: "table", header: blk.header, rows: blk.rows.slice(0, addedRows), text: tableAcc });
      }
      break;
    }

    // Code fence: atomic when content already exists; if nothing substantial kept yet, cleanly close fence at line boundary
    if (blk.kind === "code") {
      if (!hasSubstantialContent()) {
        const codeLines = blk.text.split("\n");
        const openLine = codeLines[0] ?? "```";
        const closeLine = "```";
        const innerLines = codeLines.slice(1, codeLines[codeLines.length - 1]?.trim().startsWith("```") ? -1 : undefined);
        let built = openLine;
        let keptLines = 0;
        for (const cl of innerLines) {
          const test = `${built}\n${cl}\n${closeLine}`;
          const full = acc ? `${acc}${sep}${test}` : test;
          if (fits(full)) {
            built = `${built}\n${cl}`;
            keptLines++;
          } else {
            break;
          }
        }
        if (keptLines > 0) {
          const closed = `${built}\n${closeLine}`;
          acc = acc ? `${acc}${sep}${closed}` : closed;
          kept.push({ kind: "code", text: closed });
        } else {
          // Single long line inside fence and zero prior content: trim safely & close fence
          const avail = Math.max(0, maxChars - (acc ? acc.length + sep.length : 0) - openLine.length - closeLine.length - 2);
          if (avail >= 16 && innerLines[0]) {
            const closed = `${openLine}\n${trimSentenceBoundary(innerLines[0], avail)}\n${closeLine}`;
            if (fits(acc ? `${acc}${sep}${closed}` : closed)) {
              acc = acc ? `${acc}${sep}${closed}` : closed;
              kept.push({ kind: "code", text: closed });
            }
          }
        }
      }
      break;
    }

    // List item: never slice mid-step if we already have substantial content
    if (blk.kind === "list_item") {
      if (!hasSubstantialContent()) {
        const avail = Math.max(20, maxChars - (acc ? acc.length + sep.length : 0));
        const clipped = trimSentenceBoundary(blk.text, avail);
        if (clipped && fits(acc ? `${acc}${sep}${clipped}` : clipped)) {
          acc = acc ? `${acc}${sep}${clipped}` : clipped;
          kept.push({ kind: "list_item", text: clipped });
        }
      }
      break;
    }

    // Paragraph: prefer clean paragraph boundary if we already have substantial content
    if (blk.kind === "paragraph") {
      if (!hasSubstantialContent()) {
        const avail = Math.max(24, maxChars - (acc ? acc.length + sep.length : 0));
        let clipped = trimSentenceBoundary(blk.text, avail);
        if (maxTokens !== undefined) {
          while (clipped.length > 16 && !fits(acc ? `${acc}${sep}${clipped}` : clipped)) {
            clipped = trimSentenceBoundary(clipped, Math.floor(clipped.length * 0.8));
          }
        }
        if (clipped && fits(acc ? `${acc}${sep}${clipped}` : clipped)) {
          acc = acc ? `${acc}${sep}${clipped}` : clipped;
          kept.push({ kind: "paragraph", text: clipped });
        }
      }
      break;
    }

    // Heading or HR that doesn't fit: simply stop before it
    break;
  }

  // Strip trailing orphan headings / horizontal rules when truncated
  while (truncated && kept.length > 1 && (kept[kept.length - 1].kind === "heading" || kept[kept.length - 1].kind === "hr")) {
    kept.pop();
  }

  // Rebuild clean output if orphan headings were dropped
  if (truncated) {
    let rebuilt = "";
    for (let k = 0; k < kept.length; k++) {
      rebuilt += (k === 0 ? "" : joinSep(kept[k - 1].kind, kept[k].kind)) + kept[k].text;
    }
    acc = rebuilt;
  }

  // Edge fallback: if even the first block couldn't fit (e.g., ultra-small budget), trim cleanly at sentence boundary
  if (!acc && src) {
    acc = trimSentenceBoundary(src, maxChars);
    truncated = true;
  }

  return {
    text: acc.trimEnd(),
    truncated,
    estimatedTokens: estimateTokens(acc, thaiCpt, asciiCpt),
  };
}

// ============================================================================
// 2. Pre-computed Lightweight Semantic Dense Vectors (256-dim Float32Array)
// ============================================================================

export const SEMANTIC_DIM = 256;

export type SemanticIndex = {
  dim: number;
  count: number;
  /** Flat row-major L2-normalized vectors: note i occupies [i*dim .. (i+1)*dim). */
  vectors: Float32Array;
  slugToIdx: Map<string, number>;
  slugs: string[];
  byteLength: number;
};

// Fast deterministic 32-bit FNV-1a + Murmur-style avalanche for signed feature hashing
function hash32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function addHashedFeature(vec: Float32Array, offset: number, feature: string, weight: number): void {
  const h1 = hash32(feature, 2166136261);
  const bucket = h1 & (SEMANTIC_DIM - 1);
  const sign = (h1 >>> 31) === 0 ? 1 : -1;
  vec[offset + bucket] += sign * weight;
}

function addTokenAndSubwords(vec: Float32Array, offset: number, token: string, weight: number, includeCharGrams = true): void {
  addHashedFeature(vec, offset, `t:${token}`, weight);
  if (!includeCharGrams || token.length < 3 || /^\d+$/.test(token)) return;
  const subW = weight * 0.34;
  const maxGrams = Math.min(token.length - 2, 14);
  for (let i = 0; i < maxGrams; i++) {
    addHashedFeature(vec, offset, `g:${token.slice(i, i + 3)}`, subW);
  }
}

function l2NormalizeRow(vec: Float32Array, offset: number, dim: number): void {
  let sumSq = 0;
  for (let d = 0; d < dim; d++) {
    const v = vec[offset + d];
    sumSq += v * v;
  }
  if (sumSq <= 1e-12) return;
  const inv = 1 / Math.sqrt(sumSq);
  for (let d = 0; d < dim; d++) vec[offset + d] *= inv;
}

export type PreTokenizedNote = {
  title: Set<string>;
  meta: Set<string>;
  body: Map<string, number>;
};

export type PreTokenizedSection = {
  head: Set<string>;
  body: Map<string, number>;
};

export function buildSemanticIndex(
  notes: RetrievalNoteInput[],
  idfLookup: (term: string) => number,
  tokenize: (normText: string) => string[],
  preTokens?: Map<string, PreTokenizedNote>,
): SemanticIndex {
  const count = notes.length;
  const vectors = new Float32Array(count * SEMANTIC_DIM);
  const slugToIdx = new Map<string, number>();
  const slugs: string[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const n = notes[i];
    const off = i * SEMANTIC_DIM;
    slugs[i] = n.slug;
    slugToIdx.set(n.slug, i);

    const pt = preTokens?.get(n.slug);
    if (pt) {
      for (const t of pt.title) addTokenAndSubwords(vectors, off, t, idfLookup(t) * 3.0, true);
      for (const t of pt.meta) addTokenAndSubwords(vectors, off, t, idfLookup(t) * 2.1, true);
      for (const [t, tf] of pt.body) addTokenAndSubwords(vectors, off, t, Math.log(1 + tf) * idfLookup(t), true);
    } else {
      const titleToks = tokenize(n.haystack.title);
      for (let k = 0; k < titleToks.length; k++) {
        const t = titleToks[k];
        addTokenAndSubwords(vectors, off, t, idfLookup(t) * 3.0, true);
      }

      const metaToks = tokenize(n.haystack.meta);
      for (let k = 0; k < metaToks.length; k++) {
        const t = metaToks[k];
        addTokenAndSubwords(vectors, off, t, idfLookup(t) * 2.1, true);
      }

      const bodyToks = tokenize(n.haystack.body);
      const tfMap = new Map<string, number>();
      for (let k = 0; k < bodyToks.length; k++) {
        const t = bodyToks[k];
        const prev = tfMap.get(t) ?? 0;
        if (prev < 12) tfMap.set(t, prev + 1);
      }
      for (const [t, tf] of tfMap) {
        addTokenAndSubwords(vectors, off, t, Math.log(1 + tf) * idfLookup(t), true);
      }
    }

    l2NormalizeRow(vectors, off, SEMANTIC_DIM);
  }

  return {
    dim: SEMANTIC_DIM,
    count,
    vectors,
    slugToIdx,
    slugs,
    byteLength: vectors.byteLength,
  };
}

export function encodeQueryVector(
  queryTerms: string[],
  synTerms: string[],
  idfLookup: (term: string) => number,
  outBuf?: Float32Array,
): Float32Array {
  const vec = outBuf ?? new Float32Array(SEMANTIC_DIM);
  vec.fill(0);
  for (let i = 0; i < queryTerms.length; i++) {
    const t = queryTerms[i];
    const idf = idfLookup(t);
    addTokenAndSubwords(vec, 0, t, idf * 1.4, true);
  }
  for (let i = 0; i < synTerms.length; i++) {
    const s = synTerms[i];
    const idf = idfLookup(s);
    addTokenAndSubwords(vec, 0, s, idf * 0.45, true);
  }
  l2NormalizeRow(vec, 0, SEMANTIC_DIM);
  return vec;
}

/** 4x unrolled cosine similarity dot-product across all L2-normalized note vectors (<0.08ms for 366 notes). */
export function scoreSemanticVectors(index: SemanticIndex, queryVec: Float32Array, outScores?: Float32Array): Float32Array {
  const N = index.count;
  const scores = outScores && outScores.length === N ? outScores : new Float32Array(N);
  const vecs = index.vectors;
  for (let i = 0; i < N; i++) {
    const off = i * SEMANTIC_DIM;
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    for (let d = 0; d < SEMANTIC_DIM; d += 4) {
      s0 += vecs[off + d] * queryVec[d];
      s1 += vecs[off + d + 1] * queryVec[d + 1];
      s2 += vecs[off + d + 2] * queryVec[d + 2];
      s3 += vecs[off + d + 3] * queryVec[d + 3];
    }
    const dot = s0 + s1 + s2 + s3;
    scores[i] = dot > 0 ? dot : 0;
  }
  return scores;
}

// ============================================================================
// 3. Structured Facts Extractor ([menu], [rule], [limit], [error], [formula])
// ============================================================================

export type FactKind = "menu" | "rule" | "limit" | "error" | "formula";

export type StructuredFact = {
  kind: FactKind;
  text: string;
  formatted: string;
};

const USER_JARGON_RE =
  /\b(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|COALESCE|NUMERIC|VARCHAR|BIGINT|trans_flag|last_status|ic_trans|gl_journal|ar_customer|ap_supplier|cb_chq_list|erp_option|fa_asset)\b|\b[a-z]{2,12}_[a-z0-9]+(?:_[a-z0-9]+)+\b|\.(?:go|tsx?|sql):\d+/i;
const MENU_CODE_FACT_RE = /(?:รหัสเมนู|เมนู)\s*\*{0,2}`?([1-9]\d{3})`?\*{0,2}|\|\s*\*\*([1-9]\d{3})\*\*\s*\|/;
const QUOTED_THAI_RE = /["“「]([^"”」\n]{6,140})["”」]/;
const LIMIT_FACT_RE =
  /(?:ไม่เกิน|สูงสุด|ขั้นต่ำ|อย่างน้อย|เพดาน|จำกัด|ฟรี\s*0\s*บาท|เริ่ม\s*\d|บาท\/เดือน|บาท\/ปี|Concurrent|ไม่จำกัด|VAT\s*7%|MB\b|KB\b|ทศนิยม|หลัก|ฉบับที่)/i;
const FORMULA_FACT_RE =
  /(?:=\s*[^\s]|ROUND\(|COALESCE\(|Mod-11|discount_word|vat_type\s*=|Dr\s*\/|Cr\s*\/|เดบิต.*เครดิต|ยอดสุทธิ\s*=|สูตรคำนวณ|ปัดเศษ|FIFO|FEFO|ถัวเฉลี่ย)/i;
const RULE_FACT_RE =
  /(?:ห้าม|ต้อง(?:ระบุ|อ้างอิง|กรอง|สร้าง|ออก|เปิด|ปิด|ใช้|บันทึก|ตรวจ|ส่ง)|เฉพาะ\s*(?:ผู้ดูแลระบบ|โหมด)|ไม่สามารถ|กฎเหล็ก|ไม่รองรับ|ล็อก|ไม่อนุญาต|บังคับ|ปิดใช้งาน)/;

function isCalendarYear(code: string): boolean {
  const n = Number(code);
  return (n >= 2015 && n <= 2035) || (n >= 2555 && n <= 2580);
}

function cleanFactLine(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[\[(?:[a-z_]+::)?([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, slug, lbl) => lbl ?? slug)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/^\s*(?:[-*+>]+|\d+[.)])\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipFact(s: string, maxLen = 136): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const idx = Math.max(cut.lastIndexOf(" — "), cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return `${(idx >= maxLen * 0.6 ? cut.slice(0, idx) : cut).trimEnd()}…`;
}

export function extractStructuredFacts(note: RetrievalNoteInput, maxFacts = 8): StructuredFact[] {
  const cap = Math.max(1, Math.min(12, maxFacts));
  const src = note.cleanBody ?? note.body;
  const lines = src.split("\n");
  const isUser = note.audience === "user";

  const buckets: Record<FactKind, string[]> = {
    menu: [],
    error: [],
    limit: [],
    formula: [],
    rule: [],
  };
  const seenNorm = new Set<string>();
  const perKindCap: Record<FactKind, number> = {
    menu: note.slug.startsWith("menu-cat") ? 4 : 2,
    error: note.folder === "troubleshoot" ? 4 : 2,
    limit: note.folder === "sales" ? 4 : 2,
    formula: note.audience === "dev" ? 3 : 2,
    rule: 3,
  };

  const pushFact = (kind: FactKind, text: string) => {
    if (buckets[kind].length >= perKindCap[kind]) return;
    const clipped = clipFact(text);
    if (clipped.length < 10) return;
    if (isUser && USER_JARGON_RE.test(clipped)) return;
    const key = clipped.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, "").slice(0, 64);
    if (!key || seenNorm.has(key)) return;
    seenNorm.add(key);
    buckets[kind].push(clipped);
  };

  // Check title for 4-digit menu code first
  const titleMenu = note.title.match(MENU_CODE_FACT_RE);
  if (titleMenu) {
    const code = titleMenu[1] || titleMenu[2];
    if (code && !isCalendarYear(code)) {
      pushFact("menu", `รหัสเมนู ${code}: ${note.title.replace(/\s*\(รหัสเมนู\s*\d{4}\)/, "").trim()}`);
    }
  }

  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !trimmed) continue;
    if (trimmed.startsWith("#") || trimmed === "---" || /^!\[/.test(trimmed) || /^\[🎬/.test(trimmed) || /^> \[!/.test(trimmed)) continue;
    if (TABLE_SEP_RE.test(trimmed)) continue;

    // Handle structured menu-catalog table rows cleanly
    const menuTableMatch = trimmed.match(/^\|\s*\*\*([1-9]\d{3})\*\*\s*\|\s*([^|]+)\|\s*\*\*([^|*]+)\*\*(?:<br>([^|]+))?\|/);
    if (menuTableMatch && !isCalendarYear(menuTableMatch[1])) {
      const code = menuTableMatch[1].trim();
      const name = menuTableMatch[3].trim();
      const mPath = (menuTableMatch[4] ?? "").trim();
      pushFact("menu", mPath ? `เมนู ${code} ${name} (${mPath})` : `เมนู ${code} ${name}`);
      continue;
    }

    // Handle pricing/formula table rows concisely
    if (trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((c) => cleanFactLine(c.replace(/<br>/g, "; ")))
        .filter(Boolean);
      if (cells.length >= 2) {
        const joined = cells.slice(0, 4).join(" | ");
        if (FORMULA_FACT_RE.test(joined)) pushFact("formula", joined);
        else if (LIMIT_FACT_RE.test(joined) && /\d/.test(joined)) pushFact("limit", joined);
      }
      continue;
    }

    const clean = cleanFactLine(trimmed);
    if (clean.length < 12 || clean.endsWith(":")) continue;

    // Priority classification per line
    const quoted = clean.match(QUOTED_THAI_RE);
    const isErrorCandidate =
      quoted &&
      !quoted[1].includes(" > ") &&
      (note.folder === "troubleshoot" ||
        /(?:ห้าม|ไม่สามารถ|ไม่พบ|ไม่พอ|ไม่เพียงพอ|ไม่ถูกต้อง|ปิดงวด|ล็อก|เกิน|ซ้ำ|ติดลบ|หมดอายุ|ผิดพลาด|เตือน|ต้องมากกว่า|กรุณา)/.test(quoted[1]));

    if (isErrorCandidate) {
      pushFact("error", clean);
      continue;
    }

    const menuM = trimmed.match(MENU_CODE_FACT_RE);
    if (menuM) {
      const code = menuM[1] || menuM[2];
      if (code && !isCalendarYear(code)) {
        pushFact("menu", clean);
        continue;
      }
    }

    if (FORMULA_FACT_RE.test(clean) && (note.audience === "dev" || /=|%|สูตร|ปัดเศษ|FIFO|FEFO|ถัวเฉลี่ย|Mod-11/.test(clean))) {
      pushFact("formula", clean);
      continue;
    }

    if (LIMIT_FACT_RE.test(clean) && /\d/.test(clean)) {
      pushFact("limit", clean);
      continue;
    }

    if (RULE_FACT_RE.test(clean)) {
      pushFact("rule", clean);
    }
  }

  // Interleave in domain-priority order up to maxFacts (max 8)
  const order: FactKind[] =
    note.folder === "troubleshoot"
      ? ["error", "rule", "menu", "limit", "formula"]
      : note.folder === "sales"
        ? ["limit", "rule", "menu", "formula", "error"]
        : note.audience === "dev"
          ? ["formula", "rule", "limit", "error", "menu"]
          : ["menu", "rule", "limit", "error", "formula"];

  const out: StructuredFact[] = [];
  for (let round = 0; round < 4 && out.length < cap; round++) {
    for (const kind of order) {
      if (out.length >= cap) break;
      const item = buckets[kind][round];
      if (item) out.push({ kind, text: item, formatted: `[${kind}] ${item}` });
    }
  }
  return out;
}

export function extractNoteFacts(note: RetrievalNoteInput, maxFacts = 8): string[] {
  return extractStructuredFacts(note, maxFacts).map((f) => f.formatted);
}

// ============================================================================
// 4. Section-Level Inverted BM25 Index (~2,000 "## Section" chunks)
// ============================================================================

export type SectionChunk = {
  noteIdx: number;
  sectionIndex: number;
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  heading: string;
  raw: string;
  norm: string;
};

export type SectionPosting = {
  idx: Int32Array;
  raw: Float32Array;
  idf: number;
};

export type SectionSearchHit = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  sectionIndex: number;
  heading: string;
  score: number;
  matchedTerms: number;
  snippet: string;
  raw: string;
};

export type SectionSearchIndex = {
  sections: SectionChunk[];
  noteCount: number;
  avgLen: number;
  postings: Map<string, SectionPosting>;
  scoreBuf: Float64Array;
  matchBuf: Int32Array;
  touchedSecs: Int32Array;
  noteBestScore: Float64Array;
  noteBestSecIdx: Int32Array;
  touchedNotes: Int32Array;
};

const SEC_K1 = 1.2;
const SEC_B = 0.75;

export function buildSectionIndex(
  notes: RetrievalNoteInput[],
  tokenize: (normText: string) => string[],
  normalizeText: (s: string) => string,
  sectionTokCache?: Map<string, PreTokenizedSection[]>,
): SectionSearchIndex {
  const sections: SectionChunk[] = [];
  const secTokRefs: PreTokenizedSection[] = [];
  for (let ni = 0; ni < notes.length; ni++) {
    const n = notes[ni];
    const secs =
      n.sections ??
      (n.cleanBody ?? n.body).split(/\n(?=## )/).map((raw) => ({
        heading: raw.split("\n")[0].replace(/^#+\s*/, "").trim(),
        raw,
        norm: normalizeText(raw),
      }));
    let cachedList = sectionTokCache?.get(n.slug);
    if (!cachedList) {
      cachedList = secs.map((s) => {
        const head = new Set(tokenize(normalizeText(s.heading || n.title)));
        const body = new Map<string, number>();
        const toks = tokenize(s.norm);
        for (let k = 0; k < toks.length; k++) {
          const w = toks[k];
          const prev = body.get(w) ?? 0;
          if (prev < 12) body.set(w, prev + 1);
        }
        return { head, body };
      });
      sectionTokCache?.set(n.slug, cachedList);
    }
    for (let si = 0; si < secs.length; si++) {
      const s = secs[si];
      if (!s.norm.trim()) continue;
      sections.push({
        noteIdx: ni,
        sectionIndex: si,
        slug: n.slug,
        title: n.title,
        folder: n.folder,
        audience: n.audience,
        heading: s.heading || n.title,
        raw: s.raw,
        norm: s.norm,
      });
      secTokRefs.push(cachedList[si]);
    }
  }

  const S = sections.length;
  const avgLen = Math.max(1, sections.reduce((sum, s) => sum + s.norm.length, 0) / Math.max(1, S));
  const temp = new Map<string, { idx: number[]; raw: number[] }>();

  for (let i = 0; i < S; i++) {
    const sec = sections[i];
    const { head: headSet, body: bodyTf } = secTokRefs[i];

    const normFactor = SEC_K1 * (1 - SEC_B + (SEC_B * sec.norm.length) / avgLen);
    const seen = new Set<string>(headSet);
    for (const t of bodyTf.keys()) seen.add(t);

    for (const t of seen) {
      const tf = bodyTf.get(t) ?? 0;
      const bodyBm25 = tf ? ((tf * (SEC_K1 + 1)) / (tf + normFactor)) * 2.5 : 0;
      const raw = (headSet.has(t) ? 9 : 0) + bodyBm25;
      if (!raw) continue;
      let bucket = temp.get(t);
      if (!bucket) {
        bucket = { idx: [], raw: [] };
        temp.set(t, bucket);
      }
      bucket.idx.push(i);
      bucket.raw.push(raw);
    }
  }

  const postings = new Map<string, SectionPosting>();
  for (const [t, bucket] of temp) {
    postings.set(t, {
      idx: Int32Array.from(bucket.idx),
      raw: Float32Array.from(bucket.raw),
      idf: Math.log(1 + S / (1 + bucket.idx.length)),
    });
  }

  return {
    sections,
    noteCount: notes.length,
    avgLen,
    postings,
    scoreBuf: new Float64Array(S),
    matchBuf: new Int32Array(S),
    touchedSecs: new Int32Array(S),
    noteBestScore: new Float64Array(notes.length),
    noteBestSecIdx: new Int32Array(notes.length).fill(-1),
    touchedNotes: new Int32Array(notes.length),
  };
}

/**
 * Ultra-fast sparse O(postings) section scorer (~0.02–0.05ms):
 * - Avoids scanning full section text for phrases except on final top-K candidates
 * - Avoids flooding unrelated sections via broad synonyms when only per-note best section is needed
 */
export function scoreSectionIndex(
  index: SectionSearchIndex,
  queryTerms: string[],
  synTerms: string[],
  phrase: string,
  menuCodes: string[],
  topLimit = 24,
): { touchedNoteCount: number; topSections: { secIdx: number; score: number; matched: number }[] } {
  const { scoreBuf, matchBuf, touchedSecs, noteBestScore, noteBestSecIdx, touchedNotes, sections, postings } = index;
  let touchedSecCount = 0;

  let idfSum = 0;
  for (let ti = 0; ti < queryTerms.length; ti++) {
    const p = postings.get(queryTerms[ti]);
    if (!p) continue;
    idfSum += p.idf;
    const pidx = p.idx;
    const praw = p.raw;
    const pidf = p.idf;
    for (let k = 0; k < pidx.length; k++) {
      const si = pidx[k];
      if (scoreBuf[si] === 0 && matchBuf[si] === 0) touchedSecs[touchedSecCount++] = si;
      scoreBuf[si] += praw[k] * pidf;
      matchBuf[si]++;
    }
  }

  // Only score synonyms for sections already matching or when topLimit > 0 with few lexical hits
  if (synTerms.length && (topLimit > 0 || touchedSecCount < 40)) {
    const capSyn = Math.min(synTerms.length, 4);
    for (let si = 0; si < capSyn; si++) {
      const sp = postings.get(synTerms[si]);
      if (!sp) continue;
      const pidx = sp.idx;
      const praw = sp.raw;
      const weight = sp.idf * 0.25;
      for (let k = 0; k < pidx.length; k++) {
        const sIdx = pidx[k];
        if (scoreBuf[sIdx] > 0) {
          scoreBuf[sIdx] += praw[k] * weight;
        } else if (topLimit > 0 && touchedSecCount < 200) {
          touchedSecs[touchedSecCount++] = sIdx;
          scoreBuf[sIdx] = praw[k] * weight;
        }
      }
    }
  }

  const avgIdf = queryTerms.length ? idfSum / queryTerms.length : 1;
  for (let mi = 0; mi < menuCodes.length; mi++) {
    const mp = postings.get(menuCodes[mi]);
    if (!mp) continue;
    const pidx = mp.idx;
    for (let k = 0; k < pidx.length; k++) {
      const sIdx = pidx[k];
      if (scoreBuf[sIdx] === 0 && matchBuf[sIdx] === 0) touchedSecs[touchedSecCount++] = sIdx;
      scoreBuf[sIdx] += 16 * avgIdf;
    }
  }

  const qLen = queryTerms.length;
  let touchedNoteCount = 0;
  const topList: { secIdx: number; score: number; matched: number }[] = [];
  let minTopScore = -1;
  let minTopPos = 0;

  for (let k = 0; k < touchedSecCount; k++) {
    const si = touchedSecs[k];
    let sc = scoreBuf[si];
    const m = matchBuf[si];
    if (qLen > 1 && m === qLen) sc *= 1.45;
    if (sections[si].sectionIndex > 0 && m >= 2) sc *= 1.08;

    const ni = sections[si].noteIdx;
    if (noteBestSecIdx[ni] === -1) {
      touchedNotes[touchedNoteCount++] = ni;
      noteBestScore[ni] = sc;
      noteBestSecIdx[ni] = si;
    } else if (sc > noteBestScore[ni]) {
      noteBestScore[ni] = sc;
      noteBestSecIdx[ni] = si;
    }

    if (topLimit > 0) {
      if (topList.length < topLimit) {
        topList.push({ secIdx: si, score: sc, matched: m });
        if (topList.length === topLimit) {
          minTopPos = 0;
          minTopScore = topList[0].score;
          for (let j = 1; j < topLimit; j++) {
            if (topList[j].score < minTopScore) {
              minTopScore = topList[j].score;
              minTopPos = j;
            }
          }
        }
      } else if (sc > minTopScore) {
        topList[minTopPos] = { secIdx: si, score: sc, matched: m };
        minTopPos = 0;
        minTopScore = topList[0].score;
        for (let j = 1; j < topLimit; j++) {
          if (topList[j].score < minTopScore) {
            minTopScore = topList[j].score;
            minTopPos = j;
          }
        }
      }
    }

    scoreBuf[si] = 0;
    matchBuf[si] = 0;
  }

  // Phrase bonus ONLY on final top-K candidates (O(K) instead of O(1500))
  if (topLimit > 0 && topList.length) {
    const checkPhrase = phrase.length >= 4 && phrase.length <= 64 && qLen > 1;
    if (checkPhrase) {
      for (let i = 0; i < topList.length; i++) {
        const item = topList[i];
        if (item.matched >= Math.min(2, qLen) && sections[item.secIdx].norm.includes(phrase)) {
          item.score += 10 * avgIdf;
        }
      }
    }
    topList.sort((a, b) => b.score - a.score);
  }
  return { touchedNoteCount, topSections: topList };
}

export function clearSectionNoteBuffers(index: SectionSearchIndex, touchedNoteCount: number): void {
  const { touchedNotes, noteBestScore, noteBestSecIdx } = index;
  for (let k = 0; k < touchedNoteCount; k++) {
    const ni = touchedNotes[k];
    noteBestScore[ni] = 0;
    noteBestSecIdx[ni] = -1;
  }
}

export function buildSectionSnippet(raw: string, queryTerms: string[], normalizeText: (s: string) => string): string {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l !== "---" && !TABLE_SEP_RE.test(l));
  const hit = lines.find((l) => {
    const norm = normalizeText(l);
    return queryTerms.some((t) => norm.includes(t));
  }) ?? lines[0] ?? raw;
  return hit.replace(/\s+/g, " ").trim().slice(0, 240);
}

// ============================================================================
// 5. Multi-Signal Reciprocal Rank Fusion (RRF) Helpers
// ============================================================================

export type RrfSignalInput = {
  name: string;
  weight: number;
  rankedIds: number[];
};

/** Standard weighted Reciprocal Rank Fusion: sum(weight / (k + rank_1based)). */
export function computeRrfScores(signals: RrfSignalInput[], k = 40): Map<number, number> {
  const acc = new Map<number, number>();
  for (let si = 0; si < signals.length; si++) {
    const { weight, rankedIds } = signals[si];
    if (!weight || !rankedIds.length) continue;
    for (let rank = 0; rank < rankedIds.length; rank++) {
      const id = rankedIds[rank];
      acc.set(id, (acc.get(id) ?? 0) + weight / (k + rank + 1));
    }
  }
  return acc;
}

/** Fast O(N * K) partial top-K extractor without sorting all N elements. */
export function topKIndices(scores: Float64Array | Float32Array, count: number, k: number, minVal = 0): number[] {
  const topIds: number[] = [];
  const topVals: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = scores[i];
    if (v <= minVal) continue;
    if (topIds.length < k) {
      let pos = topIds.length;
      while (pos > 0 && v > topVals[pos - 1]) {
        topIds[pos] = topIds[pos - 1];
        topVals[pos] = topVals[pos - 1];
        pos--;
      }
      topIds[pos] = i;
      topVals[pos] = v;
    } else if (v > topVals[k - 1]) {
      let pos = k - 1;
      while (pos > 0 && v > topVals[pos - 1]) {
        topIds[pos] = topIds[pos - 1];
        topVals[pos] = topVals[pos - 1];
        pos--;
      }
      topIds[pos] = i;
      topVals[pos] = v;
    }
  }
  return topIds;
}

// ============================================================================
// 6. O(1) Error-Message Lookup Index (vault/troubleshoot/ + vault/howto/)
// ============================================================================

export type ErrorLookupEntry = {
  errorText: string;
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  fixSnippet: string;
};

export type ErrorIndex = {
  entries: ErrorLookupEntry[];
  exactMap: Map<string, number[]>;
  tokenPostings: Map<string, Int32Array>;
  normTexts: string[];
  strippedTexts: string[];
};

const ERROR_QUOTE_GLOBAL_RE = /["“「]([^"”」\n]{6,180})["”」]/g;
const ERROR_SIGNAL_RE =
  /(?:ห้าม|ไม่สามารถ|ไม่พบ|ไม่พอ|ไม่เพียงพอ|ไม่ถูกต้อง|ปิดงวด|ล็อก|เกิน|ซ้ำ|ติดลบ|หมดอายุ|ผิดพลาด|เตือน|แจ้งเตือน|มากกว่า|ต้องไม่|กรุณา|ยกเลิกแล้ว|ปิดการใช้งาน|ปิดการรับ|ไม่อนุญาต|ไม่สมบูรณ์|น้อยกว่า|สูงกว่า|ปิดใช้งาน|ยังไม่|รูปแบบวันที่|ไม่ได้กำหนด|ไม่มีสิทธิ์|หมดเวลา|สาธิต|ไม่สำเร็จ|ไม่ตรง|ขาด|เด้ง|🔒)/;
const PLACEHOLDER_RE = /<[^>]{1,24}>|\[\s*<[^>]{1,24}>\s*\]|\bDD\/MM\/YYYY\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\.{2,}|…|\([^)]{1,40}\)/gi;
const NON_WORD_SPACE_RE = /[^\u0E00-\u0E7Fa-z0-9]+/gi;

function canonicalErrorKey(s: string, normalizeText: (v: string) => string): string {
  return normalizeText(s)
    .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/gu, "")
    .replace(NON_WORD_SPACE_RE, " ")
    .trim();
}

function strippedTemplateKey(s: string, normalizeText: (v: string) => string): string {
  return normalizeText(s)
    .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/gu, "")
    .replace(PLACEHOLDER_RE, " ")
    .replace(/\b[A-Z0-9_-]{3,16}\b/g, " ")
    .replace(NON_WORD_SPACE_RE, " ")
    .trim();
}

function extractNoteFixFallback(note: RetrievalNoteInput): string {
  const clean = note.cleanBody ?? note.body;
  const secs = clean.split(/\n(?=## )/);
  const fixSec = secs.find((s) => /^##\s+(?:วิธีตรวจ|วิธีแก้|การแก้|ขั้นตอน|แนวทาง|กรณีต้อง)/.test(s.trimStart()));
  const target = fixSec ?? secs[1] ?? clean;
  const lines = target
    .split("\n")
    .map((l) => cleanFactLine(l))
    .filter((l) => l.length >= 12 && !l.startsWith("#") && !l.startsWith("!") && !/^[🎬▶🖼🔗]/.test(l) && !l.endsWith(":"));
  return clipFact(lines.slice(0, 2).join(" "), 260);
}

function extractInlineFix(lines: string[], lineIdx: number, fallbackFix: string): string {
  const cur = lines[lineIdx] ?? "";
  const dashIdx = cur.indexOf("—");
  if (dashIdx !== -1) {
    const after = cleanFactLine(cur.slice(dashIdx + 1));
    if (after.length >= 12) return clipFact(after, 260);
  }
  // Check immediately following lines for "- **วิธีแก้ไข:**" or "- **สาเหตุ:**"
  const gathered: string[] = [];
  for (let j = lineIdx + 1; j < Math.min(lines.length, lineIdx + 8); j++) {
    const nxt = lines[j].trim();
    if (!nxt) continue;
    if (nxt.startsWith("## ")) break;
    if (/(?:วิธีแก้|สาเหตุ|แนวทาง|คำแนะนำ)/.test(nxt) || /^\d+\.\s+/.test(nxt)) {
      gathered.push(cleanFactLine(nxt));
      if (gathered.length >= 2) break;
    }
  }
  if (gathered.length) return clipFact(gathered.join(" "), 260);
  return fallbackFix;
}

export function buildErrorIndex(
  notes: RetrievalNoteInput[],
  tokenize: (normText: string) => string[],
  normalizeText: (s: string) => string,
): ErrorIndex {
  const entries: ErrorLookupEntry[] = [];
  const exactMap = new Map<string, number[]>();
  const normTexts: string[] = [];
  const strippedTexts: string[] = [];
  const tempPostings = new Map<string, Set<number>>();
  const seenNoteMsg = new Set<string>();

  const registerKey = (key: string, entryIdx: number) => {
    if (!key || key.length < 4) return;
    let list = exactMap.get(key);
    if (!list) {
      list = [];
      exactMap.set(key, list);
    }
    if (!list.includes(entryIdx)) list.push(entryIdx);
  };

  const addEntry = (
    errorText: string,
    note: RetrievalNoteInput,
    fixSnippet: string,
    extraExactKeys: string[] = [],
  ) => {
    const cleanText = errorText.replace(/\s+/g, " ").trim();
    const normKey = canonicalErrorKey(cleanText, normalizeText);
    if (!normKey || normKey.length < 4) return;
    const dedup = `${note.slug}\0${normKey}`;
    if (seenNoteMsg.has(dedup)) return;
    seenNoteMsg.add(dedup);

    const stripped = strippedTemplateKey(cleanText, normalizeText);
    const entryIdx = entries.length;
    entries.push({
      errorText: cleanText,
      slug: note.slug,
      title: note.title,
      folder: note.folder,
      audience: note.audience,
      fixSnippet: fixSnippet || note.tldr || note.title,
    });
    normTexts.push(normKey);
    strippedTexts.push(stripped);

    registerKey(normKey, entryIdx);
    if (stripped && stripped !== normKey) registerKey(stripped, entryIdx);
    // Also index prefix before colon / parentheses so "ล็อกหน่วยต้นทุนแล้ว" matches "🔒 ล็อกหน่วยต้นทุนแล้ว (...)" in O(1)
    const beforeParen = canonicalErrorKey(cleanText.split(/[(:]/)[0] ?? "", normalizeText);
    if (beforeParen.length >= 6 && beforeParen !== normKey) registerKey(beforeParen, entryIdx);
    for (const ek of extraExactKeys) registerKey(canonicalErrorKey(ek, normalizeText), entryIdx);

    const toks = new Set([
      ...tokenize(normKey),
      ...tokenize(stripped),
      ...(note.folder === "troubleshoot" ? tokenize(note.haystack.title) : []),
    ]);
    for (const t of toks) {
      let set = tempPostings.get(t);
      if (!set) {
        set = new Set();
        tempPostings.set(t, set);
      }
      set.add(entryIdx);
    }
  };

  // Prioritize troubleshoot -> howto -> start/faq -> dev (strictly filtered by audience on lookup!)
  const folderRank = (f: string) =>
    f === "troubleshoot" ? 0 : f === "howto" ? 1 : f === "faq" || f === "start" ? 2 : 3;
  const orderedNotes = [...notes].sort((a, b) => folderRank(a.folder) - folderRank(b.folder) || a.slug.localeCompare(b.slug));

  for (const note of orderedNotes) {
    // Skip directory hubs (e.g. ts-overview) so concrete troubleshoot/howto guides win directly
    if (note.slug === "ts-overview" || note.slug.endsWith("-overview") || note.slug.startsWith("menu-cat")) continue;
    // Index troubleshoot, howto, faq, start, and dev notes that document exact runtime validation strings
    if (!["troubleshoot", "howto", "faq", "start", "doctypes", "api"].includes(note.folder)) continue;
    const clean = note.cleanBody ?? note.body;
    const lines = clean.split("\n");
    const fallbackFix = extractNoteFixFallback(note);
    let inCode = false;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (line.trim().startsWith("```")) {
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;

      for (const m of line.matchAll(ERROR_QUOTE_GLOBAL_RE)) {
        const quoted = (m[1] ?? "").trim();
        if (quoted.length < 6 || quoted.length > 170) continue;
        if (quoted.includes(" > ")) continue; // skip menu breadcrumbs
        if (!/[\u0E00-\u0E7F]/.test(quoted)) continue; // Thai error/warning messages
        const hasInlineExplain = note.folder === "troubleshoot" && line.includes("—");
        if (!hasInlineExplain && !ERROR_SIGNAL_RE.test(quoted)) continue;

        const fix = extractInlineFix(lines, li, fallbackFix);
        addEntry(quoted, note, fix);
      }

      // Also capture explicit bolded rule/warning labels in troubleshoot & howto (e.g. **ห้ามขายสินค้าติดลบ**, **ห้ามขายสินค้าต่ำกว่าทุน**)
      if (note.folder === "troubleshoot" || note.folder === "howto" || note.folder === "start") {
        for (const bm of line.matchAll(/\*\*([^*]{6,90})\*\*/g)) {
          const phrase = (bm[1] ?? "").trim();
          if (phrase.includes(" > ") || phrase.includes('"') || !/[\u0E00-\u0E7F]/.test(phrase)) continue;
          if (/^(?:ห้าม|เตือนเมื่อ|ล็อก|ปิดงวด|ยอดมัดจำ|ไม่มีสิทธิ์)/.test(phrase)) {
            const fix = extractInlineFix(lines, li, fallbackFix);
            addEntry(phrase, note, fix);
          }
        }
      }
    }

    // Index troubleshoot aliases as O(1) error shortcuts pointing to their canonical troubleshooting guide
    if (note.folder === "troubleshoot") {
      for (const alias of note.aliases) {
        const a = alias.trim();
        if (a.length >= 5 && /[\u0E00-\u0E7F]/.test(a)) {
          addEntry(a, note, fallbackFix);
        }
      }
    }
  }

  const tokenPostings = new Map<string, Int32Array>();
  for (const [tok, set] of tempPostings) {
    tokenPostings.set(tok, Int32Array.from(set));
  }

  return { entries, exactMap, tokenPostings, normTexts, strippedTexts };
}

export function queryErrorIndex(
  index: ErrorIndex,
  query: string,
  filter: AudienceFilter,
  limit: number,
  tokenize: (normText: string) => string[],
  normalizeText: (s: string) => string,
): ErrorLookupEntry[] {
  const maxItems = Math.min(20, Math.max(1, limit));
  const raw = query.trim();
  if (!raw) return [];

  const qNorm = canonicalErrorKey(raw, normalizeText);
  const qStripped = strippedTemplateKey(raw, normalizeText);
  const scoreMap = new Map<number, number>();
  const exactHits = new Set<number>();

  const bump = (idx: number, delta: number) => {
    const entry = index.entries[idx];
    if (!entry || !matchesAudience(entry.audience, filter)) return;
    scoreMap.set(idx, (scoreMap.get(idx) ?? 0) + delta);
  };

  // 1. O(1) exact hash hits
  for (const idx of index.exactMap.get(qNorm) ?? []) {
    if (matchesAudience(index.entries[idx].audience, filter)) {
      exactHits.add(idx);
      bump(idx, 120);
    }
  }
  if (qStripped && qStripped !== qNorm) {
    for (const idx of index.exactMap.get(qStripped) ?? []) {
      if (matchesAudience(index.entries[idx].audience, filter)) {
        exactHits.add(idx);
        bump(idx, 100);
      }
    }
  }

  // 2. Inverted token posting lookup (use stripped template terms so concrete IDs/dates do not dilute coverage)
  const strippedToks = tokenize(qStripped);
  const qTerms = [...new Set(strippedToks.length ? strippedToks : tokenize(qNorm))];
  const qualified = new Set<number>(exactHits);

  if (qTerms.length) {
    const matchCounts = new Map<number, number>();
    const rawTokenScores = new Map<number, number>();
    for (const t of qTerms) {
      const posting = index.tokenPostings.get(t);
      if (!posting) continue;
      const idf = Math.log(1 + index.entries.length / (1 + posting.length));
      for (let k = 0; k < posting.length; k++) {
        const ei = posting[k];
        const entry = index.entries[ei];
        if (!matchesAudience(entry.audience, filter)) continue;
        matchCounts.set(ei, (matchCounts.get(ei) ?? 0) + 1);
        const add = 10 * idf;
        rawTokenScores.set(ei, (rawTokenScores.get(ei) ?? 0) + add);
        bump(ei, add);
      }
    }

    // Strict relevance & coverage gate BEFORE applying folder authority bonus (prevents out-of-domain Thai traps)
    for (const [ei, mCount] of matchCounts) {
      const normText = index.normTexts[ei];
      const stripped = index.strippedTexts[ei];
      const hasNormSubstr =
        qNorm.length >= 6 &&
        normText.length >= 6 &&
        ((normText.includes(qNorm) && qNorm.length >= 8) || (qNorm.includes(normText) && normText.length >= 8));
      const hasStrippedSubstr =
        qStripped.length >= 6 &&
        stripped.length >= 6 &&
        ((stripped.includes(qStripped) && qStripped.length >= 8) || (qStripped.includes(stripped) && stripped.length >= 8));

      const cov = mCount / qTerms.length;
      const tokScore = rawTokenScores.get(ei) ?? 0;
      const passesCoverage =
        exactHits.has(ei) ||
        hasNormSubstr ||
        hasStrippedSubstr ||
        (qTerms.length >= 2 ? mCount >= 2 && cov >= 0.45 && tokScore >= 18 : tokScore >= 18);

      if (!passesCoverage) continue;
      qualified.add(ei);

      if (hasNormSubstr) bump(ei, 45);
      else if (hasStrippedSubstr) bump(ei, 35);

      if (mCount === qTerms.length) bump(ei, 25);
      else if (cov >= 0.6) bump(ei, 10);

      const folder = index.entries[ei].folder;
      if (folder === "troubleshoot") bump(ei, 12);
      else if (folder === "howto") bump(ei, 5);
    }
  }

  // Only emit entries that passed exact, substring, or strict multi-term coverage gating
  const ranked = [...qualified]
    .map((ei): [number, number] => [ei, scoreMap.get(ei) ?? 0])
    .filter(([, sc]) => sc >= 18)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);

  const out: ErrorLookupEntry[] = [];
  const seenText = new Set<string>();
  const slugCounts = new Map<string, number>();

  for (const [ei] of ranked) {
    const entry = index.entries[ei];
    const key = `${entry.slug}\0${index.normTexts[ei]}`;
    if (seenText.has(key)) continue;
    const sc = slugCounts.get(entry.slug) ?? 0;
    if (sc >= 2 && ranked.length > maxItems) continue;
    seenText.add(key);
    slugCounts.set(entry.slug, sc + 1);
    out.push(entry);
    if (out.length >= maxItems) break;
  }
  return out;
}

// ============================================================================
// 7. Temporal / Recency Metadata Extractor (single git log + fs.stat fallback)
// ============================================================================

export type NoteRecencyMeta = {
  updatedAt: string;
  updatedTs: number;
  lastCommit: string;
};

export type NoteRecency = {
  slug: string;
  title: string;
  folder: string;
  audience: Audience;
  updatedAt: string;
  updatedTs: number;
  lastCommit: string;
  tldr: string;
};

export function extractVaultRecencyMap(
  vaultDir: string,
  notes: Iterable<{ slug: string; folder: string }>,
  fallbackCommit: string,
  fallbackTs: number,
): Map<string, NoteRecencyMeta> {
  const result = new Map<string, NoteRecencyMeta>();
  const targetList = [...notes];
  const slugSet = new Set(targetList.map((n) => n.slug));
  if (!slugSet.size) return result;

  // 1. Single fast read-only git log pass on local vault/ (--no-optional-locks)
  try {
    const repoCwd = path.dirname(vaultDir);
    const out = execFileSync(
      "git",
      ["--no-optional-locks", "log", "--format=__COMMIT__ %ct %h", "--name-only", "--", "vault/"],
      {
        cwd: repoCwd,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 4000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    let curTs = 0;
    let curIso = "";
    let curHash = "";
    for (const rawLine of out.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("__COMMIT__ ")) {
        const parts = line.split(" ");
        const sec = Number(parts[1]);
        curTs = Number.isFinite(sec) && sec > 0 ? sec * 1000 : 0;
        curIso = curTs ? new Date(curTs).toISOString() : "";
        curHash = parts[2] ?? "";
        continue;
      }
      if (!curTs || !line.endsWith(".md")) continue;
      const slug = path.posix.basename(line.replace(/\\/g, "/"), ".md").toLowerCase();
      if (!slugSet.has(slug) || result.has(slug)) continue;
      result.set(slug, { updatedAt: curIso, updatedTs: curTs, lastCommit: curHash });
      if (result.size === slugSet.size) break;
    }
  } catch {
    // Graceful fallback when git is unavailable (e.g. production deploy without .git or temp test workspace)
  }

  // 2. Fallback to file mtime or bundle builtAt for any notes not found in git history
  const defCommit = fallbackCommit || "local";
  for (const n of targetList) {
    if (result.has(n.slug)) continue;
    let ts = fallbackTs;
    try {
      const relPath = n.folder === "root" ? `${n.slug}.md` : path.join(n.folder, `${n.slug}.md`);
      const st = fs.statSync(path.join(vaultDir, relPath));
      if (st.mtimeMs > 0) ts = Math.round(st.mtimeMs);
    } catch {
      // keep fallbackTs (e.g. vault loaded from BC_VAULT_PACK_FILE)
    }
    result.set(n.slug, {
      updatedAt: new Date(ts).toISOString(),
      updatedTs: ts,
      lastCommit: defCommit,
    });
  }

  return result;
}

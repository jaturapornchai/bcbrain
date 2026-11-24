import fs from "node:fs";
import path from "node:path";
import { sanitizeMcpArg } from "./mcp-events";

export type GapReason = "abstain" | "zero_hit" | "low_conf";
export type GapAudience = "all" | "user" | "dev";

export type GapInput = {
  tool: string;
  query: string;
  audience: GapAudience;
  reason: GapReason;
  topScore?: number;
};

export type GapEntry = {
  query: string;
  audience: GapAudience;
  tool: string;
  tools: string[];
  reason: GapReason;
  reasons: Record<GapReason, number>;
  count: number;
  topScore: number | null;
  firstSeen: string;
  lastSeen: string;
};

export type GapReport = {
  totalRecorded: number;
  uniqueQueries: number;
  maxEntries: number;
  fileLoggingEnabled: boolean;
  byReason: Record<GapReason, number>;
  entries: GapEntry[];
};

type GapStore = {
  totalRecorded: number;
  byReason: Record<GapReason, number>;
  entries: Map<string, GapEntry>;
};

const MAX_UNIQUE_QUERIES = 256;
const GLOBAL_KEY = "__bcGapLog_v1" as const;

function emptyReasons(): Record<GapReason, number> {
  return { abstain: 0, zero_hit: 0, low_conf: 0 };
}

function store(): GapStore {
  const g = globalThis as unknown as Record<string, GapStore | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      totalRecorded: 0,
      byReason: emptyReasons(),
      entries: new Map<string, GapEntry>(),
    };
  }
  return g[GLOBAL_KEY]!;
}

function resolveGapLogFile(): string | null {
  const raw = process.env.BC_GAP_LOG_FILE?.trim();
  return raw ? raw : null;
}

function appendJsonlNonBlocking(logFile: string, record: Record<string, unknown>): void {
  try {
    const line = `${JSON.stringify(record)}\n`;
    const dir = path.dirname(logFile);
    void fs.promises
      .mkdir(dir, { recursive: true })
      .then(() => fs.promises.appendFile(logFile, line, "utf8"))
      .catch(() => {
        // Non-blocking best-effort append: safe in read-only systemd environments.
      });
  } catch {
    // Ignore synchronous path/serialization edge cases safely.
  }
}

/**
 * Record a sanitized zero-hit, low-confidence, or abstained query into the bounded in-memory ring map
 * (max 256 unique queries) and optionally append a sanitized JSONL line when BC_GAP_LOG_FILE is set.
 */
export function recordGap(input: GapInput): GapEntry | null {
  const sanitizedQuery = sanitizeMcpArg(String(input.query ?? ""));
  if (!sanitizedQuery) return null;

  const tool = sanitizeMcpArg(String(input.tool ?? "unknown")) || "unknown";
  const audience: GapAudience =
    input.audience === "user" || input.audience === "dev" ? input.audience : "all";
  const reason: GapReason =
    input.reason === "abstain" || input.reason === "zero_hit" || input.reason === "low_conf"
      ? input.reason
      : "low_conf";
  const topScore =
    typeof input.topScore === "number" && Number.isFinite(input.topScore)
      ? Math.round(input.topScore * 100) / 100
      : null;

  const s = store();
  const nowIso = new Date().toISOString();
  const key = `${audience}::${sanitizedQuery.toLowerCase()}`;

  s.totalRecorded += 1;
  s.byReason[reason] += 1;

  const existing = s.entries.get(key);
  let entry: GapEntry;
  if (existing) {
    existing.count += 1;
    existing.tool = tool;
    if (!existing.tools.includes(tool) && existing.tools.length < 12) {
      existing.tools.push(tool);
    }
    existing.reason = reason;
    existing.reasons[reason] += 1;
    if (topScore !== null) existing.topScore = topScore;
    existing.lastSeen = nowIso;
    // Refresh insertion order so ring eviction drops the stalest entry first.
    s.entries.delete(key);
    s.entries.set(key, existing);
    entry = existing;
  } else {
    if (s.entries.size >= MAX_UNIQUE_QUERIES) {
      const oldestKey = s.entries.keys().next().value;
      if (oldestKey !== undefined) s.entries.delete(oldestKey);
    }
    const reasons = emptyReasons();
    reasons[reason] = 1;
    entry = {
      query: sanitizedQuery,
      audience,
      tool,
      tools: [tool],
      reason,
      reasons,
      count: 1,
      topScore,
      firstSeen: nowIso,
      lastSeen: nowIso,
    };
    s.entries.set(key, entry);
  }

  const logFile = resolveGapLogFile();
  if (logFile) {
    appendJsonlNonBlocking(logFile, {
      ts: nowIso,
      tool,
      audience,
      reason,
      query: sanitizedQuery,
      ...(topScore !== null ? { topScore } : {}),
    });
  }

  return { ...entry, tools: [...entry.tools], reasons: { ...entry.reasons } };
}

/** Return aggregated sanitized gap entries sorted by frequency descending, then recency descending. */
export function getGapReport(limit = 50): GapReport {
  const s = store();
  const safeLimit = Math.max(1, Math.min(MAX_UNIQUE_QUERIES, Math.floor(Number(limit) || 50)));
  const sorted = [...s.entries.values()]
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, safeLimit)
    .map((e) => ({
      ...e,
      tools: [...e.tools],
      reasons: { ...e.reasons },
    }));

  return {
    totalRecorded: s.totalRecorded,
    uniqueQueries: s.entries.size,
    maxEntries: MAX_UNIQUE_QUERIES,
    fileLoggingEnabled: resolveGapLogFile() !== null,
    byReason: { ...s.byReason },
    entries: sorted,
  };
}

/** Clear all in-memory gap records (does not delete any external JSONL log file). */
export function clearGaps(): void {
  const s = store();
  s.entries.clear();
  s.totalRecorded = 0;
  s.byReason = emptyReasons();
}

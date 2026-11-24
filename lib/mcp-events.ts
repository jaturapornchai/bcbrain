export type McpToolName =
  | "quick_answer"
  | "batch_ask"
  | "lookup_menu"
  | "batch_read"
  | "ask_brain"
  | "search_brain"
  | "traverse_brain"
  | "read_note"
  | "list_notes"
  | "find_media"
  | "lookup_error"
  | "search_sections"
  | "get_facts"
  | "whats_new"
  | "verify_reference";

export type McpEventHit = {
  slug: string;
  title: string;
  folder: string;
};

export type McpCallEvent = {
  id: number;
  ts: string;
  time: string;
  tool: McpToolName;
  audience: "all" | "user" | "dev";
  arg: string;
  hits: McpEventHit[];
  totalHits: number;
  ms: number;
};

type Subscriber = (ev: McpCallEvent) => void;

type BusState = {
  seq: number;
  history: McpCallEvent[];
  subs: Set<Subscriber>;
};

const MAX_HISTORY = 40;
const MAX_SUBS = 128;
const MAX_ARG_LEN = 96;

const GLOBAL_KEY = "__bcMcpEventBus_v1" as const;

function bus(): BusState {
  const g = globalThis as unknown as Record<string, BusState | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { seq: 0, history: [], subs: new Set() };
  }
  return g[GLOBAL_KEY]!;
}

const TH_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Strip control chars, credentials, tokens, emails, IPs, and phone numbers before broadcasting UI telemetry. */
export function sanitizeMcpArg(raw: string): string {
  const clean = raw
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(
      /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|rediss|amqps?|http|https):\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/gi,
      "[REDACTED_URI]",
    )
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|bcmcp_ro_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
      "[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/(?:password|passwd|pwd|secret|token|api_?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/\b0[689]\d[- ]?\d{3}[- ]?\d{4}\b/g, "[REDACTED_TEL]")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > MAX_ARG_LEN ? `${clean.slice(0, MAX_ARG_LEN)}…` : clean;
}

/** Record an MCP tool call into the ring buffer and fan out to live SSE subscribers. */
export function emitMcpEvent(input: {
  tool: McpToolName;
  audience: "all" | "user" | "dev";
  rawArg: string;
  hits: McpEventHit[];
  totalHits: number;
  ms: number;
}): McpCallEvent {
  const b = bus();
  const now = new Date();
  const ev: McpCallEvent = {
    id: ++b.seq,
    ts: now.toISOString(),
    time: TH_TIME.format(now),
    tool: input.tool,
    audience: input.audience,
    arg: sanitizeMcpArg(input.rawArg),
    hits: input.hits.slice(0, 6),
    totalHits: input.totalHits,
    ms: Math.round(input.ms * 10) / 10,
  };
  b.history.push(ev);
  if (b.history.length > MAX_HISTORY) b.history.splice(0, b.history.length - MAX_HISTORY);
  for (const sub of b.subs) {
    try {
      sub(ev);
    } catch {
      b.subs.delete(sub);
    }
  }
  return ev;
}

export function recentMcpEvents(limit = 15): McpCallEvent[] {
  const h = bus().history;
  return h.slice(Math.max(0, h.length - limit));
}

export function subscribeMcpEvents(fn: Subscriber): () => void {
  const b = bus();
  if (b.subs.size >= MAX_SUBS) {
    const oldest = b.subs.values().next().value;
    if (oldest) b.subs.delete(oldest);
  }
  b.subs.add(fn);
  return () => {
    b.subs.delete(fn);
  };
}

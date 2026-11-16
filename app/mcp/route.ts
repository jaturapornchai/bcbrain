import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { RELATION_TYPES } from "@/lib/groups";
import { emitMcpEvent, type McpEventHit, type McpToolName } from "@/lib/mcp-events";
import {
  connectedNeighbors,
  excerpt,
  getNote,
  listVaultRows,
  search,
  terms,
  traverseGraph,
  updatedAt,
  vaultFolders,
  type Note,
} from "@/lib/vault";

export const dynamic = "force-dynamic";

const INSTRUCTIONS = `BC Brain = dual-audience knowledge base of the BC Ai Account product suite (Thai accounting/ERP for SMEs: sales, purchasing, inventory, AR/AP, cash/bank/cheques, fixed assets, GL, VAT/WHT, reports + add-on systems: POS, AutoCare, e-Tax, WMS, TMS, Procure, CRM, LINE OA, Market, Dashboard, MonitorMap, WorkMonitor, Company Brain), verified against the real source code.

Choose the mode that matches the caller's role before answering:
(a) Developers / building integrations / writing SQL / checking schemas, trans_flag, GL Dr/Cr, API or architecture:
    - First call read_note("playbook-dev") and follow its rules.
    - Pass audience: "dev" to ask_brain, search_brain, traverse_brain, and list_notes (or audience: "all" when business workflow context is also needed).
    - Use traverse_brain to trace multi-hop relationships (e.g. SQL query -> schema tables -> doctype flags -> GL rules) or find shortest paths between two slugs.
    - Provide exact table names, columns, SQL types, trans_flag values, API/MCP contracts, and valid PostgreSQL SELECT/WITH queries using NUMERIC (no float/double) and COALESCE(last_status, 0) = 0 where applicable.
(b) General users / call-center / pre-sale assistants:
    - First call read_note("playbook-call-center") for usage/support or read_note("playbook-sales") for pre-sale questions, and follow it.
    - ALWAYS pass audience: "user" to ask_brain, search_brain, traverse_brain, and list_notes.
    - For menu lookups or 4-digit menu codes (1001–9070 across 734 screens) or legacy dotted codes (e.g. 1.3.1, 4.13), check menu-catalog-overview and menu-cat-1-setup .. menu-cat-9-gl (or search the 4-digit/dotted code directly).
    - Answer in plain, easy-to-understand Thai step by step without code, SQL, table names, or developer jargon. Always state BOTH the exact Thai menu breadcrumb path AND its 4-digit menu code (e.g. "เริ่มต้น > ตั้งค่าองค์กร พนักงาน และเอกสาร > กำหนดรายละเอียดบริษัท" (รหัสเมนู 1003)), exact button names, keyboard shortcuts (howto-screen-shortcuts-workbench), and on-screen messages.
    - When a user cannot find a menu, check the 4 product editions (Starter, Standard, Professional, Enterprise), the Feature Switchboard (รหัสเมนู 1002), and user-group permissions (ts-menu-missing-switchboard, howto-admin-system-management).
    - Never quote prices, packages, discounts, contracts, or support hours: hand off to the human sales team. For tax/legal interpretation, explain only what the system does and advise consulting the customer's auditor or the Revenue Department.

General rules: answer only from note content; if the notes do not cover it, say so honestly without guessing. Never ask for or expose passwords, tokens, or secrets. Slugs are internal references; do not show them to general users unless asked.`;

const audienceSchema = z
  .enum(["all", "user", "dev"])
  .optional()
  .describe('Filter by audience zone: "user" (plain Thai guides/sales), "dev" (schema/SQL/API/architecture), or "all" (default).');

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function noteText(n: Note, body = n.body): string {
  const out = n.outEdges.map((e) => `[[${e.slug}]] (${e.rel})`).join(" ") || "-";
  const inn = n.inEdges.map((e) => `[[${e.slug}]] (${e.rel})`).join(" ") || "-";
  return [
    `# ${n.title}`,
    `slug: ${n.slug} | folder: ${n.folder} | audience: ${n.audience} | tags: ${n.tags.join(", ")}`,
    "",
    body.trim(),
    "",
    `links: ${out}`,
    `backlinks: ${inn}`,
  ].join("\n");
}

const ANNOTATIONS = { readOnlyHint: true, openWorldHint: false }; // clients may skip the approval prompt for read-only tools

const ASK_INPUT = {
  question: z.string().min(2).max(500),
  audience: audienceSchema,
};

const SEARCH_INPUT = {
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(20).optional(),
  audience: audienceSchema,
};

const TRAVERSE_INPUT = {
  slug: z.string().min(1).max(120),
  to_slug: z.string().min(1).max(120).optional(),
  depth: z.number().int().min(1).max(3).optional(),
  direction: z.enum(["both", "out", "in"]).optional(),
  relation: z.enum(RELATION_TYPES).optional(),
  folder: z.string().max(40).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  audience: audienceSchema,
};

const READ_INPUT = {
  slug: z.string().min(1).max(120),
};

const LIST_INPUT = {
  folder: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
  audience: audienceSchema,
};

function buildServer() {
  const server = new McpServer(
    { name: "bcbrain", version: "2.0.0" },
    {
      instructions: `${INSTRUCTIONS}
Knowledge last updated: ${updatedAt} (Thai time).`,
    },
  );
  const emit = (
    tool: McpToolName,
    audience: "all" | "user" | "dev",
    rawArg: string,
    hits: McpEventHit[],
    totalHits: number,
    t0: number,
  ) => {
    const ms = performance.now() - t0;
    console.log(`[mcp] tool=${tool} audience=${audience} hits=${totalHits} ms=${ms.toFixed(1)}`);
    emitMcpEvent({ tool, audience, rawArg, hits, totalHits, ms });
  };
  const folders =
    vaultFolders().join(", ") ||
    "root, playbook, start, howto, troubleshoot, faq, reports, systems, glossary, sales, dev-playbook, schema, queries, api, doctypes, architecture";

  server.registerTool(
    "ask_brain",
    {
      title: "Ask the BC brain",
      description:
        "Answer a user or developer question (Thai or English) from the BC knowledge base. Pass audience: 'user' for plain-Thai call-center/sales answers, 'dev' for schema/SQL/API/architecture, or 'all' (default). Returns up to 4 most relevant notes (long notes trimmed to matching sections).",
      inputSchema: ASK_INPUT,
      annotations: ANNOTATIONS,
    },
    async ({ question, audience }) => {
      const t0 = performance.now();
      const filter = audience ?? "all";
      const hits = search(question, 4, filter);
      if (!hits.length) {
        emit("ask_brain", filter, question, [], 0, t0);
        return text(`No matching notes (audience=${filter}). Try other keywords (Thai or SQL/API identifiers) or list_notes.`);
      }
      const ts = terms(question);
      // ponytail: fixed budget ~24k chars total; first hit gets more room since it is usually the answer
      const parts = hits.map((h, i) => {
        const n = getNote(h.slug)!;
        return noteText(n, excerpt(n.body, ts, i === 0 ? 9000 : 5000));
      });
      const graphCtx = connectedNeighbors(
        hits.map((h) => h.slug),
        filter,
        6,
      );
      const ctxBlock = graphCtx.length
        ? `\n\n---\n\n## Connected Graph Context (1-hop — use read_note or traverse_brain to inspect)\n${graphCtx
            .map((g) => `- [${g.rel}] ${g.slug} (${g.folder}) — ${g.title} (via ${g.via})`)
            .join("\n")}`
        : "";
      emit(
        "ask_brain",
        filter,
        question,
        hits.map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
        hits.length,
        t0,
      );
      return text(`Top ${hits.length} notes (audience=${filter}) for: ${question}\n\n${parts.join("\n\n---\n\n")}${ctxBlock}`);
    },
  );

  server.registerTool(
    "search_brain",
    {
      title: "Search notes",
      description:
        "Keyword search (Thai word segmentation + SQL table/identifier matching) across note titles, aliases, tags and bodies with BM25 length normalization. Supports audience filtering ('all' | 'user' | 'dev').",
      inputSchema: SEARCH_INPUT,
      annotations: ANNOTATIONS,
    },
    async ({ query, limit, audience }) => {
      const t0 = performance.now();
      const filter = audience ?? "all";
      const hits = search(query, limit ?? 8, filter);
      emit(
        "search_brain",
        filter,
        query,
        hits.slice(0, 6).map((h) => ({ slug: h.slug, title: h.title, folder: h.folder })),
        hits.length,
        t0,
      );
      return text(JSON.stringify(hits, null, 1));
    },
  );

  server.registerTool(
    "traverse_brain",
    {
      title: "Traverse knowledge graph",
      description:
        "Follow typed synapses 1–3 hops from a note (or find the shortest graph path to to_slug). Respects audience isolation ('all' | 'user' | 'dev').",
      inputSchema: TRAVERSE_INPUT,
      annotations: ANNOTATIONS,
    },
    async ({ slug, to_slug, depth, direction, relation, folder, limit, audience }) => {
      const t0 = performance.now();
      const filter = audience ?? "all";
      const rawArg = to_slug ? `${slug} → ${to_slug}` : `${slug} (depth=${depth ?? 2}${relation ? `, ${relation}` : ""})`;
      const res = traverseGraph({ slug, toSlug: to_slug, depth, direction, relation, folder, limit, audience: filter });
      if (!res.start) {
        emit("traverse_brain", filter, rawArg, [], 0, t0);
        return text(`Start note "${slug}" not found in audience=${filter}.`);
      }
      const stepHits = (res.mode === "path" ? (res.path ?? []) : res.neighbors)
        .slice(0, 5)
        .map((s) => ({ slug: s.slug, title: s.title, folder: s.folder }));
      const eventHits = [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }, ...stepHits];
      const totalHits = res.mode === "path" ? (res.path?.length ?? 0) : res.neighbors.length;
      const header = `# Traverse from ${res.start.slug} | audience: ${filter} | ${res.start.title}`;
      if (res.mode === "path") {
        if (!res.target) {
          emit("traverse_brain", filter, rawArg, [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }], 0, t0);
          return text(`${header}\nTarget note "${to_slug}" not found in audience=${filter}.`);
        }
        if (!res.path?.length) {
          emit("traverse_brain", filter, rawArg, [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }], 0, t0);
          return text(
            res.start.slug === res.target.slug
              ? `${header}\nSame note (0 hops).`
              : `${header}\nNo path found to ${res.target.slug} within 6 hops (audience=${filter}).`,
          );
        }
        const chain = [
          res.start.slug,
          ...res.path.map((s) => `${s.direction === "out" ? `--[${s.rel}]-->` : `<--[${s.rel}]--`} ${s.slug}`),
        ].join(" ");
        const lines = res.path.map(
          (s) => `${s.hop}. ${s.slug} | ${s.folder} | ${s.audience} | [${s.rel}] via ${s.via} — ${s.title}`,
        );
        emit("traverse_brain", filter, rawArg, eventHits, totalHits, t0);
        return text(`${header}\nPath (${res.path.length} hops): ${chain}\n\n${lines.join("\n")}`);
      }

      if (!res.neighbors.length) {
        emit("traverse_brain", filter, rawArg, [{ slug: res.start.slug, title: res.start.title, folder: res.start.folder }], 0, t0);
        return text(`${header}\nNo matching connected notes (depth=${depth ?? 2}, audience=${filter}).`);
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
      emit("traverse_brain", filter, rawArg, eventHits, totalHits, t0);
      return text(`${header}\n\n${sections.join("\n\n")}`);
    },
  );

  server.registerTool(
    "read_note",
    {
      title: "Read a note",
      description: "Full markdown of one note by slug (also accepts [[slug]] or slug.md), plus audience, outgoing links and backlinks.",
      inputSchema: READ_INPUT,
      annotations: ANNOTATIONS,
    },
    async ({ slug }) => {
      const t0 = performance.now();
      const n = getNote(slug);
      if (n) {
        emit(
          "read_note",
          n.audience === "both" ? "all" : n.audience,
          slug,
          [{ slug: n.slug, title: n.title, folder: n.folder }],
          1,
          t0,
        );
        return text(noteText(n));
      }
      emit("read_note", "all", slug, [], 0, t0);
      const near = search(slug.replace(/[-_]/g, " "), 5).map((h) => h.slug);
      return text(`Note "${slug}" not found.${near.length ? ` Closest: ${near.join(", ")}.` : ""} Use search_brain or list_notes.`);
    },
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description: `Index of notes (slug, folder, audience, title, tags). Optional filter by folder (${folders}), tag, or audience ('all' | 'user' | 'dev').`,
      inputSchema: LIST_INPUT,
      annotations: ANNOTATIONS,
    },
    async ({ folder, tag, audience }) => {
      const t0 = performance.now();
      const f = folder?.toLowerCase();
      const t = tag?.toLowerCase();
      const filter = audience ?? "all";
      const matched = listVaultRows(filter).filter((n) => (!f || n.folder === f) && (!t || n.tags.some((x) => x.toLowerCase() === t)));
      const rawArg = [folder ? `folder=${folder}` : "", tag ? `tag=${tag}` : ""].filter(Boolean).join(" ") || "*";
      emit(
        "list_notes",
        filter,
        rawArg,
        matched.slice(0, 5).map((n) => ({ slug: n.slug, title: n.title, folder: n.folder })),
        matched.length,
        t0,
      );
      const rows = matched.map((n) => `${n.slug} | ${n.folder} | ${n.audience} | ${n.title} | ${n.tags.join(",")}`);
      return text(rows.join("\n") || "No notes match.");
    },
  );

  return server;
}

const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 180;
const RATE_MAX_KEYS = 4096;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Retry-After",
  "Cache-Control": "no-store",
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
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

function withHeaders(res: Response, extra?: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function handle(req: Request): Promise<Response> {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Rate limit exceeded (max 180 requests/minute). Please retry shortly." },
      },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Request body too large (max 32 KB)." } },
      { status: 413, headers: CORS_HEADERS },
    );
  }

  // public + read-only: no auth. stateless: fresh server + transport per request, JSON responses (no SSE session to keep alive)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  await buildServer().connect(transport);
  return withHeaders(await transport.handleRequest(req));
}

export { handle as GET, handle as POST, handle as DELETE };

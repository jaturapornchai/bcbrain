import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { excerpt, getNote, search, terms, updatedAt, vault, type Note } from "@/lib/vault";

export const dynamic = "force-dynamic";

const INSTRUCTIONS = `BC Brain = customer-facing knowledge base of the BC Ai Account product suite: Thai accounting/ERP for SMEs (sales, purchasing, inventory, AR/AP, cash/bank/cheques, fixed assets, general ledger, VAT/WHT, reports) plus add-on systems (POS, AutoCare, e-Tax, WMS, TMS, Procure, CRM, LINE OA, Dashboard and more). Notes are plain Thai for business owners, accountants and shop staff, verified against the real source code.
You act as a call-center or sales assistant for BC customers. Before your first answer in a conversation, read_note("playbook-call-center") for usage/support questions or read_note("playbook-sales") for pre-sale questions, and follow it.
Workflow: ask_brain with the customer's own words -> read_note for linked notes when needed -> answer in plain Thai, step by step, using menu paths and on-screen messages exactly as the notes write them.
Rules: answer only from note content; if the notes do not cover it, say so and offer a hand-off to human staff - never guess menus, buttons, features or causes. Never quote prices, packages, discounts, contracts or support hours: hand off to the sales team. Never ask for passwords or other secrets. For tax/legal interpretation explain only what the system does and advise the customer's auditor or the Revenue Department. Slugs are for you; do not show them to customers unless asked.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function noteText(n: Note, body = n.body): string {
  return [
    `# ${n.title}`,
    `slug: ${n.slug} | folder: ${n.folder} | tags: ${n.tags.join(", ")}`,
    "",
    body.trim(),
    "",
    `links: ${n.links.map((l) => `[[${l}]]`).join(" ") || "-"}`,
    `backlinks: ${n.backlinks.map((l) => `[[${l}]]`).join(" ") || "-"}`,
  ].join("\n");
}

function buildServer() {
  const server = new McpServer({ name: "bcbrain", version: "2.0.0" }, { instructions: `${INSTRUCTIONS}
Knowledge last updated: ${updatedAt} (Thai time).` });
  const log = (tool: string) => console.log(`[mcp] tool=${tool}`);
  const annotations = { readOnlyHint: true, openWorldHint: false }; // clients may skip the approval prompt for read-only tools
  const folders = [...new Set([...vault().values()].map((n) => n.folder))].sort().join(", ");

  server.registerTool(
    "ask_brain",
    {
      title: "Ask the BC brain",
      description:
        "Answer a customer question (Thai or English, their own words are fine) from the BC knowledge base. Returns the 4 most relevant notes (long notes trimmed to the sections that match, with a list of omitted sections) so you can answer from them.",
      inputSchema: { question: z.string().min(2).max(500) },
      annotations,
    },
    async ({ question }) => {
      log("ask_brain");
      const hits = search(question, 4);
      if (!hits.length) return text("No matching notes. Try other keywords (Thai or code identifiers) or list_notes.");
      const ts = terms(question);
      // ponytail: fixed budget ~24k chars total; first hit gets more room since it is usually the answer
      const parts = hits.map((h, i) => {
        const n = getNote(h.slug)!;
        return noteText(n, excerpt(n.body, ts, i === 0 ? 9000 : 5000));
      });
      return text(`Top ${hits.length} notes for: ${question}\n\n${parts.join("\n\n---\n\n")}`);
    },
  );

  server.registerTool(
    "search_brain",
    {
      title: "Search notes",
      description: "Keyword search (Thai word segmentation supported) across note titles, aliases, tags and bodies. Returns slug, title, score and a snippet.",
      inputSchema: { query: z.string().min(1).max(300), limit: z.number().int().min(1).max(20).optional() },
      annotations,
    },
    async ({ query, limit }) => {
      log("search_brain");
      return text(JSON.stringify(search(query, limit ?? 8), null, 1));
    },
  );

  server.registerTool(
    "read_note",
    {
      title: "Read a note",
      description: "Full markdown of one note by slug (also accepts [[slug]] or slug.md), plus its outgoing links and backlinks.",
      inputSchema: { slug: z.string().min(1).max(120) },
      annotations,
    },
    async ({ slug }) => {
      log("read_note");
      const n = getNote(slug);
      if (n) return text(noteText(n));
      const near = search(slug.replace(/[-_]/g, " "), 5).map((h) => h.slug);
      return text(`Note "${slug}" not found.${near.length ? ` Closest: ${near.join(", ")}.` : ""} Use search_brain or list_notes.`);
    },
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description: `Index of notes (slug, title, folder, tags). Optional filter by folder (${folders}) or tag.`,
      inputSchema: { folder: z.string().max(40).optional(), tag: z.string().max(40).optional() },
      annotations,
    },
    async ({ folder, tag }) => {
      log("list_notes");
      const f = folder?.toLowerCase();
      const t = tag?.toLowerCase();
      const rows = [...vault().values()]
        .filter((n) => (!f || n.folder === f) && (!t || n.tags.some((x) => x.toLowerCase() === t)))
        .map((n) => `${n.slug} | ${n.folder} | ${n.title} | ${n.tags.join(",")}`);
      return text(rows.join("\n") || "No notes match.");
    },
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  // public + read-only: no auth. stateless: fresh server + transport per request, JSON responses (no SSE session to keep alive)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await buildServer().connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };

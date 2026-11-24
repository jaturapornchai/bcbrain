export type OpenApiSpec = Record<string, unknown>;

const AUDIENCE_PARAM = {
  name: "audience",
  in: "query",
  required: false,
  description:
    'Audience zone isolation filter: "user" (plain Thai guides/sales, zero SQL/code), "dev" (schema/SQL/API/architecture), or "all"/"both". Defaults to "user" on REST endpoints.',
  schema: { type: "string", enum: ["user", "dev", "all", "both"], default: "user" },
} as const;

const RATE_LIMIT_RESP = {
  description: "Rate limit exceeded (max 300 requests/minute per IP).",
  headers: {
    "Retry-After": {
      description: "Seconds to wait before retrying.",
      schema: { type: "integer" },
    },
  },
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean", const: false },
          error: { type: "string" },
        },
        required: ["ok", "error"],
      },
    },
  },
} as const;

const NOT_MODIFIED_RESP = {
  description: "Not Modified (ETag matched If-None-Match).",
} as const;

let cachedSpec: OpenApiSpec | null = null;

export function getOpenApiSpec(): OpenApiSpec {
  if (cachedSpec) return cachedSpec;

  cachedSpec = {
    openapi: "3.1.0",
    info: {
      title: "BC Brain API & MCP Server",
      version: "3.0.0",
      summary: "Ultra-fast dual-audience knowledge base & anti-hallucination verifier for BC Ai Account.",
      description:
        "Public read-only REST and Streamable HTTP MCP 3.0 API for BC Ai Account & BC product suite. Features hybrid multi-signal RRF retrieval, surgical section BM25, O(1) Thai error lookup, structured typed facts, recency feed, runtime ground-truth verification, and sanitized gap telemetry with strict user/dev audience isolation.",
      contact: {
        name: "BC Brain",
        url: "https://brain.bcsmethai.com",
      },
    },
    servers: [
      {
        url: "https://brain.bcsmethai.com",
        description: "Production BC Brain server",
      },
    ],
    tags: [
      { name: "Retrieval", description: "Fast Q&A, error lookup, section search, facts, and recency feed" },
      { name: "Grounding", description: "Anti-hallucination verification & sanitized gap telemetry" },
      { name: "Packs", description: "Prompt-caching bootstrap packs and gzipped vault mirror" },
      { name: "MCP", description: "Stateless JSON-RPC 2.0 Model Context Protocol endpoint (15 tools)" },
      { name: "System", description: "Health check and OpenAPI discovery" },
    ],
    paths: {
      "/api/fast": {
        get: {
          tags: ["Retrieval"],
          operationId: "getFastAnswer",
          summary: "Ultra-fast single-shot answer or direct menu/table lookup",
          description:
            "Edge-cacheable REST Q&A endpoint supporting ultra-compact TL;DR answers (`mode=ultra`), normal/fast excerpts, and direct 4-digit menu or dev SQL table lookup (`menu=4013`).",
          parameters: [
            { name: "q", in: "query", required: false, description: "Question text (min 2 chars; required if menu omitted).", schema: { type: "string", minLength: 2, maxLength: 500 } },
            { name: "menu", in: "query", required: false, description: "4-digit menu code (e.g. 4013), legacy dotted code, or dev SQL table name.", schema: { type: "string", maxLength: 120 } },
            AUDIENCE_PARAM,
            { name: "mode", in: "query", required: false, schema: { type: "string", enum: ["ultra", "fast", "normal"], default: "ultra" } },
            { name: "media", in: "query", required: false, description: "Set 1 or true to append compact YouTube/screenshot link.", schema: { type: "string", enum: ["0", "1", "true", "false"] } },
            { name: "max_chars", in: "query", required: false, schema: { type: "integer", minimum: 300, maximum: 4500 } },
            { name: "format", in: "query", required: false, schema: { type: "string", enum: ["json", "text"], default: "json" } },
          ],
          responses: {
            "200": {
              description: "Grounded answer (or abstention payload with abstained=true).",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/FastAnswerResponse" } },
                "text/plain": { schema: { type: "string" } },
              },
            },
            "304": NOT_MODIFIED_RESP,
            "400": { description: "Missing or invalid query parameters." },
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/error": {
        get: {
          tags: ["Retrieval"],
          operationId: "lookupErrorMessage",
          summary: "O(1) Thai validation & error message lookup",
          description:
            "Matches real BC Ai Account Thai error/validation alerts to exact cause + fix snippets and canonical troubleshoot/howto notes. Records a sanitized gap entry when zero hits match.",
          parameters: [
            { name: "q", in: "query", required: true, description: "Thai error alert or symptom text.", schema: { type: "string", minLength: 1, maxLength: 300 } },
            AUDIENCE_PARAM,
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 15, default: 5 } },
          ],
          responses: {
            "200": {
              description: "Matched error explanations and fixes.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorLookupResponse" } } },
            },
            "304": NOT_MODIFIED_RESP,
            "400": { description: "Missing ?q= parameter." },
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/sections": {
        get: {
          tags: ["Retrieval"],
          operationId: "searchSections",
          summary: "Surgical ## Section BM25 search with block-aware excerpts & facts",
          description:
            "Searches individual `## Section` chunks across the vault and returns block-aware Markdown excerpts (never slicing mid-table, mid-list, or mid-code-fence) alongside structured facts for matched notes.",
          parameters: [
            { name: "q", in: "query", required: true, description: "Section search query.", schema: { type: "string", minLength: 1, maxLength: 300 } },
            AUDIENCE_PARAM,
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 15, default: 5 } },
            { name: "max_chars", in: "query", required: false, description: "Max characters per section excerpt.", schema: { type: "integer", minimum: 200, maximum: 6000, default: 1200 } },
          ],
          responses: {
            "200": {
              description: "Matched sections with block-aware excerpts and structured facts.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SectionsSearchResponse" } } },
            },
            "304": NOT_MODIFIED_RESP,
            "400": { description: "Missing ?q= parameter." },
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/facts": {
        get: {
          tags: ["Retrieval"],
          operationId: "getStructuredFacts",
          summary: "Retrieve typed structured facts ([menu], [rule], [limit], [error], [formula])",
          description:
            "Returns pre-extracted structured facts filtered by query, explicit slugs, fact kinds, and audience zone. Strictly strips dev notes and SQL/code jargon in user mode.",
          parameters: [
            { name: "q", in: "query", required: false, description: "Search query to pick top matching notes.", schema: { type: "string", maxLength: 300 } },
            { name: "slugs", in: "query", required: false, description: "Comma-separated note slugs (max 10).", schema: { type: "string" } },
            { name: "kinds", in: "query", required: false, description: "Comma-separated fact kinds: menu,rule,limit,error,formula.", schema: { type: "string" } },
            AUDIENCE_PARAM,
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          ],
          responses: {
            "200": {
              description: "Typed structured facts.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/FactsResponse" } } },
            },
            "304": NOT_MODIFIED_RESP,
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/whats-new": {
        get: {
          tags: ["Retrieval"],
          operationId: "getWhatsNew",
          summary: "Recently updated vault notes feed",
          description: "Returns recently modified knowledge base notes with ISO timestamps, folders, and concise TL;DR summaries.",
          parameters: [
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 365, default: 7 } },
            AUDIENCE_PARAM,
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          ],
          responses: {
            "200": {
              description: "Recently updated notes sorted newest-first.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/WhatsNewResponse" } } },
            },
            "304": NOT_MODIFIED_RESP,
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/verify": {
        get: {
          tags: ["Grounding"],
          operationId: "verifyReferencesGet",
          summary: "Verify 4-digit menu codes, SQL tables, and table.column references (GET)",
          description:
            "Anti-hallucination ground-truth verifier. Always validates 4-digit menu codes. In `audience=user`, strictly refuses and omits SQL tables/columns without revealing schema existence; pass `audience=dev` (or `all`) to verify SQL tables and `table.column` references.",
          parameters: [
            { name: "menus", in: "query", required: false, description: "Comma-separated 4-digit menu codes (e.g. 4013,1005).", schema: { type: "string" } },
            { name: "tables", in: "query", required: false, description: "Comma-separated SQL table names (dev/all only).", schema: { type: "string" } },
            { name: "columns", in: "query", required: false, description: "Comma-separated table.column pairs (dev/all only).", schema: { type: "string" } },
            AUDIENCE_PARAM,
          ],
          responses: {
            "200": {
              description: "Verification report with valid items, invalid items, and fuzzy suggestions.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyResponse" } } },
            },
            "304": NOT_MODIFIED_RESP,
            "400": { description: "No menus, tables, or columns supplied." },
            "429": RATE_LIMIT_RESP,
          },
        },
        post: {
          tags: ["Grounding"],
          operationId: "verifyReferencesPost",
          summary: "Verify 4-digit menu codes, SQL tables, and table.column references (POST)",
          description:
            "JSON body variant of ground-truth verification for AI agents. Enforces identical strict `audience=user` SQL table/column refusal.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Verification report.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyResponse" } } },
            },
            "400": { description: "Invalid JSON or no references provided." },
            "413": { description: "Request body exceeds 32 KB limit." },
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/gaps": {
        get: {
          tags: ["Grounding"],
          operationId: "getGapReport",
          summary: "Sanitized knowledge-gap telemetry ring buffer",
          description:
            "Returns aggregated zero-hit, low-confidence, and abstained queries captured in memory (strictly PII/secret-sanitized, max 256 unique entries, Cache-Control: no-store).",
          parameters: [
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 256, default: 50 } },
          ],
          responses: {
            "200": {
              description: "Sanitized gap telemetry summary.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/GapReportResponse" } } },
            },
            "429": RATE_LIMIT_RESP,
          },
        },
      },
      "/api/bootstrap-pack": {
        get: {
          tags: ["Packs"],
          operationId: "getBootstrapPack",
          summary: "Prompt-caching bootstrap pack for bots and IDE agents",
          parameters: [
            { name: "audience", in: "query", required: false, schema: { type: "string", enum: ["user", "dev"], default: "user" } },
            { name: "format", in: "query", required: false, schema: { type: "string", enum: ["text", "json"], default: "text" } },
          ],
          responses: {
            "200": {
              description: "Compact ETag-cached bootstrap markdown or JSON pack.",
              content: {
                "text/markdown": { schema: { type: "string" } },
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      audience: { type: "string", enum: ["user", "dev"] },
                      chars: { type: "integer" },
                      etag: { type: "string" },
                      text: { type: "string" },
                    },
                    required: ["audience", "chars", "etag", "text"],
                  },
                },
              },
            },
            "304": NOT_MODIFIED_RESP,
          },
        },
      },
      "/api/vault-pack": {
        get: {
          tags: ["Packs"],
          operationId: "getVaultPack",
          summary: "Gzipped full vault mirror for zero-RTT local Stdio MCP sync",
          responses: {
            "200": {
              description: "ETag-cached gzip archive of all vault notes.",
              content: {
                "application/gzip": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "304": NOT_MODIFIED_RESP,
          },
        },
      },
      "/api/openapi.json": {
        get: {
          tags: ["System"],
          operationId: "getOpenApiSpec",
          summary: "OpenAPI 3.1.0 machine-readable specification",
          responses: {
            "200": {
              description: "OpenAPI 3.1.0 JSON document.",
              content: { "application/json": { schema: { type: "object" } } },
            },
            "304": NOT_MODIFIED_RESP,
          },
        },
      },
      "/healthz": {
        get: {
          tags: ["System"],
          operationId: "getHealthz",
          summary: "Service liveness, version, note count & capability summary",
          responses: {
            "200": {
              description: "Healthy status payload.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" },
                      version: { type: "string" },
                      notes: { type: "integer" },
                      tools: { type: "integer" },
                      commit: { type: "string" },
                    },
                    required: ["ok", "service", "version", "notes"],
                  },
                },
              },
            },
          },
        },
      },
      "/mcp": {
        post: {
          tags: ["MCP"],
          operationId: "postMcpJsonRpc",
          summary: "Stateless Streamable HTTP MCP JSON-RPC 2.0 endpoint (15 tools)",
          description:
            "Accepts single or batch JSON-RPC 2.0 requests (`initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`). Exposes 15 read-only BC Brain tools with strict audience isolation.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC 2.0 response object or batch response array.",
              content: { "application/json": { schema: { type: "object" } } },
            },
            "202": { description: "Notification accepted (no body)." },
            "400": { description: "JSON parse error or invalid JSON-RPC request." },
            "413": { description: "Request body exceeds 32 KB limit." },
            "429": RATE_LIMIT_RESP,
          },
        },
      },
    },
    components: {
      schemas: {
        FastAnswerResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            kind: { type: "string", enum: ["menu", "answer"] },
            audience: { type: "string", enum: ["all", "user", "dev"] },
            mode: { type: "string" },
            answer: { type: "string" },
            abstained: { type: "boolean" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            facts: { type: "array", items: { type: "string" } },
            hits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  title: { type: "string" },
                  folder: { type: "string" },
                },
                required: ["slug", "title", "folder"],
              },
            },
            ms: { type: "number" },
            cached: { type: "boolean" },
          },
          required: ["ok", "kind", "audience", "mode", "answer", "abstained", "confidence", "hits", "ms", "cached"],
        },
        ErrorLookupResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            query: { type: "string" },
            audience: { type: "string", enum: ["all", "user", "dev"] },
            count: { type: "integer" },
            abstained: { type: "boolean" },
            hits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  errorText: { type: "string" },
                  fixSnippet: { type: "string" },
                  slug: { type: "string" },
                  title: { type: "string" },
                  folder: { type: "string" },
                  audience: { type: "string", enum: ["user", "dev", "both"] },
                },
                required: ["errorText", "fixSnippet", "slug", "title", "folder", "audience"],
              },
            },
            ms: { type: "number" },
          },
          required: ["ok", "query", "audience", "count", "abstained", "hits", "ms"],
        },
        SectionsSearchResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            query: { type: "string" },
            audience: { type: "string", enum: ["all", "user", "dev"] },
            count: { type: "integer" },
            abstained: { type: "boolean" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  title: { type: "string" },
                  folder: { type: "string" },
                  audience: { type: "string", enum: ["user", "dev", "both"] },
                  heading: { type: "string" },
                  score: { type: "number" },
                  matchedTerms: { type: "integer" },
                  excerpt: { type: "string" },
                  truncated: { type: "boolean" },
                  facts: { type: "array", items: { type: "string" } },
                },
                required: ["slug", "title", "folder", "audience", "heading", "score", "excerpt", "facts"],
              },
            },
            ms: { type: "number" },
          },
          required: ["ok", "query", "audience", "count", "abstained", "sections", "ms"],
        },
        FactsResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            audience: { type: "string", enum: ["all", "user", "dev"] },
            count: { type: "integer" },
            facts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["menu", "rule", "limit", "error", "formula"] },
                  text: { type: "string" },
                  formatted: { type: "string" },
                  slug: { type: "string" },
                  title: { type: "string" },
                  folder: { type: "string" },
                },
                required: ["kind", "text", "formatted", "slug", "title", "folder"],
              },
            },
            ms: { type: "number" },
          },
          required: ["ok", "audience", "count", "facts", "ms"],
        },
        WhatsNewResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            days: { type: "integer" },
            audience: { type: "string", enum: ["all", "user", "dev"] },
            count: { type: "integer" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  title: { type: "string" },
                  folder: { type: "string" },
                  audience: { type: "string", enum: ["user", "dev", "both"] },
                  updatedAt: { type: "string", format: "date-time" },
                  tldr: { type: "string" },
                },
                required: ["slug", "title", "folder", "audience", "updatedAt", "tldr"],
              },
            },
            ms: { type: "number" },
          },
          required: ["ok", "days", "audience", "count", "items", "ms"],
        },
        VerifyRequest: {
          type: "object",
          properties: {
            menus: { type: "array", items: { type: "string" }, maxItems: 50 },
            tables: { type: "array", items: { type: "string" }, maxItems: 50 },
            columns: { type: "array", items: { type: "string" }, maxItems: 100 },
            audience: { type: "string", enum: ["user", "dev", "all", "both"], default: "user" },
          },
        },
        VerifyResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            indexAvailable: { type: "boolean" },
            audience: { type: "string", enum: ["all", "user", "dev"] },
            tablesRestricted: { type: "boolean" },
            restrictionNotice: { type: "string" },
            menus: {
              type: "object",
              properties: {
                valid: { type: "array", items: { type: "object" } },
                invalid: { type: "array", items: { type: "object" } },
                unknownMenus: { type: "array", items: { type: "string" } },
              },
              required: ["valid", "invalid", "unknownMenus"],
            },
            tables: {
              type: "object",
              properties: {
                valid: { type: "array", items: { type: "object" } },
                invalid: { type: "array", items: { type: "object" } },
              },
              required: ["valid", "invalid"],
            },
            columns: {
              type: "object",
              properties: {
                valid: { type: "array", items: { type: "object" } },
                invalid: { type: "array", items: { type: "object" } },
              },
              required: ["valid", "invalid"],
            },
            summary: { type: "object" },
          },
          required: ["ok", "indexAvailable", "audience", "tablesRestricted", "menus", "tables", "columns", "summary"],
        },
        GapReportResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            totalRecorded: { type: "integer" },
            uniqueQueries: { type: "integer" },
            maxEntries: { type: "integer" },
            fileLoggingEnabled: { type: "boolean" },
            byReason: {
              type: "object",
              properties: {
                abstain: { type: "integer" },
                zero_hit: { type: "integer" },
                low_conf: { type: "integer" },
              },
            },
            entries: { type: "array", items: { type: "object" } },
          },
          required: ["ok", "totalRecorded", "uniqueQueries", "maxEntries", "byReason", "entries"],
        },
        JsonRpcRequest: {
          type: "object",
          properties: {
            jsonrpc: { type: "string", const: "2.0" },
            id: { oneOf: [{ type: "string" }, { type: "integer" }, { type: "null" }] },
            method: { type: "string", examples: ["initialize", "tools/list", "tools/call", "ping"] },
            params: { type: "object" },
          },
          required: ["jsonrpc", "method"],
        },
      },
    },
  };

  return cachedSpec;
}

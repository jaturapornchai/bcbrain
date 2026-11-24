package main

import (
	"bytes"
	"container/list"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	defaultProtocolVersion = "2025-03-26"
	maxBodyBytes           = 32 * 1024
	lruCacheMax            = 512
)

type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ToolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ToolResult struct {
	Content []ToolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type cachedPayload struct {
	key        string
	text       string
	hits       []EventHit
	totalHits  int
	audience   string
	abstained  bool
	confidence string
	topScore   int
	facts      []string
	resultJSON []byte
}

var gapTrackedTools = map[string]bool{
	"ask_brain":       true,
	"quick_answer":    true,
	"search_brain":    true,
	"lookup_error":    true,
	"search_sections": true,
}

type lruCache struct {
	mu    sync.Mutex
	max   int
	ll    *list.List
	items map[string]*list.Element
}

func newLRUCache(max int) *lruCache {
	return &lruCache{
		max:   max,
		ll:    list.New(),
		items: make(map[string]*list.Element, max),
	}
}

func (c *lruCache) Get(key string) (*cachedPayload, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		c.ll.MoveToFront(el)
		return el.Value.(*cachedPayload), true
	}
	return nil, false
}

func (c *lruCache) Set(key string, val *cachedPayload) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		el.Value = val
		c.ll.MoveToFront(el)
		return
	}
	el := c.ll.PushFront(val)
	c.items[key] = el
	if c.ll.Len() > c.max {
		back := c.ll.Back()
		if back != nil {
			c.ll.Remove(back)
			old := back.Value.(*cachedPayload)
			delete(c.items, old.key)
		}
	}
}

type MCPService struct {
	engine          *Engine
	events          *EventBus
	gaps            *GapLog
	cache           *lruCache
	serverInfo      ServerInfo
	instructions    string
	toolsListJSON   []byte
	logEnabled      bool
	emptyResources  []byte
	emptyPrompts    []byte
	emptyObj        []byte
	toolDescriptors []map[string]any
}

func NewMCPService(engine *Engine, events *EventBus, gaps *GapLog, logEnabled bool) *MCPService {
	version := engine.pack.Meta.Version
	if version == "" {
		version = "3.0.0"
	}
	baseInstructions := `BC Brain v3 = ultra-fast dual-audience knowledge base for BC Ai Account & BC suite (sales, purchasing, inventory, AR/AP, cash/bank, assets, GL, VAT/WHT, POS, AutoCare, e-Tax, WMS, TMS, Procure, CRM, LINE OA, Market, Dashboard, MonitorMap, WorkMonitor, Company Brain), verified against real source code (hybrid RRF, section BM25, 256-dim semantic, structured facts, O(1) error index, and ground-truth verifier).

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

GROUNDING: Answer ONLY from verified notes. If abstained (🛑 Abstain) or missing, state clearly without guessing. Never expose secrets or internal slugs to end users.`

	commitSuffix := ""
	if engine.pack.Meta.SyncCommit != "" {
		commitSuffix = " · source bcaiaccount@" + engine.pack.Meta.SyncCommit
	}
	fullInstructions := fmt.Sprintf("%s\nKnowledge last updated: %s (Thai time)%s.", baseInstructions, engine.pack.Meta.UpdatedAt, commitSuffix)

	foldersDesc := strings.Join(engine.pack.Folders, ", ")
	if foldersDesc == "" {
		foldersDesc = "root, playbook, start, howto, troubleshoot, faq, reports, systems, glossary, sales, dev-playbook, schema, queries, api, doctypes, architecture"
	}

	descriptors := buildToolDescriptors(foldersDesc)
	toolsListJSON, _ := json.Marshal(map[string]any{"tools": descriptors})

	return &MCPService{
		engine:          engine,
		events:          events,
		gaps:            gaps,
		cache:           newLRUCache(lruCacheMax),
		serverInfo:      ServerInfo{Name: "bcbrain", Version: version},
		instructions:    fullInstructions,
		toolsListJSON:   toolsListJSON,
		logEnabled:      logEnabled,
		emptyResources:  []byte(`{"resources":[]}`),
		emptyPrompts:    []byte(`{"prompts":[]}`),
		emptyObj:        []byte(`{}`),
		toolDescriptors: descriptors,
	}
}

func buildToolDescriptors(foldersDesc string) []map[string]any {
	audProp := map[string]any{
		"type":        "string",
		"enum":        []string{"all", "user", "dev"},
		"description": `Audience zone: "user" (plain Thai guides/sales), "dev" (schema/SQL/API/architecture), or "all" (default).`,
	}
	smartAudProp := map[string]any{
		"type":        "string",
		"enum":        []string{"user", "dev", "both", "all"},
		"description": `Audience zone: "user" (plain Thai guides/sales, zero SQL/code), "dev" (schema/SQL/API/architecture), or "both"/"all" (default).`,
	}
	ann := map[string]any{"readOnlyHint": true, "openWorldHint": false}
	schema := "http://json-schema.org/draft-07/schema#"

	return []map[string]any{
		{
			"name":        "quick_answer",
			"title":       "Ultra-fast single-shot answer",
			"description": "FASTEST default tool for real-time Q&A, Call Center, voice/LINE bots, and focused lookups. Returns ~2,000 chars ('normal'), ~1,400 chars ('fast'), or ~600-char TL;DR ('ultra') with top structured facts in 1 call and strict anti-hallucination abstention.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"question":      map[string]any{"type": "string", "minLength": 2, "maxLength": 500, "description": "Thai or English question."},
					"audience":      audProp,
					"mode":          map[string]any{"type": "string", "enum": []string{"normal", "ultra", "fast"}, "description": "'normal' (~2000 chars), 'fast' (~1400 chars), or 'ultra' (~600-char TL;DR for voice/LINE bots)."},
					"max_chars":     map[string]any{"type": "integer", "minimum": 300, "maximum": 4500, "description": "Char budget (default 2000 normal, 1400 fast, 700 ultra)."},
					"include_media": map[string]any{"type": "boolean", "description": "Append 1 compact YouTube/screenshot line (default false for max speed)."},
					"include_facts": map[string]any{"type": "boolean", "description": "Attach concise structured facts line when budget permits (default true)."},
				},
				"required":             []string{"question"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "batch_ask",
			"title":       "Answer 1–5 questions in one round-trip",
			"description": "Answer up to 5 independent or compound questions in ONE single MCP call (defaults to mode: 'ultra' for minimal tokens & fastest LLM TTFT). Enforces strict abstention and audience isolation per question.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"questions": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 2, "maxLength": 300},
						"minItems":    1,
						"maxItems":    5,
						"description": "1–5 questions to answer in one call.",
					},
					"audience":             audProp,
					"mode":                 map[string]any{"type": "string", "enum": []string{"normal", "ultra", "fast"}, "description": "Default 'ultra' (TL;DR), 'fast', or 'normal'."},
					"max_chars_per_answer": map[string]any{"type": "integer", "minimum": 300, "maximum": 2500, "description": "Char cap per answer (default 700 ultra, 1400 normal/fast)."},
					"include_media":        map[string]any{"type": "boolean", "description": "Append compact media line per answer (default false)."},
				},
				"required":             []string{"questions"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "lookup_menu",
			"title":       "Instant O(1) menu code & SQL table lookup",
			"description": "Instant O(1) lookup for 4-digit BC menu codes (1001–9070), legacy dotted codes (4.13), Thai menu names, or SQL table names (ic_trans, gl_journal, etc. in dev/all mode). Returns exact menu path, edition, and linked slugs in <1ms.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"query":    map[string]any{"type": "string", "minLength": 1, "maxLength": 120, "description": "4-digit menu code (e.g. '4013', '1005'), menu name, or SQL table name."},
					"audience": audProp,
					"limit":    map[string]any{"type": "integer", "minimum": 1, "maximum": 15, "description": "Max rows to return (default 6)."},
				},
				"required":             []string{"query"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "batch_read",
			"title":       "Read multiple notes in one round-trip",
			"description": "Read 1–5 notes by slug in ONE single MCP call (eliminates sequential read_note round-trips). Supports query-focused section excerpting, per-note char budget, and strict audience isolation.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"slugs": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
						"minItems":    1,
						"maxItems":    5,
						"description": "1–5 note slugs to read in parallel.",
					},
					"audience":           audProp,
					"query":              map[string]any{"type": "string", "maxLength": 300, "description": "Optional focus keywords to extract only matching sections."},
					"max_chars_per_note": map[string]any{"type": "integer", "minimum": 500, "maximum": 6000, "description": "Char cap per note (default 2000)."},
					"strip_links":        map[string]any{"type": "boolean", "description": "Omit trailing See-Also & links/backlinks footers for speed (default true)."},
				},
				"required":             []string{"slugs"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "ask_brain",
			"title":       "Ask the BC brain",
			"description": "Multi-note answer (Thai or English) with aggregated media links and 1-hop graph context. Pass audience: 'user' or 'dev' or 'all'. Use compact: true (or quick_answer) for fastest response.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"question":  map[string]any{"type": "string", "minLength": 2, "maxLength": 500},
					"audience":  audProp,
					"compact":   map[string]any{"type": "boolean", "description": "Token-saving mode: up to 2 tightly-trimmed notes."},
					"max_notes": map[string]any{"type": "integer", "minimum": 1, "maximum": 4, "description": "Max notes (1–4; default 3 high-conf / 2 compact)."},
				},
				"required":             []string{"question"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "search_brain",
			"title":       "Search notes",
			"description": "Hybrid multi-signal RRF search (Thai segmentation + BM25 + section BM25 + SQL/menu direct match + 1-hop graph). Supports audience ('all' | 'user' | 'dev'). Default limit 5 for low latency.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"query":    map[string]any{"type": "string", "minLength": 1, "maxLength": 300},
					"limit":    map[string]any{"type": "integer", "minimum": 1, "maximum": 20, "description": "Max hits (default 5)."},
					"audience": audProp,
				},
				"required":             []string{"query"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "traverse_brain",
			"title":       "Traverse knowledge graph",
			"description": "Follow typed synapses 1–3 hops from a note (or find the shortest graph path to to_slug). Respects audience isolation ('all' | 'user' | 'dev').",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"slug":      map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
					"to_slug":   map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
					"depth":     map[string]any{"type": "integer", "minimum": 1, "maximum": 3},
					"direction": map[string]any{"type": "string", "enum": []string{"both", "out", "in"}},
					"relation":  map[string]any{"type": "string", "enum": relationTypes},
					"folder":    map[string]any{"type": "string", "maxLength": 40},
					"limit":     map[string]any{"type": "integer", "minimum": 1, "maximum": 50},
					"audience":  audProp,
				},
				"required":             []string{"slug"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "read_note",
			"title":       "Read a note",
			"description": "Markdown of one note by slug (accepts [[slug]] or slug.md), plus audience, media, and links. Pass optional query/max_chars for focused faster reads.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"slug":      map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
					"query":     map[string]any{"type": "string", "maxLength": 300, "description": "Optional focus terms to excerpt relevant sections only."},
					"max_chars": map[string]any{"type": "integer", "minimum": 500, "maximum": 20000, "description": "Optional char budget."},
				},
				"required":             []string{"slug"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "list_notes",
			"title":       "List notes",
			"description": fmt.Sprintf("Index of notes (slug, folder, audience, title, tags). Filter by folder (%s), tag, or audience ('all' | 'user' | 'dev').", foldersDesc),
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"folder":   map[string]any{"type": "string", "maxLength": 40},
					"tag":      map[string]any{"type": "string", "maxLength": 40},
					"audience": audProp,
				},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "find_media",
			"title":       "Find screenshots, YouTube videos & website links",
			"description": "Retrieve ready-to-share official screenshot URLs (https://bcaccount.com/...), YouTube tutorial video/playlist URLs (PLO9P7tPZLXB0 with thumbnailUrl and embedUrl), and website reference pages matching a topic or 4-digit menu code.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"query":    map[string]any{"type": "string", "maxLength": 300, "description": "Topic or 4-digit menu code (omit or '*' for canonical media)."},
					"kind":     map[string]any{"type": "string", "enum": []string{"all", "image", "youtube", "webpage"}},
					"limit":    map[string]any{"type": "integer", "minimum": 1, "maximum": 40},
					"audience": audProp,
				},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "lookup_error",
			"title":       "O(1) Thai validation & error message lookup",
			"description": "Instant O(1) lookup for real BC Ai Account Thai error/validation alerts. Returns exact error message, cause + fix snippet, and canonical troubleshoot/howto note slug, with strict 🛑 Abstain on unmatched queries.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"query":    map[string]any{"type": "string", "minLength": 1, "maxLength": 300, "description": "Thai error alert or validation message."},
					"audience": smartAudProp,
					"limit":    map[string]any{"type": "integer", "minimum": 1, "maximum": 15, "description": "Max matched error entries (default 5)."},
				},
				"required":             []string{"query"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "search_sections",
			"title":       "Surgical ## Section BM25 search",
			"description": "Search individual ## Section chunks across the vault and return exact block-aware Markdown excerpts (never slicing mid-table, mid-list, or mid-code-fence) plus structured facts for matched slugs.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"query":     map[string]any{"type": "string", "minLength": 1, "maxLength": 300, "description": "Focused Thai or technical query."},
					"audience":  smartAudProp,
					"limit":     map[string]any{"type": "integer", "minimum": 1, "maximum": 15, "description": "Max sections to return (default 5)."},
					"max_chars": map[string]any{"type": "integer", "minimum": 200, "maximum": 6000, "description": "Max chars per section excerpt (default 1200)."},
				},
				"required":             []string{"query"},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "get_facts",
			"title":       "Get structured typed facts ([menu], [rule], [limit], [error], [formula])",
			"description": "Extract pre-computed typed facts ([menu], [rule], [limit], [error], [formula]) for explicit slugs or top search matches, with strict audience isolation (zero SQL/code jargon in user mode).",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"query": map[string]any{"type": "string", "maxLength": 300, "description": "Optional search query to select top relevant notes."},
					"slugs": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
						"maxItems":    10,
						"description": "Optional explicit note slugs.",
					},
					"kinds": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "enum": []string{"menu", "rule", "limit", "error", "formula"}},
						"maxItems":    5,
						"description": "Optional fact kinds filter.",
					},
					"audience": smartAudProp,
					"limit":    map[string]any{"type": "integer", "minimum": 1, "maximum": 50, "description": "Max total facts returned (default 20)."},
				},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "whats_new",
			"title":       "Recently updated knowledge base notes",
			"description": "Return recently updated BC Brain notes within the last N days, sorted newest-first with ISO dates, titles, folders, and TL;DR summaries.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"days":     map[string]any{"type": "integer", "minimum": 1, "maximum": 365, "description": "Lookback window in days (default 7)."},
					"audience": smartAudProp,
					"limit":    map[string]any{"type": "integer", "minimum": 1, "maximum": 50, "description": "Max notes to return (default 20)."},
				},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
		{
			"name":        "verify_reference",
			"title":       "Anti-hallucination ground-truth verifier",
			"description": "Verify 4-digit BC menu codes (all modes) and SQL table / table.column references (dev/both/all modes only) against compiled real source ground truth. Strictly refuses and omits SQL tables/columns in audience='user' mode.",
			"inputSchema": map[string]any{
				"$schema": schema,
				"type":    "object",
				"properties": map[string]any{
					"menus": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 1, "maxLength": 20},
						"maxItems":    50,
						"description": "4-digit BC menu codes to verify (e.g. ['4013', '1005']).",
					},
					"tables": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 1, "maxLength": 100},
						"maxItems":    50,
						"description": "SQL table names to verify (dev/both/all only; strictly blocked in user mode).",
					},
					"columns": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 1, "maxLength": 160},
						"maxItems":    100,
						"description": "SQL 'table.column' references to verify (dev/both/all only; strictly blocked in user mode).",
					},
					"audience": smartAudProp,
				},
				"additionalProperties": false,
			},
			"annotations": ann,
		},
	}
}

// ---------- Formatting Helpers (100% Parity with lib/mcp-engine.ts) ----------
func formatNoteMediaLines(m NoteMedia) []string {
	var lines []string
	if len(m.Videos) > 0 {
		capN := len(m.Videos)
		if capN > 6 {
			capN = 6
		}
		parts := make([]string, capN)
		for i := 0; i < capN; i++ {
			v := m.Videos[i]
			thumb := ""
			if v.ThumbnailURL != "" {
				thumb = " (thumbnail: " + v.ThumbnailURL + ")"
			}
			parts[i] = v.Title + " -> " + v.URL + thumb
		}
		lines = append(lines, "youtube_videos: "+strings.Join(parts, " | "))
	}
	if len(m.Images) > 0 {
		capN := len(m.Images)
		if capN > 6 {
			capN = 6
		}
		parts := make([]string, capN)
		for i := 0; i < capN; i++ {
			parts[i] = m.Images[i].Alt + " -> " + m.Images[i].URL
		}
		lines = append(lines, "images: "+strings.Join(parts, " | "))
	}
	if len(m.WebPages) > 0 {
		capN := len(m.WebPages)
		if capN > 6 {
			capN = 6
		}
		parts := make([]string, capN)
		for i := 0; i < capN; i++ {
			parts[i] = m.WebPages[i].Title + " -> " + m.WebPages[i].URL
		}
		lines = append(lines, "web_pages: "+strings.Join(parts, " | "))
	}
	return lines
}

func formatAggregatedMediaBlock(m NoteMedia) string {
	if len(m.Videos) == 0 && len(m.Images) == 0 && len(m.WebPages) == 0 {
		return ""
	}
	sections := []string{"## Media & Reference Links"}
	if len(m.Videos) > 0 {
		var sb strings.Builder
		sb.WriteString("### YouTube (Playlist: https://www.youtube.com/playlist?list=PLO9P7tPZLXB0)")
		for _, v := range m.Videos {
			sb.WriteString("\n- 🎬 ")
			sb.WriteString(v.Title)
			sb.WriteString(": ")
			sb.WriteString(v.URL)
		}
		sections = append(sections, sb.String())
	}
	if len(m.Images) > 0 {
		var sb strings.Builder
		sb.WriteString("### Official Screenshots (bcaccount.com)")
		for _, img := range m.Images {
			sb.WriteString("\n- 🖼️ ")
			sb.WriteString(img.Alt)
			sb.WriteString(": ")
			sb.WriteString(img.URL)
		}
		sections = append(sections, sb.String())
	}
	if len(m.WebPages) > 0 {
		var sb strings.Builder
		sb.WriteString("### Official Pages (bcaccount.com)")
		for _, wp := range m.WebPages {
			sb.WriteString("\n- 🔗 ")
			sb.WriteString(wp.Title)
			sb.WriteString(": ")
			sb.WriteString(wp.URL)
		}
		sections = append(sections, sb.String())
	}
	return "\n\n---\n\n" + strings.Join(sections, "\n\n")
}

func formatInlineMediaLine(m NoteMedia) string {
	var bits []string
	if len(m.Videos) > 0 {
		bits = append(bits, "🎬 "+m.Videos[0].Title+": "+m.Videos[0].URL)
	}
	if len(m.Images) > 0 {
		bits = append(bits, "🖼️ "+m.Images[0].Alt+": "+m.Images[0].URL)
	}
	if len(bits) == 0 && len(m.WebPages) > 0 {
		bits = append(bits, "🔗 "+m.WebPages[0].Title+": "+m.WebPages[0].URL)
	}
	if len(bits) == 0 {
		return ""
	}
	return "\nmedia: " + strings.Join(bits, " | ")
}

func formatCompactEdges(edges []Edge, maxItems int) string {
	if len(edges) == 0 {
		return "-"
	}
	capN := len(edges)
	more := 0
	if maxItems > 0 && len(edges) > maxItems {
		capN = maxItems
		more = len(edges) - maxItems
	}
	parts := make([]string, capN)
	for i := 0; i < capN; i++ {
		parts[i] = "[[" + edges[i].Slug + "]] (" + edges[i].Rel + ")"
	}
	res := strings.Join(parts, " ")
	if more > 0 {
		res += fmt.Sprintf(" (+%d more)", more)
	}
	return res
}

type noteTextOpts struct {
	includeSources bool
	linkCap        int
	includeMedia   bool
	includeLinks   bool
}

func formatNoteText(n *Note, body string, opts noteTextOpts) string {
	var sb strings.Builder
	sb.WriteString("# ")
	sb.WriteString(n.Title)
	sb.WriteString("\nslug: ")
	sb.WriteString(n.Slug)
	sb.WriteString(" | folder: ")
	sb.WriteString(n.Folder)
	sb.WriteString(" | audience: ")
	sb.WriteString(n.Audience)
	sb.WriteString(" | tags: ")
	sb.WriteString(strings.Join(n.Tags, ", "))
	sb.WriteString("\n\n")
	sb.WriteString(strings.TrimSpace(body))

	var footers []string
	if opts.includeSources && n.Audience == "dev" && len(n.Sources) > 0 {
		capS := len(n.Sources)
		if capS > 6 {
			capS = 6
		}
		footers = append(footers, "verified_sources: "+strings.Join(n.Sources[:capS], ", "))
	}
	if opts.includeMedia {
		footers = append(footers, formatNoteMediaLines(n.Media)...)
	}
	if opts.includeLinks {
		footers = append(footers,
			"links: "+formatCompactEdges(n.OutEdges, opts.linkCap),
			"backlinks: "+formatCompactEdges(n.InEdges, opts.linkCap),
		)
	}
	if len(footers) > 0 {
		sb.WriteString("\n\n")
		sb.WriteString(strings.Join(footers, "\n"))
	}
	return sb.String()
}

func marshalToolText(text string, isError bool) []byte {
	res := ToolResult{
		Content: []ToolContent{{Type: "text", Text: text}},
		IsError: isError,
	}
	b, _ := json.Marshal(res)
	return b
}

func (m *MCPService) maybeRecordToolGap(tool, rawArg string, p *cachedPayload) {
	if !gapTrackedTools[tool] || p == nil {
		return
	}
	if !p.abstained && p.totalHits > 0 && p.confidence != "low" {
		return
	}
	reason := "low_conf"
	if p.totalHits == 0 {
		reason = "zero_hit"
	} else if p.abstained {
		reason = "abstain"
	}
	m.gaps.Record(tool, rawArg, p.audience, reason, p.topScore)
}

func (m *MCPService) runCachedTool(
	tool, cacheKey, rawArg string,
	compute func() cachedPayload,
) (*cachedPayload, float64, bool) {
	t0 := time.Now()
	fullKey := tool + "\x00" + cacheKey
	if hit, ok := m.cache.Get(fullKey); ok {
		ms := float64(time.Since(t0).Microseconds()) / 1000.0
		if m.logEnabled {
			fmt.Fprintf(os.Stdout, "[mcp-go] tool=%s audience=%s hits=%d ms=%.2f cached=1\n", tool, hit.audience, hit.totalHits, ms)
		}
		m.maybeRecordToolGap(tool, rawArg, hit)
		m.events.Emit(tool, hit.audience, rawArg, hit.hits, hit.totalHits, ms)
		return hit, ms, true
	}

	val := compute()
	val.key = fullKey
	val.resultJSON = marshalToolText(val.text, false)
	m.cache.Set(fullKey, &val)
	ms := float64(time.Since(t0).Microseconds()) / 1000.0
	if m.logEnabled {
		fmt.Fprintf(os.Stdout, "[mcp-go] tool=%s audience=%s hits=%d ms=%.2f\n", tool, val.audience, val.totalHits, ms)
	}
	m.maybeRecordToolGap(tool, rawArg, &val)
	m.events.Emit(tool, val.audience, rawArg, val.hits, val.totalHits, ms)
	return &val, ms, false
}

func (m *MCPService) buildQuickAnswer(question, filter, mode string, maxChars int, withMedia, withFacts bool) cachedPayload {
	budget := maxChars
	if budget <= 0 {
		switch mode {
		case "ultra":
			budget = 700
		case "fast":
			budget = 1400
		default:
			budget = 2000
		}
	}
	meta := m.engine.SearchWithMeta(question, 3, filter)
	if len(meta.Hits) == 0 {
		return cachedPayload{
			text:       fmt.Sprintf("🛑 Abstain — No matching notes (audience=%s). Do not guess—try lookup_menu, lookup_error, or search_brain.", filter),
			hits:       []EventHit{},
			totalHits:  0,
			audience:   filter,
			abstained:  true,
			confidence: "low",
			topScore:   0,
			facts:      []string{},
		}
	}
	denom := meta.TotalTerms
	if denom < 1 {
		denom = 1
	}
	coverage := float64(meta.BestMatchedTerms) / float64(denom)
	if meta.Confidence == "low" && (coverage < 0.5 || meta.TopScore < 18) {
		capC := len(meta.Hits)
		if capC > 3 {
			capC = 3
		}
		cands := make([]string, capC)
		for i := 0; i < capC; i++ {
			h := meta.Hits[i]
			cands[i] = fmt.Sprintf("- %s (%s) — %s", h.Slug, h.Folder, h.Title)
		}
		capE := len(meta.Hits)
		if capE > 2 {
			capE = 2
		}
		evHits := make([]EventHit, capE)
		for i := 0; i < capE; i++ {
			evHits[i] = EventHit{Slug: meta.Hits[i].Slug, Title: meta.Hits[i].Title, Folder: meta.Hits[i].Folder}
		}
		return cachedPayload{
			text: fmt.Sprintf(
				"🛑 Abstain — Insufficient Grounded Evidence in BC Brain (audience=%s, confidence=low, coverage=%d/%d, topScore=%d) for: %s\n\nDo NOT extrapolate or guess. State clearly that BC Brain has no verified record for this question.\nClosest candidates:\n%s",
				filter, meta.BestMatchedTerms, meta.TotalTerms, meta.TopScore, question, strings.Join(cands, "\n"),
			),
			hits:       evHits,
			totalHits:  len(meta.Hits),
			audience:   filter,
			abstained:  true,
			confidence: "low",
			topScore:   meta.TopScore,
			facts:      []string{},
		}
	}

	ts := m.engine.tok.Terms(question)
	if mode == "ultra" {
		top := m.engine.GetNote(meta.Hits[0].Slug)
		body := top.Tldr
		if utf8.RuneCountInString(body) > budget {
			body = m.engine.ExcerptNote(top, ts, budget, true)
		}
		src := ""
		if filter == "dev" && top.Audience == "dev" && len(top.Sources) > 0 {
			capS := len(top.Sources)
			if capS > 3 {
				capS = 3
			}
			src = "\nverified_sources: " + strings.Join(top.Sources[:capS], ", ")
		}
		mediaLine := ""
		if withMedia && filter != "dev" {
			mediaLine = formatInlineMediaLine(m.engine.CollectRelatedMedia([]string{top.Slug}, filter, 1, 1, 1))
		}
		parsedFacts := SafeNoteFacts(top, filter, nil, 3)
		topFacts := make([]string, len(parsedFacts))
		for i, pf := range parsedFacts {
			topFacts[i] = pf.Formatted
		}
		baseText := fmt.Sprintf("[quick_answer:ultra | audience=%s | confidence=%s | slug: %s]\n# %s\n%s%s%s",
			filter, meta.Confidence, top.Slug, top.Title, strings.TrimSpace(body), src, mediaLine)
		outText := baseText
		if withFacts && len(topFacts) > 0 {
			twoCap := len(topFacts)
			if twoCap > 2 {
				twoCap = 2
			}
			twoFacts := "\nfacts: " + strings.Join(topFacts[:twoCap], " | ")
			oneFact := "\nfacts: " + topFacts[0]
			if utf8.RuneCountInString(baseText)+utf8.RuneCountInString(twoFacts) <= 980 {
				outText = baseText + twoFacts
			} else if utf8.RuneCountInString(baseText)+utf8.RuneCountInString(oneFact) <= 980 {
				outText = baseText + oneFact
			}
		}
		return cachedPayload{
			text:       outText,
			hits:       []EventHit{{Slug: top.Slug, Title: top.Title, Folder: top.Folder}},
			totalHits:  1,
			audience:   filter,
			abstained:  false,
			confidence: meta.Confidence,
			topScore:   meta.TopScore,
			facts:      topFacts,
		}
	}

	useSecond := len(meta.Hits) > 1 &&
		!(meta.Confidence == "high" && float64(meta.Hits[0].Score) >= float64(meta.Hits[1].Score)*1.22) &&
		float64(meta.Hits[1].Score) >= float64(meta.TopScore)*0.72
	picked := meta.Hits[:1]
	if useSecond {
		picked = meta.Hits[:2]
	}
	caps := []int{budget}
	if len(picked) == 2 {
		c2 := int(math.Round(float64(budget) * 0.35))
		if c2 < 450 {
			c2 = 450
		}
		caps = []int{int(math.Round(float64(budget) * 0.65)), c2}
	}
	blocks := make([]string, len(picked))
	pickedSlugs := make([]string, len(picked))
	evHits := make([]EventHit, len(picked))
	collectedFacts := make([]string, 0, 3)
	seenFact := make(map[string]bool, 4)
	for i, h := range picked {
		n := m.engine.GetNote(h.Slug)
		pickedSlugs[i] = n.Slug
		evHits[i] = EventHit{Slug: n.Slug, Title: n.Title, Folder: n.Folder}
		for _, pf := range SafeNoteFacts(n, filter, nil, 2) {
			if !seenFact[pf.Formatted] && len(collectedFacts) < 3 {
				seenFact[pf.Formatted] = true
				collectedFacts = append(collectedFacts, pf.Formatted)
			}
		}
		body := m.engine.ExcerptNote(n, ts, caps[i], true)
		src := ""
		if filter == "dev" && n.Audience == "dev" && len(n.Sources) > 0 {
			capS := len(n.Sources)
			if capS > 4 {
				capS = 4
			}
			src = "\nverified_sources: " + strings.Join(n.Sources[:capS], ", ")
		}
		blocks[i] = fmt.Sprintf("# %s\nslug: %s | folder: %s | audience: %s\n\n%s%s",
			n.Title, n.Slug, n.Folder, n.Audience, strings.TrimSpace(body), src)
	}
	mediaLine := ""
	if withMedia && filter != "dev" {
		mediaLine = formatInlineMediaLine(m.engine.CollectRelatedMedia(pickedSlugs, filter, 1, 1, 1))
	}
	relNeighbors := m.engine.ConnectedNeighbors(pickedSlugs, filter, 3)
	relLine := ""
	if len(relNeighbors) > 0 {
		rSlugs := make([]string, len(relNeighbors))
		for i, g := range relNeighbors {
			rSlugs[i] = g.Slug
		}
		relLine = "\nrelated: " + strings.Join(rSlugs, ", ")
	}
	headerTag := "quick_answer"
	if mode == "fast" {
		headerTag = "quick_answer:fast"
	}
	baseText := fmt.Sprintf("[%s | audience=%s | confidence=%s | coverage=%d/%d]\n\n%s%s%s",
		headerTag, filter, meta.Confidence, meta.BestMatchedTerms, meta.TotalTerms, strings.Join(blocks, "\n\n---\n\n"), mediaLine, relLine)
	outText := baseText
	if withFacts && len(collectedFacts) > 0 {
		factsLine := "\nfacts: " + strings.Join(collectedFacts, " | ")
		if utf8.RuneCountInString(baseText)+utf8.RuneCountInString(factsLine) <= 2950 {
			outText = baseText + factsLine
		} else if utf8.RuneCountInString(baseText)+utf8.RuneCountInString(collectedFacts[0])+8 <= 2950 {
			outText = baseText + "\nfacts: " + collectedFacts[0]
		}
	}
	return cachedPayload{
		text:       outText,
		hits:       evHits,
		totalHits:  len(picked),
		audience:   filter,
		abstained:  false,
		confidence: meta.Confidence,
		topScore:   meta.TopScore,
		facts:      collectedFacts,
	}
}

// ---------- Argument Parsing Helpers (strict Zod parity) ----------
func getStringArg(args map[string]any, key string, required bool, minLen, maxLen int) (string, string) {
	raw, exists := args[key]
	if !exists || raw == nil {
		if required {
			return "", fmt.Sprintf("%s: Required", key)
		}
		return "", ""
	}
	s, ok := raw.(string)
	if !ok {
		return "", fmt.Sprintf("%s: Expected string", key)
	}
	rLen := utf8.RuneCountInString(s)
	if rLen < minLen {
		return "", fmt.Sprintf("%s: String must contain at least %d character(s)", key, minLen)
	}
	if maxLen > 0 && rLen > maxLen {
		return "", fmt.Sprintf("%s: String must contain at most %d character(s)", key, maxLen)
	}
	return s, ""
}

func getIntArg(args map[string]any, key string, def, minVal, maxVal int) (int, bool, string) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return def, false, ""
	}
	f, ok := raw.(float64)
	if !ok || math.Trunc(f) != f {
		return def, false, fmt.Sprintf("%s: Expected integer", key)
	}
	v := int(f)
	if v < minVal || v > maxVal {
		return def, false, fmt.Sprintf("%s: Must be between %d and %d", key, minVal, maxVal)
	}
	return v, true, ""
}

func getBoolArg(args map[string]any, key string, def bool) (bool, string) {
	raw, exists := args[key]
	if !exists || raw == nil {
		return def, ""
	}
	b, ok := raw.(bool)
	if !ok {
		return def, fmt.Sprintf("%s: Expected boolean", key)
	}
	return b, ""
}

func getAudienceArg(args map[string]any, def string) (string, string) {
	raw, exists := args["audience"]
	if !exists || raw == nil {
		return def, ""
	}
	s, ok := raw.(string)
	if !ok || (s != "all" && s != "user" && s != "dev") {
		return def, `audience: Must be one of "all", "user", "dev"`
	}
	return s, ""
}

func getSmartAudienceArg(args map[string]any, def string) (string, string) {
	raw, exists := args["audience"]
	if !exists || raw == nil {
		return def, ""
	}
	s, ok := raw.(string)
	if !ok {
		return def, `audience: Must be one of "user", "dev", "both", "all"`
	}
	switch s {
	case "user", "dev", "all":
		return s, ""
	case "both":
		return "all", ""
	default:
		return def, `audience: Must be one of "user", "dev", "both", "all"`
	}
}

func getStringArrayArg(args map[string]any, key string, minItems, maxItems, minLen, maxLen int) ([]string, string) {
	raw, exists := args[key]
	if !exists || raw == nil {
		if minItems == 0 {
			return nil, ""
		}
		return nil, fmt.Sprintf("%s: Required", key)
	}
	arr, ok := raw.([]any)
	if !ok {
		return nil, fmt.Sprintf("%s: Expected array", key)
	}
	if len(arr) < minItems || len(arr) > maxItems {
		return nil, fmt.Sprintf("%s: Array must contain between %d and %d items", key, minItems, maxItems)
	}
	out := make([]string, len(arr))
	for i, item := range arr {
		s, ok := item.(string)
		if !ok {
			return nil, fmt.Sprintf("%s[%d]: Expected string", key, i)
		}
		rLen := utf8.RuneCountInString(s)
		if rLen < minLen || rLen > maxLen {
			return nil, fmt.Sprintf("%s[%d]: String length must be between %d and %d", key, i, minLen, maxLen)
		}
		out[i] = s
	}
	return out, ""
}

type sectionsCoreResult struct {
	sections   []SectionExcerptItem
	abstained  bool
	confidence string
	topScore   int
}

func (m *MCPService) searchSectionsCore(query, filter string, limit, maxChars int) sectionsCoreResult {
	if limit < 1 {
		limit = 5
	}
	if limit > 15 {
		limit = 15
	}
	if maxChars < 200 {
		maxChars = 200
	}
	if maxChars > 6000 {
		maxChars = 6000
	}
	rawHits := m.engine.SearchSections(query, limit, filter)
	if len(rawHits) == 0 {
		return sectionsCoreResult{sections: []SectionExcerptItem{}, abstained: true, confidence: "low", topScore: 0}
	}

	ts := m.engine.tok.Terms(query)
	topScore := rawHits[0].Score
	bestMatched := rawHits[0].MatchedTerms
	denom := len(ts)
	if denom < 1 {
		denom = 1
	}
	coverage := float64(bestMatched) / float64(denom)
	conf := "low"
	if (coverage >= 0.6 && topScore >= 24) || (len(ts) <= 1 && topScore >= 18) {
		conf = "high"
	} else if coverage >= 0.45 && topScore >= 14 {
		conf = "medium"
	}

	factsBySlug := make(map[string][]string, len(rawHits))
	sections := make([]SectionExcerptItem, 0, len(rawHits))
	for _, hit := range rawHits {
		if !matchesAudience(hit.Audience, filter) {
			continue
		}
		excerpt, truncated := TrimBlockAware(hit.Raw, maxChars)
		noteFacts, ok := factsBySlug[hit.Slug]
		if !ok {
			note := m.engine.GetNote(hit.Slug)
			parsed := SafeNoteFacts(note, filter, nil, 4)
			noteFacts = make([]string, len(parsed))
			for i, pf := range parsed {
				noteFacts[i] = pf.Formatted
			}
			factsBySlug[hit.Slug] = noteFacts
		}
		sections = append(sections, SectionExcerptItem{
			Slug:         hit.Slug,
			Title:        hit.Title,
			Folder:       hit.Folder,
			Audience:     hit.Audience,
			Heading:      hit.Heading,
			Score:        hit.Score,
			MatchedTerms: hit.MatchedTerms,
			Excerpt:      excerpt,
			Truncated:    truncated,
			Facts:        noteFacts,
		})
	}

	if len(sections) == 0 {
		return sectionsCoreResult{sections: []SectionExcerptItem{}, abstained: true, confidence: "low", topScore: 0}
	}
	return sectionsCoreResult{
		sections:   sections,
		abstained:  false,
		confidence: conf,
		topScore:   sections[0].Score,
	}
}

// ---------- Tool Dispatcher (All 15 Tools) ----------
func (m *MCPService) callTool(name string, args map[string]any) ([]byte, bool, error) {
	if args == nil {
		args = map[string]any{}
	}
	switch name {
	case "quick_answer":
		q, errMsg := getStringArg(args, "question", true, 2, 500)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for quick_answer: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for quick_answer: "+errMsg, true), true, nil
		}
		mode, errMsg := getStringArg(args, "mode", false, 0, 10)
		if errMsg != "" || (mode != "" && mode != "normal" && mode != "ultra" && mode != "fast") {
			return marshalToolText("Invalid arguments for quick_answer: mode must be normal, fast, or ultra", true), true, nil
		}
		if mode == "" {
			mode = "normal"
		}
		defBudget := 2000
		if mode == "ultra" {
			defBudget = 700
		} else if mode == "fast" {
			defBudget = 1400
		}
		budget, _, errMsg := getIntArg(args, "max_chars", defBudget, 300, 4500)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for quick_answer: "+errMsg, true), true, nil
		}
		withMedia, errMsg := getBoolArg(args, "include_media", false)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for quick_answer: "+errMsg, true), true, nil
		}
		withFacts, errMsg := getBoolArg(args, "include_facts", true)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for quick_answer: "+errMsg, true), true, nil
		}
		mediaFlag := 0
		if withMedia {
			mediaFlag = 1
		}
		factsFlag := 0
		if withFacts {
			factsFlag = 1
		}
		key := fmt.Sprintf("%s|%s|%d|%d|%d|%s", aud, mode, budget, mediaFlag, factsFlag, strings.TrimSpace(q))
		p, _, _ := m.runCachedTool("quick_answer", key, q, func() cachedPayload {
			return m.buildQuickAnswer(q, aud, mode, budget, withMedia, withFacts)
		})
		return p.resultJSON, true, nil

	case "batch_ask":
		qs, errMsg := getStringArrayArg(args, "questions", 1, 5, 2, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_ask: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_ask: "+errMsg, true), true, nil
		}
		mode, errMsg := getStringArg(args, "mode", false, 0, 10)
		if errMsg != "" || (mode != "" && mode != "normal" && mode != "ultra" && mode != "fast") {
			return marshalToolText("Invalid arguments for batch_ask: mode must be normal, fast, or ultra", true), true, nil
		}
		if mode == "" {
			mode = "ultra"
		}
		defBudget := 700
		if mode == "normal" || mode == "fast" {
			defBudget = 1400
		}
		budget, _, errMsg := getIntArg(args, "max_chars_per_answer", defBudget, 300, 2500)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_ask: "+errMsg, true), true, nil
		}
		withMedia, errMsg := getBoolArg(args, "include_media", false)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_ask: "+errMsg, true), true, nil
		}
		normQs := make([]string, 0, len(qs))
		for _, q := range qs {
			if tq := strings.TrimSpace(q); tq != "" {
				normQs = append(normQs, tq)
			}
		}
		mediaFlag := 0
		if withMedia {
			mediaFlag = 1
		}
		key := fmt.Sprintf("%s|%s|%d|%d|%s", aud, mode, budget, mediaFlag, strings.Join(normQs, " || "))
		p, _, _ := m.runCachedTool("batch_ask", key, strings.Join(normQs, " | "), func() cachedPayload {
			allHits := make([]EventHit, 0, 6)
			seen := make(map[string]bool)
			blocks := make([]string, len(normQs))
			for idx, q := range normQs {
				sub := m.buildQuickAnswer(q, aud, mode, budget, withMedia, true)
				for _, h := range sub.hits {
					if !seen[h.Slug] && len(allHits) < 6 {
						seen[h.Slug] = true
						allHits = append(allHits, h)
					}
				}
				blocks[idx] = fmt.Sprintf("## Q%d: %s\n%s", idx+1, q, sub.text)
			}
			return cachedPayload{
				text:      fmt.Sprintf("[batch_ask | count=%d | audience=%s | mode=%s]\n\n%s", len(normQs), aud, mode, strings.Join(blocks, "\n\n---\n\n")),
				hits:      allHits,
				totalHits: len(allHits),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "lookup_menu":
		q, errMsg := getStringArg(args, "query", true, 1, 120)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for lookup_menu: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for lookup_menu: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 6, 1, 15)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for lookup_menu: "+errMsg, true), true, nil
		}
		key := fmt.Sprintf("%s|%d|%s", aud, lim, strings.TrimSpace(q))
		p, _, _ := m.runCachedTool("lookup_menu", key, q, func() cachedPayload {
			res := m.engine.LookupDirect(q, aud, lim)
			if res.Kind == "none" {
				return cachedPayload{
					text:      fmt.Sprintf(`No direct menu code or SQL table match for "%s" (audience=%s). Try quick_answer or search_brain.`, q, aud),
					hits:      []EventHit{},
					totalHits: 0,
					audience:  aud,
				}
			}
			var lines []string
			evHits := make([]EventHit, 0, 6)
			if len(res.Menus) > 0 {
				lines = append(lines, fmt.Sprintf("## Menus (%d)", len(res.Menus)))
				for _, mn := range res.Menus {
					docList := " | catalog: " + mn.CatalogSlug
					if len(mn.Docs) > 0 {
						slugs := make([]string, len(mn.Docs))
						for i, d := range mn.Docs {
							slugs[i] = d.Slug
						}
						docList = " | docs: " + strings.Join(slugs, ", ")
					}
					legacy := ""
					if mn.LegacyCode != "" && mn.LegacyCode != "—" {
						legacy = " (" + mn.LegacyCode + ")"
					}
					lines = append(lines, fmt.Sprintf("- **%s**%s **%s** — %s · %s%s", mn.Code, legacy, mn.Name, mn.MenuPath, mn.Edition, docList))
					if len(evHits) < 6 {
						if len(mn.Docs) > 0 {
							evHits = append(evHits, EventHit{Slug: mn.Docs[0].Slug, Title: mn.Docs[0].Title, Folder: mn.Docs[0].Folder})
						} else {
							evHits = append(evHits, EventHit{Slug: mn.CatalogSlug, Title: mn.Code + " " + mn.Name, Folder: "start"})
						}
					}
				}
			}
			if len(res.Tables) > 0 {
				lines = append(lines, fmt.Sprintf("## SQL Tables (%d)", len(res.Tables)))
				for _, tb := range res.Tables {
					rel := ""
					if len(tb.Docs) > 0 {
						slugs := make([]string, len(tb.Docs))
						for i, d := range tb.Docs {
							slugs[i] = d.Slug
						}
						rel = " | related: " + strings.Join(slugs, ", ")
					}
					lines = append(lines, fmt.Sprintf("- `%s` → schema: `%s` (%s)%s", tb.Table, tb.SchemaSlug, tb.SchemaTitle, rel))
					if len(evHits) < 6 {
						evHits = append(evHits, EventHit{Slug: tb.SchemaSlug, Title: tb.SchemaTitle, Folder: "schema"})
					}
				}
			}
			return cachedPayload{
				text:      strings.Join(lines, "\n"),
				hits:      evHits,
				totalHits: len(res.Menus) + len(res.Tables),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "lookup_error":
		q, errMsg := getStringArg(args, "query", true, 1, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for lookup_error: "+errMsg, true), true, nil
		}
		aud, errMsg := getSmartAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for lookup_error: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 5, 1, 15)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for lookup_error: "+errMsg, true), true, nil
		}
		qTrim := strings.TrimSpace(q)
		key := fmt.Sprintf("%s|%d|%s", aud, lim, qTrim)
		p, _, _ := m.runCachedTool("lookup_error", key, qTrim, func() cachedPayload {
			matches := m.engine.LookupError(qTrim, aud, lim)
			if len(matches) == 0 {
				return cachedPayload{
					text:       fmt.Sprintf(`🛑 Abstain — No verified BC error message found for "%s" (audience=%s). Do not guess—try search_sections or quick_answer.`, qTrim, aud),
					hits:       []EventHit{},
					totalHits:  0,
					audience:   aud,
					abstained:  true,
					confidence: "low",
					topScore:   0,
				}
			}
			lines := []string{fmt.Sprintf("[lookup_error | audience=%s | hits=%d]", aud, len(matches)), ""}
			evHits := make([]EventHit, 0, len(matches))
			seenSlug := make(map[string]bool)
			for i, er := range matches {
				lines = append(lines, fmt.Sprintf("%d. **\"%s\"**\n   - cause/fix: %s\n   - slug: `%s` | folder: %s | audience: %s — %s",
					i+1, er.ErrorText, er.FixSnippet, er.Slug, er.Folder, er.Audience, er.Title))
				if !seenSlug[er.Slug] && len(evHits) < 6 {
					seenSlug[er.Slug] = true
					evHits = append(evHits, EventHit{Slug: er.Slug, Title: er.Title, Folder: er.Folder})
				}
			}
			return cachedPayload{
				text:       strings.Join(lines, "\n"),
				hits:       evHits,
				totalHits:  len(matches),
				audience:   aud,
				abstained:  false,
				confidence: "high",
				topScore:   100,
			}
		})
		return p.resultJSON, true, nil

	case "search_sections":
		q, errMsg := getStringArg(args, "query", true, 1, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_sections: "+errMsg, true), true, nil
		}
		aud, errMsg := getSmartAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_sections: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 5, 1, 15)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_sections: "+errMsg, true), true, nil
		}
		capChars, _, errMsg := getIntArg(args, "max_chars", 1200, 200, 6000)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_sections: "+errMsg, true), true, nil
		}
		qTrim := strings.TrimSpace(q)
		key := fmt.Sprintf("%s|%d|%d|%s", aud, lim, capChars, qTrim)
		p, _, _ := m.runCachedTool("search_sections", key, qTrim, func() cachedPayload {
			res := m.searchSectionsCore(qTrim, aud, lim, capChars)
			if res.abstained {
				return cachedPayload{
					text:       fmt.Sprintf(`🛑 Abstain — No matching sections found for "%s" (audience=%s). Do not guess—try search_brain or quick_answer.`, qTrim, aud),
					hits:       []EventHit{},
					totalHits:  0,
					audience:   aud,
					abstained:  true,
					confidence: "low",
					topScore:   0,
				}
			}
			blocks := make([]string, 0, len(res.sections))
			evHits := make([]EventHit, 0, 6)
			seenSlug := make(map[string]bool)
			allFacts := make([]string, 0, 8)
			seenFact := make(map[string]bool)
			for _, sec := range res.sections {
				srcLine := ""
				if aud == "dev" {
					if srcNote := m.engine.GetNote(sec.Slug); srcNote != nil && srcNote.Audience == "dev" && len(srcNote.Sources) > 0 {
						capS := len(srcNote.Sources)
						if capS > 4 {
							capS = 4
						}
						srcLine = "\nverified_sources: " + strings.Join(srcNote.Sources[:capS], ", ")
					}
				}
				blocks = append(blocks, fmt.Sprintf("### %s\nslug: %s | folder: %s | audience: %s | score: %d\n\n%s%s",
					sec.Heading, sec.Slug, sec.Folder, sec.Audience, sec.Score, sec.Excerpt, srcLine))
				if !seenSlug[sec.Slug] && len(evHits) < 6 {
					seenSlug[sec.Slug] = true
					evHits = append(evHits, EventHit{Slug: sec.Slug, Title: sec.Title, Folder: sec.Folder})
				}
				for _, f := range sec.Facts {
					if !seenFact[f] && len(allFacts) < 8 {
						seenFact[f] = true
						allFacts = append(allFacts, fmt.Sprintf("%s (%s)", f, sec.Slug))
					}
				}
			}
			factsBlock := ""
			if len(allFacts) > 0 {
				var fb strings.Builder
				fb.WriteString("\n\n---\n\n## Structured Facts")
				for _, f := range allFacts {
					fb.WriteString("\n- ")
					fb.WriteString(f)
				}
				factsBlock = fb.String()
			}
			return cachedPayload{
				text:       fmt.Sprintf("[search_sections | audience=%s | confidence=%s | sections=%d]\n\n%s%s", aud, res.confidence, len(res.sections), strings.Join(blocks, "\n\n---\n\n"), factsBlock),
				hits:       evHits,
				totalHits:  len(res.sections),
				audience:   aud,
				abstained:  false,
				confidence: res.confidence,
				topScore:   res.topScore,
			}
		})
		return p.resultJSON, true, nil

	case "get_facts":
		q, errMsg := getStringArg(args, "query", false, 0, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for get_facts: "+errMsg, true), true, nil
		}
		slugs, errMsg := getStringArrayArg(args, "slugs", 0, 10, 1, 120)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for get_facts: "+errMsg, true), true, nil
		}
		kinds, errMsg := getStringArrayArg(args, "kinds", 0, 5, 1, 20)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for get_facts: "+errMsg, true), true, nil
		}
		for _, k := range kinds {
			if !validFactKinds[k] {
				return marshalToolText("Invalid arguments for get_facts: kinds must be in menu, rule, limit, error, formula", true), true, nil
			}
		}
		aud, errMsg := getSmartAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for get_facts: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 20, 1, 50)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for get_facts: "+errMsg, true), true, nil
		}
		normSlugs := make([]string, 0, len(slugs))
		for _, s := range slugs {
			if ts := strings.TrimSpace(s); ts != "" {
				normSlugs = append(normSlugs, ts)
			}
		}
		qTrim := strings.TrimSpace(q)
		rawArg := qTrim
		if rawArg == "" {
			if len(normSlugs) > 0 {
				rawArg = strings.Join(normSlugs, ",")
			} else if len(kinds) > 0 {
				rawArg = "kinds=" + strings.Join(kinds, ",")
			} else {
				rawArg = "*"
			}
		}
		key := fmt.Sprintf("%s|%d|%s|%s|%s", aud, lim, qTrim, strings.Join(normSlugs, ","), strings.Join(kinds, ","))
		p, _, _ := m.runCachedTool("get_facts", key, rawArg, func() cachedPayload {
			facts, matchedNotes := m.engine.CollectFacts(qTrim, normSlugs, kinds, aud, lim)
			if len(facts) == 0 {
				return cachedPayload{
					text:      fmt.Sprintf("No matching structured facts found (audience=%s). Try broader query, different kinds, or read_note.", aud),
					hits:      []EventHit{},
					totalHits: 0,
					audience:  aud,
				}
			}
			lines := make([]string, 0, len(facts)+1)
			lines = append(lines, fmt.Sprintf("[get_facts | audience=%s | count=%d]", aud, len(facts)))
			for _, f := range facts {
				lines = append(lines, fmt.Sprintf("- %s (slug: %s)", f.Formatted, f.Slug))
			}
			return cachedPayload{
				text:      strings.Join(lines, "\n"),
				hits:      matchedNotes,
				totalHits: len(facts),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "whats_new":
		days, _, errMsg := getIntArg(args, "days", 7, 1, 365)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for whats_new: "+errMsg, true), true, nil
		}
		aud, errMsg := getSmartAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for whats_new: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 20, 1, 50)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for whats_new: "+errMsg, true), true, nil
		}
		key := fmt.Sprintf("%s|%d|%d", aud, days, lim)
		p, _, _ := m.runCachedTool("whats_new", key, fmt.Sprintf("days=%d", days), func() cachedPayload {
			items := m.engine.WhatsNew(days, aud, lim)
			if len(items) == 0 {
				return cachedPayload{
					text:      fmt.Sprintf("No notes updated within the last %d day(s) (audience=%s). Try increasing days (e.g. days: 30).", days, aud),
					hits:      []EventHit{},
					totalHits: 0,
					audience:  aud,
				}
			}
			lines := make([]string, 0, len(items)+1)
			lines = append(lines, fmt.Sprintf("[whats_new | days=%d | audience=%s | count=%d]", days, aud, len(items)))
			evHits := make([]EventHit, 0, 6)
			for _, it := range items {
				dateShort := it.UpdatedAt
				if len(dateShort) >= 10 {
					dateShort = dateShort[:10]
				}
				tldrFlat := strings.TrimSpace(reWhitespace.ReplaceAllString(it.Tldr, " "))
				tldrShort := sliceRunes(tldrFlat, 140)
				lines = append(lines, fmt.Sprintf("- **%s** `%s` (%s | %s) — **%s**: %s", dateShort, it.Slug, it.Folder, it.Audience, it.Title, tldrShort))
				if len(evHits) < 6 {
					evHits = append(evHits, EventHit{Slug: it.Slug, Title: it.Title, Folder: it.Folder})
				}
			}
			return cachedPayload{
				text:      strings.Join(lines, "\n"),
				hits:      evHits,
				totalHits: len(items),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "verify_reference":
		menus, errMsg := getStringArrayArg(args, "menus", 0, 50, 1, 20)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for verify_reference: "+errMsg, true), true, nil
		}
		tables, errMsg := getStringArrayArg(args, "tables", 0, 50, 1, 100)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for verify_reference: "+errMsg, true), true, nil
		}
		columns, errMsg := getStringArrayArg(args, "columns", 0, 100, 1, 160)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for verify_reference: "+errMsg, true), true, nil
		}
		aud, errMsg := getSmartAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for verify_reference: "+errMsg, true), true, nil
		}
		var argBits []string
		if len(menus) > 0 {
			argBits = append(argBits, fmt.Sprintf("menus=%d", len(menus)))
		}
		if len(tables) > 0 {
			argBits = append(argBits, fmt.Sprintf("tables=%d", len(tables)))
		}
		if len(columns) > 0 {
			argBits = append(argBits, fmt.Sprintf("cols=%d", len(columns)))
		}
		rawArg := "empty"
		if len(argBits) > 0 {
			rawArg = strings.Join(argBits, " ")
		}
		key := fmt.Sprintf("%s|m:%s|t:%s|c:%s", aud, strings.Join(menus, ","), strings.Join(tables, ","), strings.Join(columns, ","))
		p, _, _ := m.runCachedTool("verify_reference", key, rawArg, func() cachedPayload {
			res := m.engine.grounding.VerifyReferences(VerifyReferenceInput{
				Menus:    menus,
				Tables:   tables,
				Columns:  columns,
				Audience: aud,
			})
			rawJSON, _ := json.Marshal(res)
			totalChecked := res.Summary.CheckedMenus + res.Summary.CheckedTables + res.Summary.CheckedColumns
			return cachedPayload{
				text:      string(rawJSON),
				hits:      []EventHit{},
				totalHits: totalChecked,
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "batch_read":
		slugs, errMsg := getStringArrayArg(args, "slugs", 1, 5, 1, 120)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_read: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_read: "+errMsg, true), true, nil
		}
		q, errMsg := getStringArg(args, "query", false, 0, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_read: "+errMsg, true), true, nil
		}
		capChars, _, errMsg := getIntArg(args, "max_chars_per_note", 2000, 500, 6000)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_read: "+errMsg, true), true, nil
		}
		stripLinks, errMsg := getBoolArg(args, "strip_links", true)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for batch_read: "+errMsg, true), true, nil
		}
		seenSlug := make(map[string]bool, len(slugs))
		normSlugs := make([]string, 0, len(slugs))
		for _, s := range slugs {
			ts := strings.TrimSpace(s)
			if ts != "" && !seenSlug[ts] {
				seenSlug[ts] = true
				normSlugs = append(normSlugs, ts)
			}
		}
		stripFlag := 0
		if stripLinks {
			stripFlag = 1
		}
		qTrim := strings.TrimSpace(q)
		key := fmt.Sprintf("%s|%d|%d|%s|%s", aud, capChars, stripFlag, qTrim, strings.Join(normSlugs, ","))
		p, _, _ := m.runCachedTool("batch_read", key, strings.Join(normSlugs, ", "), func() cachedPayload {
			var ts []string
			if qTrim != "" {
				ts = m.engine.tok.Terms(qTrim)
			}
			sections := make([]string, 0, len(normSlugs))
			evHits := make([]EventHit, 0, len(normSlugs))
			for _, slug := range normSlugs {
				n := m.engine.GetNote(slug)
				if n == nil {
					sections = append(sections, fmt.Sprintf("# [Not Found] %s\nNote \"%s\" not found.", slug, slug))
					continue
				}
				if !matchesAudience(n.Audience, aud) {
					sections = append(sections, fmt.Sprintf("# [Filtered] %s\nNote \"%s\" is outside audience=%s.", n.Slug, n.Slug, aud))
					continue
				}
				evHits = append(evHits, EventHit{Slug: n.Slug, Title: n.Title, Folder: n.Folder})
				baseBody := n.Body
				if stripLinks && n.CleanBody != "" {
					baseBody = n.CleanBody
				}
				body := baseBody
				if utf8.RuneCountInString(baseBody) > capChars || len(ts) > 0 {
					body = m.engine.ExcerptNote(n, ts, capChars, stripLinks)
				}
				sections = append(sections, formatNoteText(n, body, noteTextOpts{
					includeSources: aud != "user" && n.Audience == "dev",
					includeMedia:   false,
					includeLinks:   !stripLinks,
					linkCap:        6,
				}))
			}
			return cachedPayload{
				text:      strings.Join(sections, "\n\n---\n\n"),
				hits:      evHits,
				totalHits: len(evHits),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "ask_brain":
		q, errMsg := getStringArg(args, "question", true, 2, 500)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for ask_brain: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for ask_brain: "+errMsg, true), true, nil
		}
		isCompact, errMsg := getBoolArg(args, "compact", false)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for ask_brain: "+errMsg, true), true, nil
		}
		defMax := 3
		maxAllowed := 4
		if isCompact {
			defMax = 2
			maxAllowed = 2
		}
		maxNotes, hasMax, errMsg := getIntArg(args, "max_notes", defMax, 1, 4)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for ask_brain: "+errMsg, true), true, nil
		}
		if hasMax && maxNotes > maxAllowed {
			maxNotes = maxAllowed
		}
		compFlag := 0
		if isCompact {
			compFlag = 1
		}
		key := fmt.Sprintf("%s|%d|%d|%s", aud, compFlag, maxNotes, strings.TrimSpace(q))
		p, _, _ := m.runCachedTool("ask_brain", key, q, func() cachedPayload {
			meta := m.engine.SearchWithMeta(q, maxNotes, aud)
			if len(meta.Hits) == 0 {
				return cachedPayload{
					text:       fmt.Sprintf("🛑 Abstain — No matching notes (audience=%s). Do not guess—try other keywords (Thai or SQL/API identifiers) or list_notes.", aud),
					hits:       []EventHit{},
					totalHits:  0,
					audience:   aud,
					abstained:  true,
					confidence: "low",
					topScore:   0,
				}
			}
			denom := meta.TotalTerms
			if denom < 1 {
				denom = 1
			}
			coverage := float64(meta.BestMatchedTerms) / float64(denom)
			if meta.Confidence == "low" && (coverage < 0.5 || meta.TopScore < 18) {
				capC := len(meta.Hits)
				if capC > 3 {
					capC = 3
				}
				cands := make([]string, capC)
				for i := 0; i < capC; i++ {
					h := meta.Hits[i]
					cands[i] = fmt.Sprintf("- %s (%s) — %s", h.Slug, h.Folder, h.Title)
				}
				capE := len(meta.Hits)
				if capE > 2 {
					capE = 2
				}
				evHits := make([]EventHit, capE)
				for i := 0; i < capE; i++ {
					evHits[i] = EventHit{Slug: meta.Hits[i].Slug, Title: meta.Hits[i].Title, Folder: meta.Hits[i].Folder}
				}
				return cachedPayload{
					text: fmt.Sprintf(
						"🛑 Abstain — Insufficient Grounded Evidence in BC Brain (audience=%s, confidence=low, coverage=%d/%d, topScore=%d) for: %s\n\nDo NOT extrapolate or guess. State clearly that BC Brain has no verified record for this question.\nClosest topic candidates (inspect with read_note only if relevant):\n%s",
						aud, meta.BestMatchedTerms, meta.TotalTerms, meta.TopScore, q, strings.Join(cands, "\n"),
					),
					hits:       evHits,
					totalHits:  len(meta.Hits),
					audience:   aud,
					abstained:  true,
					confidence: "low",
					topScore:   meta.TopScore,
				}
			}

			selCap := maxNotes
			if meta.Confidence == "low" && selCap > 2 {
				selCap = 2
			}
			if selCap > len(meta.Hits) {
				selCap = len(meta.Hits)
			}
			selected := make([]SearchHit, 0, selCap)
			for i := 0; i < selCap; i++ {
				if meta.Confidence == "high" && i >= 2 && float64(meta.Hits[i].Score) < float64(meta.TopScore)*0.5 {
					continue
				}
				selected = append(selected, meta.Hits[i])
			}
			ts := m.engine.tok.Terms(q)
			showDevSources := aud == "dev"
			highCaps := []int{3600, 1800, 1200, 1000}
			lowCaps := []int{2600, 1400}
			if isCompact {
				highCaps = []int{2200, 1100}
				lowCaps = []int{1800, 1000}
			}
			linkCap := 5
			if isCompact {
				linkCap = 3
			}
			parts := make([]string, len(selected))
			selSlugs := make([]string, len(selected))
			evHits := make([]EventHit, len(selected))
			for i, h := range selected {
				n := m.engine.GetNote(h.Slug)
				selSlugs[i] = n.Slug
				evHits[i] = EventHit{Slug: n.Slug, Title: n.Title, Folder: n.Folder}
				capB := 1200
				if meta.Confidence == "low" {
					if i < len(lowCaps) {
						capB = lowCaps[i]
					}
				} else if i < len(highCaps) {
					capB = highCaps[i]
				}
				parts[i] = formatNoteText(n, m.engine.ExcerptNote(n, ts, capB, true), noteTextOpts{
					includeSources: showDevSources,
					linkCap:        linkCap,
					includeMedia:   false,
					includeLinks:   true,
				})
			}

			graphLim := 4
			if isCompact {
				graphLim = 2
			} else if meta.Confidence == "low" {
				graphLim = 3
			}
			graphCtx := m.engine.ConnectedNeighbors(selSlugs, aud, graphLim)
			ctxBlock := ""
			if len(graphCtx) > 0 {
				glines := make([]string, len(graphCtx))
				for i, g := range graphCtx {
					glines[i] = fmt.Sprintf("- [%s · %s] %s (%s) — %s (via %s)", g.Rel, relationLabel[g.Rel], g.Slug, g.Folder, g.Title, g.Via)
				}
				ctxBlock = "\n\n---\n\n## Connected Graph Context (1-hop — use batch_read or traverse_brain to inspect)\n" + strings.Join(glines, "\n")
			}

			mediaCtx := ""
			if aud != "dev" {
				mi, mv, mp := 3, 3, 2
				if isCompact {
					mi, mv, mp = 2, 2, 1
				}
				mediaCtx = formatAggregatedMediaBlock(m.engine.CollectRelatedMedia(selSlugs, aud, mi, mv, mp))
			}

			guardrailBanner := ""
			if meta.Confidence == "low" {
				guardrailBanner = fmt.Sprintf("\n> ⚠️ Low-confidence match (matched %d/%d query terms, top score %d). Verify carefully before answering; if the notes below do not directly answer the question, state honestly that BC Brain has no verified record instead of guessing.\n",
					meta.BestMatchedTerms, meta.TotalTerms, meta.TopScore)
			}
			outText := fmt.Sprintf("Top %d notes (audience=%s, confidence=%s, coverage=%d/%d) for: %s%s\n\n%s%s%s",
				len(selected), aud, meta.Confidence, meta.BestMatchedTerms, meta.TotalTerms, q, guardrailBanner, strings.Join(parts, "\n\n---\n\n"), mediaCtx, ctxBlock)
			return cachedPayload{
				text:       outText,
				hits:       evHits,
				totalHits:  len(selected),
				audience:   aud,
				confidence: meta.Confidence,
			}
		})
		return p.resultJSON, true, nil

	case "search_brain":
		q, errMsg := getStringArg(args, "query", true, 1, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_brain: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 5, 1, 20)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_brain: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for search_brain: "+errMsg, true), true, nil
		}
		key := fmt.Sprintf("%s|%d|%s", aud, lim, strings.TrimSpace(q))
		p, _, _ := m.runCachedTool("search_brain", key, q, func() cachedPayload {
			hits := m.engine.Search(q, lim, aud)
			topScore := 0
			if len(hits) > 0 {
				topScore = hits[0].Score
			}
			conf := "medium"
			if len(hits) == 0 || topScore < 18 {
				conf = "low"
			} else if topScore >= 35 {
				conf = "high"
			}
			type compactImg struct {
				Alt string `json:"alt"`
				URL string `json:"url"`
			}
			type compactVid struct {
				Title   string `json:"title"`
				URL     string `json:"url"`
				VideoID string `json:"videoId,omitempty"`
			}
			type compactHit struct {
				Slug     string       `json:"slug"`
				Title    string       `json:"title"`
				Folder   string       `json:"folder"`
				Audience string       `json:"audience"`
				Tags     []string     `json:"tags"`
				Score    int          `json:"score"`
				Snippet  string       `json:"snippet"`
				Images   []compactImg `json:"images,omitempty"`
				Videos   []compactVid `json:"videos,omitempty"`
			}
			compact := make([]compactHit, len(hits))
			evCap := len(hits)
			if evCap > 6 {
				evCap = 6
			}
			evHits := make([]EventHit, evCap)
			for i, h := range hits {
				snip := h.Snippet
				if utf8.RuneCountInString(snip) > 150 {
					snip = sliceRunes(snip, 147) + "..."
				}
				ch := compactHit{
					Slug:     h.Slug,
					Title:    h.Title,
					Folder:   h.Folder,
					Audience: h.Audience,
					Tags:     h.Tags,
					Score:    h.Score,
					Snippet:  snip,
				}
				if len(h.Images) > 0 {
					nImg := len(h.Images)
					if nImg > 2 {
						nImg = 2
					}
					ch.Images = make([]compactImg, nImg)
					for j := 0; j < nImg; j++ {
						ch.Images[j] = compactImg{Alt: h.Images[j].Alt, URL: h.Images[j].URL}
					}
				}
				if len(h.Videos) > 0 {
					nVid := len(h.Videos)
					if nVid > 2 {
						nVid = 2
					}
					ch.Videos = make([]compactVid, nVid)
					for j := 0; j < nVid; j++ {
						ch.Videos[j] = compactVid{Title: h.Videos[j].Title, URL: h.Videos[j].URL, VideoID: h.Videos[j].VideoID}
					}
				}
				compact[i] = ch
				if i < evCap {
					evHits[i] = EventHit{Slug: h.Slug, Title: h.Title, Folder: h.Folder}
				}
			}
			rawJSON, _ := json.Marshal(compact)
			return cachedPayload{
				text:       string(rawJSON),
				hits:       evHits,
				totalHits:  len(hits),
				audience:   aud,
				abstained:  len(hits) == 0,
				confidence: conf,
				topScore:   topScore,
			}
		})
		return p.resultJSON, true, nil

	case "traverse_brain":
		slug, errMsg := getStringArg(args, "slug", true, 1, 120)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for traverse_brain: "+errMsg, true), true, nil
		}
		toSlugArg, errMsg := getStringArg(args, "to_slug", false, 1, 120)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for traverse_brain: "+errMsg, true), true, nil
		}
		depth, _, errMsg := getIntArg(args, "depth", 2, 1, 3)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for traverse_brain: "+errMsg, true), true, nil
		}
		direction, errMsg := getStringArg(args, "direction", false, 0, 10)
		if errMsg != "" || (direction != "" && direction != "both" && direction != "out" && direction != "in") {
			return marshalToolText("Invalid arguments for traverse_brain: direction must be both, out, or in", true), true, nil
		}
		if direction == "" {
			direction = "both"
		}
		relation, errMsg := getStringArg(args, "relation", false, 0, 40)
		if errMsg != "" || (relation != "" && !relationSet[relation]) {
			return marshalToolText("Invalid arguments for traverse_brain: unknown relation", true), true, nil
		}
		folder, errMsg := getStringArg(args, "folder", false, 0, 40)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for traverse_brain: "+errMsg, true), true, nil
		}
		lim, _, errMsg := getIntArg(args, "limit", 25, 1, 50)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for traverse_brain: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for traverse_brain: "+errMsg, true), true, nil
		}

		rawArg := fmt.Sprintf("%s (depth=%d", slug, depth)
		if relation != "" {
			rawArg += ", " + relation
		}
		rawArg += ")"
		if toSlugArg != "" {
			rawArg = slug + " → " + toSlugArg
		}
		key := fmt.Sprintf("%s|%s|%s|%d|%s|%s|%s|%d", aud, slug, toSlugArg, depth, direction, relation, folder, lim)
		p, _, _ := m.runCachedTool("traverse_brain", key, rawArg, func() cachedPayload {
			res := m.engine.TraverseGraph(TraverseOptions{
				Slug:      slug,
				ToSlug:    toSlugArg,
				Depth:     depth,
				Direction: direction,
				Relation:  relation,
				Folder:    folder,
				Limit:     lim,
				Audience:  aud,
			})
			if res.Start == nil {
				return cachedPayload{
					text:      fmt.Sprintf(`Start note "%s" not found in audience=%s.`, slug, aud),
					hits:      []EventHit{},
					totalHits: 0,
					audience:  aud,
				}
			}
			header := fmt.Sprintf("# Traverse from %s | audience: %s | %s", res.Start.Slug, aud, res.Start.Title)
			startHit := EventHit{Slug: res.Start.Slug, Title: res.Start.Title, Folder: res.Start.Folder}

			if res.Mode == "path" {
				if res.Target == nil {
					return cachedPayload{
						text:      fmt.Sprintf("%s\nTarget note \"%s\" not found in audience=%s.", header, toSlugArg, aud),
						hits:      []EventHit{startHit},
						totalHits: 0,
						audience:  aud,
					}
				}
				if len(res.Path) == 0 {
					msg := fmt.Sprintf("%s\nNo path found to %s within 6 hops (audience=%s).", header, res.Target.Slug, aud)
					if res.Start.Slug == res.Target.Slug {
						msg = header + "\nSame note (0 hops)."
					}
					return cachedPayload{text: msg, hits: []EventHit{startHit}, totalHits: 0, audience: aud}
				}
				chainParts := []string{res.Start.Slug}
				lines := make([]string, len(res.Path))
				evHits := []EventHit{startHit}
				for i, s := range res.Path {
					arrow := fmt.Sprintf("<--[%s]--", s.Rel)
					if s.Direction == "out" {
						arrow = fmt.Sprintf("--[%s]-->", s.Rel)
					}
					chainParts = append(chainParts, arrow+" "+s.Slug)
					lines[i] = fmt.Sprintf("%d. %s | %s | %s | [%s] via %s — %s", s.Hop, s.Slug, s.Folder, s.Audience, s.Rel, s.Via, s.Title)
					if len(evHits) < 6 {
						evHits = append(evHits, EventHit{Slug: s.Slug, Title: s.Title, Folder: s.Folder})
					}
				}
				return cachedPayload{
					text:      fmt.Sprintf("%s\nPath (%d hops): %s\n\n%s", header, len(res.Path), strings.Join(chainParts, " "), strings.Join(lines, "\n")),
					hits:      evHits,
					totalHits: len(res.Path),
					audience:  aud,
				}
			}

			if len(res.Neighbors) == 0 {
				return cachedPayload{
					text:      fmt.Sprintf("%s\nNo matching connected notes (depth=%d, audience=%s).", header, depth, aud),
					hits:      []EventHit{startHit},
					totalHits: 0,
					audience:  aud,
				}
			}
			grouped := make(map[int][]TraverseStep)
			maxHop := 0
			evHits := []EventHit{startHit}
			for _, s := range res.Neighbors {
				grouped[s.Hop] = append(grouped[s.Hop], s)
				if s.Hop > maxHop {
					maxHop = s.Hop
				}
				if len(evHits) < 6 {
					evHits = append(evHits, EventHit{Slug: s.Slug, Title: s.Title, Folder: s.Folder})
				}
			}
			var secs []string
			for h := 1; h <= maxHop; h++ {
				steps := grouped[h]
				if len(steps) == 0 {
					continue
				}
				var sb strings.Builder
				sb.WriteString(fmt.Sprintf("## Hop %d (%d)", h, len(steps)))
				for _, s := range steps {
					sb.WriteString(fmt.Sprintf("\n- %s | %s | %s | [%s %s via %s] %s", s.Slug, s.Folder, s.Audience, s.Rel, s.Direction, s.Via, s.Title))
				}
				secs = append(secs, sb.String())
			}
			return cachedPayload{
				text:      header + "\n\n" + strings.Join(secs, "\n\n"),
				hits:      evHits,
				totalHits: len(res.Neighbors),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "read_note":
		slug, errMsg := getStringArg(args, "slug", true, 1, 120)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for read_note: "+errMsg, true), true, nil
		}
		q, errMsg := getStringArg(args, "query", false, 0, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for read_note: "+errMsg, true), true, nil
		}
		maxChars, hasMax, errMsg := getIntArg(args, "max_chars", 0, 500, 20000)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for read_note: "+errMsg, true), true, nil
		}
		qTrim := strings.TrimSpace(q)
		maxStr := ""
		if hasMax {
			maxStr = strconv.Itoa(maxChars)
		}
		key := fmt.Sprintf("%s|%s|%s", strings.TrimSpace(slug), qTrim, maxStr)
		p, _, _ := m.runCachedTool("read_note", key, slug, func() cachedPayload {
			n := m.engine.GetNote(slug)
			if n != nil {
				aud := n.Audience
				if aud == "both" {
					aud = "all"
				}
				body := n.Body
				if qTrim != "" || (hasMax && utf8.RuneCountInString(n.Body) > maxChars) {
					capB := 4000
					if hasMax {
						capB = maxChars
					}
					var ts []string
					if qTrim != "" {
						ts = m.engine.tok.Terms(qTrim)
					}
					body = m.engine.ExcerptNote(n, ts, capB, qTrim != "")
				}
				return cachedPayload{
					text: formatNoteText(n, body, noteTextOpts{
						includeSources: n.Audience == "dev",
						linkCap:        16,
						includeMedia:   true,
						includeLinks:   true,
					}),
					hits:      []EventHit{{Slug: n.Slug, Title: n.Title, Folder: n.Folder}},
					totalHits: 1,
					audience:  aud,
				}
			}
			cleanQ := strings.NewReplacer("-", " ", "_", " ").Replace(slug)
			near := m.engine.Search(cleanQ, 5, "all")
			hint := ""
			if len(near) > 0 {
				slugs := make([]string, len(near))
				for i, h := range near {
					slugs[i] = h.Slug
				}
				hint = " Closest: " + strings.Join(slugs, ", ") + "."
			}
			return cachedPayload{
				text:      fmt.Sprintf(`Note "%s" not found.%s Use search_brain or list_notes.`, slug, hint),
				hits:      []EventHit{},
				totalHits: 0,
				audience:  "all",
			}
		})
		return p.resultJSON, true, nil

	case "list_notes":
		folder, errMsg := getStringArg(args, "folder", false, 0, 40)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for list_notes: "+errMsg, true), true, nil
		}
		tag, errMsg := getStringArg(args, "tag", false, 0, 40)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for list_notes: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "all")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for list_notes: "+errMsg, true), true, nil
		}
		var argBits []string
		if folder != "" {
			argBits = append(argBits, "folder="+folder)
		}
		if tag != "" {
			argBits = append(argBits, "tag="+tag)
		}
		rawArg := "*"
		if len(argBits) > 0 {
			rawArg = strings.Join(argBits, " ")
		}
		key := fmt.Sprintf("%s|%s|%s", aud, strings.ToLower(folder), strings.ToLower(tag))
		p, _, _ := m.runCachedTool("list_notes", key, rawArg, func() cachedPayload {
			matched := m.engine.ListNotes(folder, tag, aud)
			if len(matched) == 0 {
				return cachedPayload{text: "No notes match.", hits: []EventHit{}, totalHits: 0, audience: aud}
			}
			rows := make([]string, len(matched))
			evCap := len(matched)
			if evCap > 5 {
				evCap = 5
			}
			evHits := make([]EventHit, evCap)
			for i, n := range matched {
				rows[i] = fmt.Sprintf("%s | %s | %s | %s | %s", n.Slug, n.Folder, n.Audience, n.Title, strings.Join(n.Tags, ","))
				if i < evCap {
					evHits[i] = EventHit{Slug: n.Slug, Title: n.Title, Folder: n.Folder}
				}
			}
			return cachedPayload{
				text:      strings.Join(rows, "\n"),
				hits:      evHits,
				totalHits: len(matched),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	case "find_media":
		q, errMsg := getStringArg(args, "query", false, 0, 300)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for find_media: "+errMsg, true), true, nil
		}
		kind, errMsg := getStringArg(args, "kind", false, 0, 20)
		if errMsg != "" || (kind != "" && kind != "all" && kind != "image" && kind != "youtube" && kind != "webpage") {
			return marshalToolText("Invalid arguments for find_media: kind must be all, image, youtube, or webpage", true), true, nil
		}
		if kind == "" {
			kind = "all"
		}
		lim, _, errMsg := getIntArg(args, "limit", 12, 1, 40)
		if errMsg != "" {
			return marshalToolText("Invalid arguments for find_media: "+errMsg, true), true, nil
		}
		aud, errMsg := getAudienceArg(args, "user")
		if errMsg != "" {
			return marshalToolText("Invalid arguments for find_media: "+errMsg, true), true, nil
		}
		qTrim := strings.TrimSpace(q)
		if qTrim == "" {
			qTrim = "*"
		}
		rawArg := qTrim
		if kind != "all" {
			rawArg += " kind=" + kind
		}
		key := fmt.Sprintf("%s|%s|%d|%s", aud, kind, lim, qTrim)
		p, _, _ := m.runCachedTool("find_media", key, rawArg, func() cachedPayload {
			items, used := m.engine.FindMedia(q, kind, aud, lim)
			if items == nil {
				items = []MediaItem{}
			}
			respObj := map[string]any{
				"playlistUrl": "https://www.youtube.com/playlist?list=PLO9P7tPZLXB0",
				"websiteUrl":  "https://bcaccount.com",
				"count":       len(items),
				"items":       items,
			}
			rawJSON, _ := json.Marshal(respObj)
			evCap := len(used)
			if evCap > 5 {
				evCap = 5
			}
			return cachedPayload{
				text:      string(rawJSON),
				hits:      used[:evCap],
				totalHits: len(items),
				audience:  aud,
			}
		})
		return p.resultJSON, true, nil

	default:
		return nil, false, nil
	}
}

// ---------- Stateless JSON-RPC 2.0 Dispatcher (Single + Batch) ----------
type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  map[string]any  `json:"params"`
}

func (m *MCPService) dispatchSingle(raw json.RawMessage) []byte {
	var req jsonRPCRequest
	if err := json.Unmarshal(raw, &req); err != nil || req.Method == "" {
		idPart := []byte("null")
		if len(req.ID) > 0 {
			idPart = req.ID
		}
		return []byte(fmt.Sprintf(`{"jsonrpc":"2.0","id":%s,"error":{"code":-32600,"message":"Invalid Request"}}`, idPart))
	}
	if len(req.ID) == 0 || strings.HasPrefix(req.Method, "notifications/") {
		return nil
	}
	idJSON := bytes.TrimSpace(req.ID)

	switch req.Method {
	case "initialize":
		proto := defaultProtocolVersion
		if req.Params != nil {
			if pv, ok := req.Params["protocolVersion"].(string); ok && pv != "" {
				proto = pv
			}
		}
		resObj := map[string]any{
			"protocolVersion": proto,
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      m.serverInfo,
			"instructions":    m.instructions,
		}
		resBytes, _ := json.Marshal(resObj)
		return wrapJSONRPCResult(idJSON, resBytes)

	case "ping":
		return wrapJSONRPCResult(idJSON, m.emptyObj)

	case "tools/list":
		return wrapJSONRPCResult(idJSON, m.toolsListJSON)

	case "resources/list":
		return wrapJSONRPCResult(idJSON, m.emptyResources)

	case "prompts/list":
		return wrapJSONRPCResult(idJSON, m.emptyPrompts)

	case "tools/call":
		toolName := ""
		var toolArgs map[string]any
		if req.Params != nil {
			if tn, ok := req.Params["name"].(string); ok {
				toolName = tn
			}
			if ta, ok := req.Params["arguments"].(map[string]any); ok {
				toolArgs = ta
			}
		}
		resBytes, known, err := m.callTool(toolName, toolArgs)
		if !known {
			errMsg, _ := json.Marshal("Unknown tool: " + toolName)
			return []byte(fmt.Sprintf(`{"jsonrpc":"2.0","id":%s,"error":{"code":-32602,"message":%s}}`, idJSON, errMsg))
		}
		if err != nil {
			return wrapJSONRPCResult(idJSON, marshalToolText("Error running "+toolName+": "+err.Error(), true))
		}
		return wrapJSONRPCResult(idJSON, resBytes)

	default:
		errMsg, _ := json.Marshal("Method not found: " + req.Method)
		return []byte(fmt.Sprintf(`{"jsonrpc":"2.0","id":%s,"error":{"code":-32601,"message":%s}}`, idJSON, errMsg))
	}
}

func wrapJSONRPCResult(idJSON, resultJSON []byte) []byte {
	var buf bytes.Buffer
	buf.Grow(len(idJSON) + len(resultJSON) + 32)
	buf.WriteString(`{"jsonrpc":"2.0","id":`)
	buf.Write(idJSON)
	buf.WriteString(`,"result":`)
	buf.Write(resultJSON)
	buf.WriteByte('}')
	return buf.Bytes()
}

func (m *MCPService) HandleJSONRPCPayload(raw []byte) (int, []byte) {
	if len(raw) > maxBodyBytes {
		return 413, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}`)
	}
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return 400, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: invalid JSON."}}`)
	}
	if trimmed[0] == '[' {
		var batch []json.RawMessage
		if err := json.Unmarshal(trimmed, &batch); err != nil {
			return 400, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: invalid JSON."}}`)
		}
		if len(batch) == 0 {
			return 400, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Invalid Request: empty batch."}}`)
		}
		var out [][]byte
		for _, item := range batch {
			if r := m.dispatchSingle(item); r != nil {
				out = append(out, r)
			}
		}
		if len(out) == 0 {
			return 202, nil
		}
		var buf bytes.Buffer
		buf.WriteByte('[')
		for i, r := range out {
			if i > 0 {
				buf.WriteByte(',')
			}
			buf.Write(r)
		}
		buf.WriteByte(']')
		return 200, buf.Bytes()
	}

	var check any
	if err := json.Unmarshal(trimmed, &check); err != nil {
		return 400, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: invalid JSON."}}`)
	}
	single := m.dispatchSingle(trimmed)
	if single == nil {
		return 202, nil
	}
	return 200, single
}

// ---------- Fast REST API Helpers (/api/*) ----------
type FastRestResult struct {
	OK         bool       `json:"ok"`
	Kind       string     `json:"kind"`
	Audience   string     `json:"audience"`
	Mode       string     `json:"mode"`
	Answer     string     `json:"answer"`
	Abstained  bool       `json:"abstained"`
	Confidence string     `json:"confidence"`
	Facts      []string   `json:"facts"`
	Hits       []EventHit `json:"hits"`
	Ms         float64    `json:"ms"`
	Cached     bool       `json:"cached"`
}

func normalizeRestAudience(raw, def string) string {
	switch raw {
	case "user":
		return "user"
	case "dev":
		return "dev"
	case "all", "both":
		return "all"
	default:
		return def
	}
}

func (m *MCPService) RunFastRestQuery(q, menu, audience, mode string, includeMedia bool, maxChars int) FastRestResult {
	filter := normalizeRestAudience(audience, "user")
	if strings.TrimSpace(menu) != "" {
		mq := strings.TrimSpace(menu)
		key := fmt.Sprintf("%s|6|%s", filter, mq)
		p, ms, cached := m.runCachedTool("lookup_menu", key, mq, func() cachedPayload {
			res := m.engine.LookupDirect(mq, filter, 6)
			if res.Kind == "none" {
				return cachedPayload{
					text:      fmt.Sprintf(`No direct menu code or SQL table match for "%s" (audience=%s). Try quick_answer or search_brain.`, mq, filter),
					hits:      []EventHit{},
					totalHits: 0,
					audience:  filter,
				}
			}
			var lines []string
			evHits := make([]EventHit, 0, 6)
			if len(res.Menus) > 0 {
				lines = append(lines, fmt.Sprintf("## Menus (%d)", len(res.Menus)))
				for _, mn := range res.Menus {
					docList := " | catalog: " + mn.CatalogSlug
					if len(mn.Docs) > 0 {
						slugs := make([]string, len(mn.Docs))
						for i, d := range mn.Docs {
							slugs[i] = d.Slug
						}
						docList = " | docs: " + strings.Join(slugs, ", ")
					}
					legacy := ""
					if mn.LegacyCode != "" && mn.LegacyCode != "—" {
						legacy = " (" + mn.LegacyCode + ")"
					}
					lines = append(lines, fmt.Sprintf("- **%s**%s **%s** — %s · %s%s", mn.Code, legacy, mn.Name, mn.MenuPath, mn.Edition, docList))
					if len(evHits) < 6 {
						if len(mn.Docs) > 0 {
							evHits = append(evHits, EventHit{Slug: mn.Docs[0].Slug, Title: mn.Docs[0].Title, Folder: mn.Docs[0].Folder})
						} else {
							evHits = append(evHits, EventHit{Slug: mn.CatalogSlug, Title: mn.Code + " " + mn.Name, Folder: "start"})
						}
					}
				}
			}
			if len(res.Tables) > 0 {
				lines = append(lines, fmt.Sprintf("## SQL Tables (%d)", len(res.Tables)))
				for _, tb := range res.Tables {
					rel := ""
					if len(tb.Docs) > 0 {
						slugs := make([]string, len(tb.Docs))
						for i, d := range tb.Docs {
							slugs[i] = d.Slug
						}
						rel = " | related: " + strings.Join(slugs, ", ")
					}
					lines = append(lines, fmt.Sprintf("- `%s` → schema: `%s` (%s)%s", tb.Table, tb.SchemaSlug, tb.SchemaTitle, rel))
					if len(evHits) < 6 {
						evHits = append(evHits, EventHit{Slug: tb.SchemaSlug, Title: tb.SchemaTitle, Folder: "schema"})
					}
				}
			}
			return cachedPayload{
				text:      strings.Join(lines, "\n"),
				hits:      evHits,
				totalHits: len(res.Menus) + len(res.Tables),
				audience:  filter,
			}
		})
		conf := "low"
		if p.totalHits > 0 {
			conf = "high"
		}
		hits := p.hits
		if hits == nil {
			hits = []EventHit{}
		}
		return FastRestResult{
			OK:         true,
			Kind:       "menu",
			Audience:   filter,
			Mode:       "direct",
			Answer:     p.text,
			Abstained:  p.totalHits == 0,
			Confidence: conf,
			Facts:      []string{},
			Hits:       hits,
			Ms:         math.Round(ms*100) / 100,
			Cached:     cached,
		}
	}

	qTrim := strings.TrimSpace(q)
	if mode != "normal" && mode != "fast" {
		mode = "ultra"
	}
	if utf8.RuneCountInString(qTrim) < 2 {
		return FastRestResult{
			OK:         false,
			Kind:       "answer",
			Audience:   filter,
			Mode:       mode,
			Answer:     "Missing query parameter ?q=... (min 2 chars) or ?menu=4013",
			Abstained:  true,
			Confidence: "low",
			Facts:      []string{},
			Hits:       []EventHit{},
		}
	}
	budget := maxChars
	if budget <= 0 {
		switch mode {
		case "ultra":
			budget = 700
		case "fast":
			budget = 1400
		default:
			budget = 2000
		}
	}
	mediaFlag := 0
	if includeMedia {
		mediaFlag = 1
	}
	key := fmt.Sprintf("%s|%s|%d|%d|1|%s", filter, mode, budget, mediaFlag, qTrim)
	p, ms, cached := m.runCachedTool("quick_answer", key, qTrim, func() cachedPayload {
		return m.buildQuickAnswer(qTrim, filter, mode, budget, includeMedia, true)
	})
	conf := p.confidence
	if conf == "" {
		conf = "medium"
	}
	facts := p.facts
	if facts == nil {
		facts = []string{}
	}
	hits := p.hits
	if hits == nil {
		hits = []EventHit{}
	}
	return FastRestResult{
		OK:         true,
		Kind:       "answer",
		Audience:   filter,
		Mode:       mode,
		Answer:     p.text,
		Abstained:  p.abstained,
		Confidence: conf,
		Facts:      facts,
		Hits:       hits,
		Ms:         math.Round(ms*100) / 100,
		Cached:     cached,
	}
}

type ErrorRestHit struct {
	ErrorText  string `json:"errorText"`
	FixSnippet string `json:"fixSnippet"`
	Slug       string `json:"slug"`
	Title      string `json:"title"`
	Folder     string `json:"folder"`
	Audience   string `json:"audience"`
}

type ErrorRestResult struct {
	OK        bool           `json:"ok"`
	Error     string         `json:"error,omitempty"`
	Query     string         `json:"query"`
	Audience  string         `json:"audience"`
	Count     int            `json:"count"`
	Abstained bool           `json:"abstained"`
	Hits      []ErrorRestHit `json:"hits"`
	Ms        float64        `json:"ms"`
}

func (m *MCPService) RunErrorRestQuery(q, audience string, limit int) ErrorRestResult {
	t0 := time.Now()
	filter := normalizeRestAudience(audience, "user")
	qTrim := strings.TrimSpace(q)
	if qTrim == "" {
		return ErrorRestResult{
			OK:        false,
			Error:     "Missing query parameter ?q=...",
			Query:     "",
			Audience:  filter,
			Count:     0,
			Abstained: true,
			Hits:      []ErrorRestHit{},
			Ms:        0,
		}
	}
	if limit < 1 {
		limit = 5
	}
	if limit > 15 {
		limit = 15
	}
	entries := m.engine.LookupError(qTrim, filter, limit)
	abstained := len(entries) == 0
	if abstained {
		m.gaps.Record("lookup_error", qTrim, filter, "zero_hit", 0)
	}
	hits := make([]ErrorRestHit, len(entries))
	for i, e := range entries {
		hits[i] = ErrorRestHit{
			ErrorText:  e.ErrorText,
			FixSnippet: e.FixSnippet,
			Slug:       e.Slug,
			Title:      e.Title,
			Folder:     e.Folder,
			Audience:   e.Audience,
		}
	}
	ms := float64(time.Since(t0).Microseconds()) / 1000.0
	return ErrorRestResult{
		OK:        true,
		Query:     qTrim,
		Audience:  filter,
		Count:     len(hits),
		Abstained: abstained,
		Hits:      hits,
		Ms:        math.Round(ms*100) / 100,
	}
}

type SectionsRestResult struct {
	OK        bool                 `json:"ok"`
	Error     string               `json:"error,omitempty"`
	Query     string               `json:"query"`
	Audience  string               `json:"audience"`
	Count     int                  `json:"count"`
	Abstained bool                 `json:"abstained"`
	Sections  []SectionExcerptItem `json:"sections"`
	Ms        float64              `json:"ms"`
}

func (m *MCPService) RunSectionsRestQuery(q, audience string, limit, maxChars int) SectionsRestResult {
	t0 := time.Now()
	filter := normalizeRestAudience(audience, "user")
	qTrim := strings.TrimSpace(q)
	if qTrim == "" {
		return SectionsRestResult{
			OK:        false,
			Error:     "Missing query parameter ?q=...",
			Query:     "",
			Audience:  filter,
			Count:     0,
			Abstained: true,
			Sections:  []SectionExcerptItem{},
			Ms:        0,
		}
	}
	res := m.searchSectionsCore(qTrim, filter, limit, maxChars)
	if res.abstained || res.confidence == "low" {
		reason := "low_conf"
		if res.abstained {
			reason = "zero_hit"
		}
		m.gaps.Record("search_sections", qTrim, filter, reason, res.topScore)
	}
	ms := float64(time.Since(t0).Microseconds()) / 1000.0
	return SectionsRestResult{
		OK:        true,
		Query:     qTrim,
		Audience:  filter,
		Count:     len(res.sections),
		Abstained: res.abstained,
		Sections:  res.sections,
		Ms:        math.Round(ms*100) / 100,
	}
}

type FactsRestResult struct {
	OK       bool             `json:"ok"`
	Audience string           `json:"audience"`
	Count    int              `json:"count"`
	Facts    []FactResultItem `json:"facts"`
	Ms       float64          `json:"ms"`
}

func (m *MCPService) RunFactsRestQuery(q string, slugs, kinds []string, audience string, limit int) FactsRestResult {
	t0 := time.Now()
	filter := normalizeRestAudience(audience, "user")
	facts, _ := m.engine.CollectFacts(q, slugs, kinds, filter, limit)
	if facts == nil {
		facts = []FactResultItem{}
	}
	ms := float64(time.Since(t0).Microseconds()) / 1000.0
	return FactsRestResult{
		OK:       true,
		Audience: filter,
		Count:    len(facts),
		Facts:    facts,
		Ms:       math.Round(ms*100) / 100,
	}
}

type WhatsNewRestItem struct {
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	Folder    string `json:"folder"`
	Audience  string `json:"audience"`
	UpdatedAt string `json:"updatedAt"`
	Tldr      string `json:"tldr"`
}

type WhatsNewRestResult struct {
	OK       bool               `json:"ok"`
	Days     int                `json:"days"`
	Audience string             `json:"audience"`
	Count    int                `json:"count"`
	Items    []WhatsNewRestItem `json:"items"`
	Ms       float64            `json:"ms"`
}

func (m *MCPService) RunWhatsNewRestQuery(days int, audience string, limit int) WhatsNewRestResult {
	t0 := time.Now()
	filter := normalizeRestAudience(audience, "user")
	if days < 1 {
		days = 7
	}
	if days > 365 {
		days = 365
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	rows := m.engine.WhatsNew(days, filter, limit)
	items := make([]WhatsNewRestItem, len(rows))
	for i, r := range rows {
		items[i] = WhatsNewRestItem{
			Slug:      r.Slug,
			Title:     r.Title,
			Folder:    r.Folder,
			Audience:  r.Audience,
			UpdatedAt: r.UpdatedAt,
			Tldr:      r.Tldr,
		}
	}
	ms := float64(time.Since(t0).Microseconds()) / 1000.0
	return WhatsNewRestResult{
		OK:       true,
		Days:     days,
		Audience: filter,
		Count:    len(items),
		Items:    items,
		Ms:       math.Round(ms*100) / 100,
	}
}

func (m *MCPService) RunVerifyRestQuery(input VerifyReferenceInput) VerifyReferenceResult {
	return m.engine.grounding.VerifyReferences(input)
}

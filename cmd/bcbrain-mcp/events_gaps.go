package main

import (
	"encoding/json"
	"math"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	maxEventHistory = 40
	maxEventSubs    = 128
	maxArgRunes     = 96
	maxGapEntries   = 256
)

var bangkokTZ = time.FixedZone("Asia/Bangkok", 7*3600)

var (
	reCtrl       = regexp.MustCompile(`[\x00-\x1f\x7f]+`)
	reCredURI    = regexp.MustCompile(`(?i)\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|rediss|amqps?|http|https)://[^\s:@/]+:[^\s@/]+@[^\s]+`)
	reToken      = regexp.MustCompile(`\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|bcmcp_ro_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b`)
	reBearer     = regexp.MustCompile(`(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{8,}`)
	reSecretKV   = regexp.MustCompile(`(?i)(?:password|passwd|pwd|secret|token|api_?key)\s*[:=]\s*\S+`)
	reEmail      = regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`)
	reIPv4       = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	reThaiPhone  = regexp.MustCompile(`\b0[689]\d[- ]?\d{3}[- ]?\d{4}\b`)
	reMultiSpace = regexp.MustCompile(`\s+`)
)

// SanitizeArg strips control chars, credentials, tokens, emails, IPs, and phone numbers.
func SanitizeArg(raw string) string {
	s := reCtrl.ReplaceAllString(raw, " ")
	s = reCredURI.ReplaceAllString(s, "[REDACTED_URI]")
	s = reToken.ReplaceAllString(s, "[REDACTED]")
	s = reBearer.ReplaceAllString(s, "Bearer [REDACTED]")
	s = reSecretKV.ReplaceAllString(s, "[REDACTED]")
	s = reEmail.ReplaceAllString(s, "[REDACTED_EMAIL]")
	s = reIPv4.ReplaceAllString(s, "[REDACTED_IP]")
	s = reThaiPhone.ReplaceAllString(s, "[REDACTED_TEL]")
	s = strings.TrimSpace(reMultiSpace.ReplaceAllString(s, " "))
	if utf8.RuneCountInString(s) > maxArgRunes {
		return sliceRunes(s, maxArgRunes) + "…"
	}
	return s
}

type EventHit struct {
	Slug   string `json:"slug"`
	Title  string `json:"title"`
	Folder string `json:"folder"`
}

type McpCallEvent struct {
	ID        int64      `json:"id"`
	TS        string     `json:"ts"`
	Time      string     `json:"time"`
	Tool      string     `json:"tool"`
	Audience  string     `json:"audience"`
	Arg       string     `json:"arg"`
	Hits      []EventHit `json:"hits"`
	TotalHits int        `json:"totalHits"`
	Ms        float64    `json:"ms"`
}

type EventBus struct {
	mu      sync.Mutex
	seq     int64
	history []McpCallEvent
	subs    map[chan McpCallEvent]struct{}
}

func NewEventBus() *EventBus {
	return &EventBus{
		history: make([]McpCallEvent, 0, maxEventHistory),
		subs:    make(map[chan McpCallEvent]struct{}),
	}
}

func (b *EventBus) Emit(tool, audience, rawArg string, hits []EventHit, totalHits int, ms float64) McpCallEvent {
	now := time.Now().UTC()
	th := now.In(bangkokTZ)
	cappedHits := hits
	if len(cappedHits) > 6 {
		cappedHits = cappedHits[:6]
	}
	if cappedHits == nil {
		cappedHits = []EventHit{}
	}

	b.mu.Lock()
	b.seq++
	ev := McpCallEvent{
		ID:        b.seq,
		TS:        now.Format(time.RFC3339Nano),
		Time:      th.Format("15:04:05"),
		Tool:      tool,
		Audience:  audience,
		Arg:       SanitizeArg(rawArg),
		Hits:      cappedHits,
		TotalHits: totalHits,
		Ms:        math.Round(ms*10) / 10,
	}
	b.history = append(b.history, ev)
	if len(b.history) > maxEventHistory {
		b.history = b.history[len(b.history)-maxEventHistory:]
	}
	for ch := range b.subs {
		select {
		case ch <- ev:
		default:
			// drop if slow consumer so hot MCP request path never blocks
		}
	}
	b.mu.Unlock()
	return ev
}

func (b *EventBus) Recent(limit int) []McpCallEvent {
	if limit <= 0 {
		limit = 15
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	n := len(b.history)
	if n == 0 {
		return []McpCallEvent{}
	}
	start := n - limit
	if start < 0 {
		start = 0
	}
	out := make([]McpCallEvent, n-start)
	copy(out, b.history[start:])
	return out
}

func (b *EventBus) Subscribe() (<-chan McpCallEvent, func()) {
	ch := make(chan McpCallEvent, 16)
	b.mu.Lock()
	if len(b.subs) >= maxEventSubs {
		for old := range b.subs {
			delete(b.subs, old)
			break
		}
	}
	b.subs[ch] = struct{}{}
	b.mu.Unlock()
	unsub := func() {
		b.mu.Lock()
		delete(b.subs, ch)
		b.mu.Unlock()
	}
	return ch, unsub
}

// ---------- Sanitized Zero-Hit / Abstain Gap Feedback Log ----------
type GapRecord struct {
	Tool      string `json:"tool"`
	Audience  string `json:"audience"`
	Reason    string `json:"reason"` // "abstain" | "zero_hit" | "low_conf"
	Query     string `json:"query"`
	Count     int    `json:"count"`
	TopScore  int    `json:"topScore"`
	FirstSeen string `json:"firstSeen"`
	LastSeen  string `json:"lastSeen"`
}

type GapLog struct {
	mu          sync.Mutex
	entries     map[string]*GapRecord
	order       []string
	totalEvents int
	filePath    string
}

func NewGapLog(filePath string) *GapLog {
	return &GapLog{
		entries:  make(map[string]*GapRecord, 64),
		order:    make([]string, 0, 64),
		filePath: strings.TrimSpace(filePath),
	}
}

func (g *GapLog) Record(tool, query, audience, reason string, topScore int) {
	cleanQ := SanitizeArg(query)
	if cleanQ == "" {
		return
	}
	if audience == "" {
		audience = "all"
	}
	if reason == "" {
		reason = "zero_hit"
	}
	nowStr := time.Now().UTC().Format(time.RFC3339)
	key := tool + "\x00" + audience + "\x00" + reason + "\x00" + strings.ToLower(cleanQ)

	g.mu.Lock()
	g.totalEvents++
	var snap GapRecord
	if existing, ok := g.entries[key]; ok {
		existing.Count++
		existing.LastSeen = nowStr
		if topScore > existing.TopScore {
			existing.TopScore = topScore
		}
		snap = *existing
	} else {
		if len(g.entries) >= maxGapEntries && len(g.order) > 0 {
			oldest := g.order[0]
			g.order = g.order[1:]
			delete(g.entries, oldest)
		}
		rec := &GapRecord{
			Tool:      tool,
			Audience:  audience,
			Reason:    reason,
			Query:     cleanQ,
			Count:     1,
			TopScore:  topScore,
			FirstSeen: nowStr,
			LastSeen:  nowStr,
		}
		g.entries[key] = rec
		g.order = append(g.order, key)
		snap = *rec
	}
	fp := g.filePath
	g.mu.Unlock()

	if fp != "" {
		// Non-blocking best-effort JSONL append (safe no-op under ProtectSystem=strict)
		go func(path string, r GapRecord) {
			line, err := json.Marshal(r)
			if err != nil {
				return
			}
			f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
			if err != nil {
				return
			}
			defer f.Close()
			_, _ = f.Write(append(line, '\n'))
		}(fp, snap)
	}
}

type GapReport struct {
	OK          bool        `json:"ok"`
	Service     string      `json:"service"`
	Count       int         `json:"count"`
	TotalEvents int         `json:"totalEvents"`
	Gaps        []GapRecord `json:"gaps"`
}

func (g *GapLog) Report(limit int) GapReport {
	if limit <= 0 {
		limit = 50
	}
	if limit > maxGapEntries {
		limit = maxGapEntries
	}
	g.mu.Lock()
	list := make([]GapRecord, 0, len(g.entries))
	for _, r := range g.entries {
		list = append(list, *r)
	}
	total := g.totalEvents
	g.mu.Unlock()

	sort.Slice(list, func(a, b int) bool {
		if list[a].Count != list[b].Count {
			return list[a].Count > list[b].Count
		}
		return list[a].LastSeen > list[b].LastSeen
	})
	if len(list) > limit {
		list = list[:limit]
	}
	return GapReport{
		OK:          true,
		Service:     "bcbrain-mcp-go",
		Count:       len(list),
		TotalEvents: total,
		Gaps:        list,
	}
}

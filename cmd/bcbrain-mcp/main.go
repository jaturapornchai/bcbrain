package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	rateWindow  = 60 * time.Second
	rateMaxReq  = 300
	rateMaxKeys = 4096
)

type rateBucket struct {
	count   int
	resetAt time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*rateBucket
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{buckets: make(map[string]*rateBucket, 128)}
}

func (rl *RateLimiter) Check(ip string) (bool, int) {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()
	cur, ok := rl.buckets[ip]
	if !ok || !now.Before(cur.resetAt) {
		if !ok && len(rl.buckets) >= rateMaxKeys {
			for k, v := range rl.buckets {
				if !now.Before(v.resetAt) {
					delete(rl.buckets, k)
				}
			}
			if len(rl.buckets) >= rateMaxKeys {
				for k := range rl.buckets {
					delete(rl.buckets, k)
					break
				}
			}
		}
		rl.buckets[ip] = &rateBucket{count: 1, resetAt: now.Add(rateWindow)}
		return true, 0
	}
	cur.count++
	if cur.count > rateMaxReq {
		retry := int(math.Ceil(cur.resetAt.Sub(now).Seconds()))
		if retry < 1 {
			retry = 1
		}
		return false, retry
	}
	return true, 0
}

type Server struct {
	mcp          *MCPService
	limiter      *RateLimiter
	pack         *Pack
	openApiBytes []byte
	openApiEtag  string
}

var fallbackOpenApiSpec = []byte(`{"openapi":"3.1.0","info":{"title":"BC Brain API & MCP Server","version":"3.0.0"},"paths":{"/mcp":{"post":{"summary":"MCP JSON-RPC 2.0"}},"/api/verify":{"get":{"summary":"Verify references"},"post":{"summary":"Verify references"}}}}`)

func NewServer(pack *Pack, gapLogFile string, logEnabled bool) *Server {
	engine := NewEngine(pack)
	events := NewEventBus()
	gaps := NewGapLog(gapLogFile)
	mcp := NewMCPService(engine, events, gaps, logEnabled)

	openApiBytes := fallbackOpenApiSpec
	if len(pack.OpenApiSpec) > 2 {
		openApiBytes = []byte(pack.OpenApiSpec)
	}
	commit := pack.Meta.SyncCommit
	if commit == "" {
		commit = "local"
	}
	sum := sha256.Sum256(openApiBytes)
	openApiEtag := fmt.Sprintf(`"bcopenapi-%s-%s"`, commit, hex.EncodeToString(sum[:])[:12])

	return &Server{
		mcp:          mcp,
		limiter:      NewRateLimiter(),
		pack:         pack,
		openApiBytes: openApiBytes,
		openApiEtag:  openApiEtag,
	}
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if first := strings.TrimSpace(strings.Split(fwd, ",")[0]); first != "" {
			return first
		}
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "local"
}

func setCORSHeaders(h http.Header) {
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID, Mcp-Protocol-Version")
	h.Set("Access-Control-Expose-Headers", "Mcp-Session-Id, Retry-After, Mcp-Protocol-Version")
	h.Set("Mcp-Protocol-Version", defaultProtocolVersion)
	h.Set("Cache-Control", "no-store")
}

func writeJSON(w http.ResponseWriter, status int, body []byte) {
	setCORSHeaders(w.Header())
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		setCORSHeaders(w.Header())
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch r.URL.Path {
	case "/healthz":
		s.handleHealthz(w)
	case "/mcp/events":
		if r.Method == http.MethodGet {
			s.handleEvents(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/vault-pack":
		if r.Method == http.MethodGet {
			s.handleVaultPack(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/bootstrap-pack":
		if r.Method == http.MethodGet {
			s.handleBootstrapPack(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/fast":
		if r.Method == http.MethodGet {
			s.handleFast(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/error":
		if r.Method == http.MethodGet {
			s.handleError(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/sections":
		if r.Method == http.MethodGet {
			s.handleSections(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/facts":
		if r.Method == http.MethodGet {
			s.handleFacts(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/whats-new":
		if r.Method == http.MethodGet {
			s.handleWhatsNew(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/verify":
		if r.Method == http.MethodGet || r.Method == http.MethodPost {
			s.handleVerify(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/gaps":
		if r.Method == http.MethodGet {
			s.handleGaps(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/api/openapi.json":
		if r.Method == http.MethodGet {
			s.handleOpenApi(w, r)
			return
		}
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"error":"Method not allowed"}`))
	case "/mcp":
		s.handleMCP(w, r)
	default:
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"Not found"}`))
	}
}

func (s *Server) commitTag() string {
	if s.pack.Meta.SyncCommit != "" {
		return s.pack.Meta.SyncCommit
	}
	return "local"
}

func (s *Server) makeEtag(prefix string, stablePayload any) string {
	b, _ := json.Marshal(stablePayload)
	sum := sha256.Sum256(b)
	return fmt.Sprintf(`"%s-%s-%s"`, prefix, s.commitTag(), hex.EncodeToString(sum[:])[:12])
}

func splitCSV(raw string, maxItems int) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t == "" {
			continue
		}
		out = append(out, t)
		if maxItems > 0 && len(out) >= maxItems {
			break
		}
	}
	return out
}

func (s *Server) handleHealthz(w http.ResponseWriter) {
	resp := map[string]any{
		"ok":      true,
		"service": "bcbrain-mcp-go",
		"version": s.mcp.serverInfo.Version,
		"notes":   len(s.pack.Notes),
		"tools":   len(s.mcp.toolDescriptors),
		"capabilities": map[string]any{
			"hybridRrf":         true,
			"sectionBm25":       true,
			"structuredFacts":   true,
			"errorIndex":        true,
			"groundingVerifier": true,
			"gapTelemetry":      true,
			"recencyFeed":       true,
			"openApiVersion":    "3.1.0",
		},
		"grounding": s.mcp.engine.grounding.Stats(),
	}
	if s.pack.Meta.SyncCommit != "" {
		resp["commit"] = s.pack.Meta.SyncCommit
	}
	b, _ := json.Marshal(resp)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

func (s *Server) handleOpenApi(w http.ResponseWriter, r *http.Request) {
	const cacheCtrl = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600"
	if r.Header.Get("If-None-Match") == s.openApiEtag {
		w.Header().Set("ETag", s.openApiEtag)
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", cacheCtrl)
	w.Header().Set("ETag", s.openApiEtag)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(s.openApiBytes)
}

func (s *Server) handleGaps(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}
	lim := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= maxGapEntries {
			lim = n
		}
	}
	rep := s.mcp.gaps.Report(lim)
	b, _ := json.Marshal(rep)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

func (s *Server) handleError(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}
	q := r.URL.Query()
	aud := normalizeRestAudience(q.Get("audience"), "user")
	lim := 5
	if raw := q.Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= 15 {
			lim = n
		}
	}
	res := s.mcp.RunErrorRestQuery(q.Get("q"), aud, lim)
	stable := res
	stable.Ms = 0
	etag := s.makeEtag("bcerr", stable)
	cacheCtrl := "no-store"
	if res.OK {
		cacheCtrl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
	}
	if res.OK && r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body, _ := json.Marshal(res)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", cacheCtrl)
	if res.OK {
		w.Header().Set("ETag", etag)
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	status := http.StatusBadRequest
	if res.OK {
		status = http.StatusOK
	}
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func (s *Server) handleSections(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}
	q := r.URL.Query()
	aud := normalizeRestAudience(q.Get("audience"), "user")
	lim := 5
	if raw := q.Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= 15 {
			lim = n
		}
	}
	maxChars := 1200
	if raw := q.Get("max_chars"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 200 && n <= 6000 {
			maxChars = n
		}
	}
	res := s.mcp.RunSectionsRestQuery(q.Get("q"), aud, lim, maxChars)
	stable := res
	stable.Ms = 0
	etag := s.makeEtag("bcsec", stable)
	cacheCtrl := "no-store"
	if res.OK {
		cacheCtrl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
	}
	if res.OK && r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body, _ := json.Marshal(res)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", cacheCtrl)
	if res.OK {
		w.Header().Set("ETag", etag)
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	status := http.StatusBadRequest
	if res.OK {
		status = http.StatusOK
	}
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func (s *Server) handleFacts(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}
	q := r.URL.Query()
	aud := normalizeRestAudience(q.Get("audience"), "user")
	slugs := splitCSV(q.Get("slugs"), 10)
	rawKinds := splitCSV(q.Get("kinds"), 5)
	var kinds []string
	for _, k := range rawKinds {
		kl := strings.ToLower(k)
		if validFactKinds[kl] {
			kinds = append(kinds, kl)
		}
	}
	lim := 20
	if raw := q.Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= 50 {
			lim = n
		}
	}
	res := s.mcp.RunFactsRestQuery(q.Get("q"), slugs, kinds, aud, lim)
	stable := res
	stable.Ms = 0
	etag := s.makeEtag("bcfacts", stable)
	const cacheCtrl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
	if r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body, _ := json.Marshal(res)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", cacheCtrl)
	w.Header().Set("ETag", etag)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (s *Server) handleWhatsNew(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}
	q := r.URL.Query()
	aud := normalizeRestAudience(q.Get("audience"), "user")
	days := 7
	if raw := q.Get("days"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= 365 {
			days = n
		}
	}
	lim := 20
	if raw := q.Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= 50 {
			lim = n
		}
	}
	res := s.mcp.RunWhatsNewRestQuery(days, aud, lim)
	stable := res
	stable.Ms = 0
	etag := s.makeEtag("bcnew", stable)
	const cacheCtrl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
	if r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body, _ := json.Marshal(res)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", cacheCtrl)
	w.Header().Set("ETag", etag)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}

	if r.Method == http.MethodGet {
		q := r.URL.Query()
		aud := normalizeRestAudience(q.Get("audience"), "user")
		menus := splitCSV(q.Get("menus"), 50)
		tables := splitCSV(q.Get("tables"), 50)
		columns := splitCSV(q.Get("columns"), 100)
		if len(menus) == 0 && len(tables) == 0 && len(columns) == 0 {
			writeJSON(w, http.StatusBadRequest, []byte(`{"ok":false,"error":"Provide at least one of ?menus=, ?tables=, or ?columns="}`))
			return
		}
		res := s.mcp.RunVerifyRestQuery(VerifyReferenceInput{
			Menus:    menus,
			Tables:   tables,
			Columns:  columns,
			Audience: aud,
		})
		body, _ := json.Marshal(res)
		sum := sha256.Sum256(body)
		etag := fmt.Sprintf(`"bcverify-%s-%s"`, s.commitTag(), hex.EncodeToString(sum[:])[:12])
		const cacheCtrl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
		if r.Header.Get("If-None-Match") == etag {
			w.Header().Set("ETag", etag)
			w.Header().Set("Cache-Control", cacheCtrl)
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("ETag", etag)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
		return
	}

	// POST /api/verify
	if r.ContentLength > maxBodyBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, []byte(`{"ok":false,"error":"Request body too large (max 32 KB)."}`))
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, []byte(`{"ok":false,"error":"Failed to read request body."}`))
		return
	}
	if len(raw) > maxBodyBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, []byte(`{"ok":false,"error":"Request body too large (max 32 KB)."}`))
		return
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil || parsed == nil {
		writeJSON(w, http.StatusBadRequest, []byte(`{"ok":false,"error":"Invalid JSON body: expected an object with menus, tables, columns, and optional audience."}`))
		return
	}
	rawAud, _ := parsed["audience"].(string)
	aud := normalizeRestAudience(rawAud, "user")
	toArr := func(key string, maxItems int) []string {
		arr, ok := parsed[key].([]any)
		if !ok {
			return nil
		}
		out := make([]string, 0, len(arr))
		for _, item := range arr {
			if str, ok := item.(string); ok {
				if tr := strings.TrimSpace(str); tr != "" {
					out = append(out, tr)
					if len(out) >= maxItems {
						break
					}
				}
			}
		}
		return out
	}
	menus := toArr("menus", 50)
	tables := toArr("tables", 50)
	columns := toArr("columns", 100)
	if len(menus) == 0 && len(tables) == 0 && len(columns) == 0 {
		writeJSON(w, http.StatusBadRequest, []byte(`{"ok":false,"error":"Provide at least one non-empty array: menus, tables, or columns."}`))
		return
	}
	res := s.mcp.RunVerifyRestQuery(VerifyReferenceInput{
		Menus:    menus,
		Tables:   tables,
		Columns:  columns,
		Audience: aud,
	})
	body, _ := json.Marshal(res)
	writeJSON(w, http.StatusOK, body)
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("snapshot") == "1" {
		b, _ := json.Marshal(map[string]any{"events": s.mcp.events.Recent(20)})
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(b)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, []byte(`{"error":"streaming unsupported"}`))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)

	snap, _ := json.Marshal(s.mcp.events.Recent(12))
	_, _ = fmt.Fprintf(w, ": connected\n\nevent: snapshot\ndata: %s\n\n", snap)
	flusher.Flush()

	ch, unsub := s.mcp.events.Subscribe()
	defer unsub()

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case ev := <-ch:
			b, _ := json.Marshal(ev)
			if _, err := fmt.Fprintf(w, "id: %d\nevent: mcp\ndata: %s\n\n", ev.ID, b); err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *Server) handleVaultPack(w http.ResponseWriter, r *http.Request) {
	etag := s.pack.VaultPackEtag
	const cacheCtrl = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600"
	if etag != "" && r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", cacheCtrl)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	commit := s.pack.Meta.SyncCommit
	if commit == "" {
		commit = "local"
	}
	noteCount := s.pack.VaultPackNoteCount
	if noteCount == 0 {
		noteCount = len(s.pack.Notes)
	}
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", `inline; filename="bcbrain-vault-pack.json.gz"`)
	w.Header().Set("Content-Length", strconv.Itoa(len(s.pack.VaultPackGzip)))
	if etag != "" {
		w.Header().Set("ETag", etag)
	}
	w.Header().Set("Cache-Control", cacheCtrl)
	w.Header().Set("X-BCBrain-Notes", strconv.Itoa(noteCount))
	w.Header().Set("X-BCBrain-Commit", commit)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(s.pack.VaultPackGzip)
}

func (s *Server) handleBootstrapPack(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	aud := "user"
	if q.Get("audience") == "dev" {
		aud = "dev"
	}
	fmtMode := "text"
	if q.Get("format") == "json" {
		fmtMode = "json"
	}
	bp, ok := s.pack.BootstrapPacks[aud]
	if !ok {
		writeJSON(w, http.StatusNotFound, []byte(`{"error":"Bootstrap pack unavailable"}`))
		return
	}
	etag := bp.Etag
	if fmtMode == "json" && strings.HasSuffix(etag, `"`) {
		etag = etag[:len(etag)-1] + `-json"`
	}
	const cacheCtrl = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600"
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", cacheCtrl)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if etag != "" && r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	if fmtMode == "json" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		b, _ := json.Marshal(map[string]any{
			"audience": aud,
			"chars":    bp.Chars,
			"etag":     etag,
			"text":     bp.Text,
		})
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(b)
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, bp.Text)
}

func (s *Server) handleFast(w http.ResponseWriter, r *http.Request) {
	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"ok":false,"error":"Rate limit exceeded"}`))
		return
	}
	q := r.URL.Query()
	aud := normalizeRestAudience(q.Get("audience"), "user")
	mode := "ultra"
	if rawMode := q.Get("mode"); rawMode == "normal" || rawMode == "fast" {
		mode = rawMode
	}
	media := q.Get("media") == "1" || q.Get("media") == "true"
	maxChars := 0
	if rawMax := q.Get("max_chars"); rawMax != "" {
		if n, err := strconv.Atoi(rawMax); err == nil && n >= 300 && n <= 4500 {
			maxChars = n
		}
	}
	fmtMode := "json"
	if q.Get("format") == "text" {
		fmtMode = "text"
	}

	res := s.mcp.RunFastRestQuery(q.Get("q"), q.Get("menu"), aud, mode, media, maxChars)
	var body []byte
	if fmtMode == "text" {
		body = []byte(res.Answer)
	} else {
		body, _ = json.Marshal(res)
	}

	// Hash deterministic content only (exclude volatile telemetry fields ms & cached so ETag + 304 works on JSON)
	etag := s.makeEtag("bcfast", struct {
		Format     string     `json:"f"`
		Kind       string     `json:"k"`
		Audience   string     `json:"a"`
		Mode       string     `json:"m"`
		Confidence string     `json:"c"`
		Abstained  bool       `json:"ab"`
		Answer     string     `json:"ans"`
		Facts      []string   `json:"fa"`
		Hits       []EventHit `json:"h"`
	}{
		Format:     fmtMode,
		Kind:       res.Kind,
		Audience:   res.Audience,
		Mode:       res.Mode,
		Confidence: res.Confidence,
		Abstained:  res.Abstained,
		Answer:     res.Answer,
		Facts:      res.Facts,
		Hits:       res.Hits,
	})
	cacheHeader := "no-store"
	if res.OK {
		cacheHeader = "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
	}

	if res.OK && r.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", cacheHeader)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusNotModified)
		return
	}
	if fmtMode == "text" {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	} else {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	}
	w.Header().Set("Cache-Control", cacheHeader)
	if res.OK {
		w.Header().Set("ETag", etag)
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	status := http.StatusBadRequest
	if res.OK {
		status = http.StatusOK
	}
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func (s *Server) handleMCP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		w.Header().Set("Allow", "POST, DELETE, OPTIONS")
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Method not allowed: stateless MCP server uses POST /mcp."}}`))
		return
	case http.MethodDelete:
		setCORSHeaders(w.Header())
		w.WriteHeader(http.StatusOK)
		return
	case http.MethodPost:
		// continue
	default:
		w.Header().Set("Allow", "POST, DELETE, OPTIONS")
		writeJSON(w, http.StatusMethodNotAllowed, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Method not allowed."}}`))
		return
	}

	if ok, retry := s.limiter.Check(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		writeJSON(w, http.StatusTooManyRequests, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Rate limit exceeded (max 300 requests/minute). Please retry shortly."}}`))
		return
	}

	if r.ContentLength > maxBodyBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}`))
		return
	}

	raw, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Failed to read request body."}}`))
		return
	}
	if len(raw) > maxBodyBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, []byte(`{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}`))
		return
	}

	status, body := s.mcp.HandleJSONRPCPayload(raw)
	if body == nil {
		setCORSHeaders(w.Header())
		w.WriteHeader(status)
		return
	}
	writeJSON(w, status, body)
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func main() {
	debug.SetGCPercent(35)
	debug.SetMemoryLimit(64 << 20)
	t0 := time.Now()
	packPath := envOr("BC_GO_PACK_FILE", "./public/go-brain-pack.json")
	pack, err := LoadPack(packPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[bcbrain-mcp-go] fatal: %v\n", err)
		os.Exit(1)
	}
	jsonMs := float64(time.Since(t0).Microseconds()) / 1000.0
	t1 := time.Now()
	logEnabled := envOr("BC_MCP_LOG", "1") != "0"
	gapFile := os.Getenv("BC_GAP_LOG_FILE")
	srvHandler := NewServer(pack, gapFile, logEnabled)
	idxMs := float64(time.Since(t1).Microseconds()) / 1000.0
	loadMs := float64(time.Since(t0).Microseconds()) / 1000.0
	runtime.GC()
	debug.FreeOSMemory()

	host := envOr("HOSTNAME", "127.0.0.1")
	port := envOr("PORT", "3961")
	addr := net.JoinHostPort(host, port)

	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           srvHandler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0, // SSE stream stays open
		IdleTimeout:       65 * time.Second,
		MaxHeaderBytes:    16 * 1024,
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[bcbrain-mcp-go] listen %s failed: %v\n", addr, err)
		os.Exit(1)
	}

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	heapMB := float64(ms.Alloc) / (1024 * 1024)
	fmt.Fprintf(os.Stdout,
		"[bcbrain-mcp-go] listening on http://%s (v%s, notes=%d, menus=%d, tables=%d, errors=%d, pack=%dKB gz, load=%.1fms [json=%.1fms idx=%.1fms], heap=%.1fMB)\n",
		addr, pack.Meta.Version, len(pack.Notes), len(pack.Menus), len(pack.Tables), len(pack.Errors),
		len(pack.VaultPackGzip)/1024, loadMs, jsonMs, idxMs, heapMB,
	)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(ctx)
	}()

	if err := httpSrv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fmt.Fprintf(os.Stderr, "[bcbrain-mcp-go] serve error: %v\n", err)
		os.Exit(1)
	}
}

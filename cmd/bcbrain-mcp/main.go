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
	mcp     *MCPService
	limiter *RateLimiter
	pack    *Pack
}

func NewServer(pack *Pack, gapLogFile string, logEnabled bool) *Server {
	engine := NewEngine(pack)
	events := NewEventBus()
	gaps := NewGapLog(gapLogFile)
	mcp := NewMCPService(engine, events, gaps, logEnabled)
	return &Server{
		mcp:     mcp,
		limiter: NewRateLimiter(),
		pack:    pack,
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
	case "/api/gaps":
		if r.Method == http.MethodGet {
			s.handleGaps(w, r)
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

func (s *Server) handleHealthz(w http.ResponseWriter) {
	resp := struct {
		OK      bool   `json:"ok"`
		Service string `json:"service"`
		Version string `json:"version"`
		Notes   int    `json:"notes"`
		Commit  string `json:"commit,omitempty"`
	}{
		OK:      true,
		Service: "bcbrain-mcp-go",
		Version: s.mcp.serverInfo.Version,
		Notes:   len(s.pack.Notes),
		Commit:  s.pack.Meta.SyncCommit,
	}
	b, _ := json.Marshal(resp)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

func (s *Server) handleGaps(w http.ResponseWriter, r *http.Request) {
	lim := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
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
	rawAud := q.Get("audience")
	aud := "user"
	if rawAud == "dev" || rawAud == "all" {
		aud = rawAud
	}
	mode := "ultra"
	if q.Get("mode") == "normal" {
		mode = "normal"
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

	commit := s.pack.Meta.SyncCommit
	if commit == "" {
		commit = "local"
	}
	// Hash deterministic content only (exclude volatile telemetry fields ms & cached so ETag + 304 works on JSON)
	etagPayload, _ := json.Marshal(struct {
		Format     string     `json:"f"`
		Kind       string     `json:"k"`
		Audience   string     `json:"a"`
		Mode       string     `json:"m"`
		Confidence string     `json:"c"`
		Abstained  bool       `json:"ab"`
		Answer     string     `json:"ans"`
		Hits       []EventHit `json:"h"`
	}{
		Format:     fmtMode,
		Kind:       res.Kind,
		Audience:   res.Audience,
		Mode:       res.Mode,
		Confidence: res.Confidence,
		Abstained:  res.Abstained,
		Answer:     res.Answer,
		Hits:       res.Hits,
	})
	sum := sha256.Sum256(etagPayload)
	etag := fmt.Sprintf(`"bcfast-%s-%s"`, commit, hex.EncodeToString(sum[:])[:12])
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

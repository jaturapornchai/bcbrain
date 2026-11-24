package main

import (
	"math"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	bm25K1 = 1.2
	bm25B  = 0.75
)

type Posting struct {
	Idx []int32
	Raw []float32
	IDF float64
}

type SearchHit struct {
	Slug     string       `json:"slug"`
	Title    string       `json:"title"`
	Folder   string       `json:"folder"`
	Audience string       `json:"audience"`
	Tags     []string     `json:"tags"`
	Score    int          `json:"score"`
	Snippet  string       `json:"snippet"`
	Images   []ImageMedia `json:"images,omitempty"`
	Videos   []VideoMedia `json:"videos,omitempty"`
}

type SearchMetaResult struct {
	Hits             []SearchHit
	Confidence       string // "high" | "medium" | "low"
	TotalTerms       int
	BestMatchedTerms int
	TopScore         int
}

type SearchIndex struct {
	notes           []*Note
	slugToIdx       map[string]int
	avgLen          float64
	postings        map[string]*Posting
	fallbackMu      sync.RWMutex
	fallback        map[string]*Posting
	fallbackOrder   []string
	bodies          []string
	titles          []string
	metas           []string
	aliasSets       []map[string]bool
	neighborIdx     [][]int32
	neighborWeights [][]float32
	isHub           []bool
	bufPool         sync.Pool
}

type searchScratch struct {
	base    []float64
	matched []int32
}

type TraverseStep struct {
	Slug      string
	Title     string
	Folder    string
	Audience  string
	Hop       int
	Via       string
	Rel       string
	Direction string // "out" | "in"
	Shared    int
}

type TraverseOptions struct {
	Slug      string
	ToSlug    string
	Depth     int
	Direction string
	Relation  string
	Folder    string
	Audience  string
	Limit     int
}

type TraverseResult struct {
	Start     *Note
	Target    *Note
	Mode      string // "neighborhood" | "path"
	Neighbors []TraverseStep
	Path      []TraverseStep
}

type HydratedMenu struct {
	Code         string
	LegacyCode   string
	Name         string
	MenuPath     string
	Edition      string
	CatalogSlug  string
	RelatedSlugs []string
	Docs         []DocSummary
}

type HydratedTable struct {
	Table        string
	SchemaSlug   string
	SchemaTitle  string
	RelatedSlugs []string
	Docs         []DocSummary
}

type DocSummary struct {
	Slug     string
	Title    string
	Folder   string
	Audience string
}

type DirectLookupResult struct {
	Kind   string // "menu" | "table" | "mixed" | "none"
	Menus  []HydratedMenu
	Tables []HydratedTable
}

type MediaItem struct {
	Kind         string `json:"kind"`
	Title        string `json:"title"`
	URL          string `json:"url"`
	VideoID      string `json:"videoId,omitempty"`
	ListID       string `json:"listId,omitempty"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
	EmbedURL     string `json:"embedUrl,omitempty"`
	NoteSlug     string `json:"noteSlug"`
	NoteTitle    string `json:"noteTitle"`
}

type Engine struct {
	pack         *Pack
	tok          *Tokenizer
	notesBySlug  map[string]*Note
	indexes      map[string]*SearchIndex
	secIndexes   map[string]*SectionSearchIndex
	errIndex     *ErrorSearchIndex
	grounding    *GroundingRuntime
	menuByCode   map[string]*MenuLookupEntry
	menuByLegacy map[string]*MenuLookupEntry
	tableByName  map[string]*TableLookupEntry
	rowsByAud    map[string][]*Note
}

var (
	reMenu4          = regexp.MustCompile(`\b([1-9]\d{3})\b`)
	reMenuLegacy     = regexp.MustCompile(`\b([1-9](?:\.\d+){1,3})\b`)
	reBodyIdent      = regexp.MustCompile(`\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b`)
	reMenuNoise      = regexp.MustCompile(`^(?:เมนู|รหัส|รหัสเมนู|menu|หน้าจอ|เข้า|ตาราง|table)$`)
	reWhitespace     = regexp.MustCompile(`\s+`)
	reFenceLine      = regexp.MustCompile(`(?m)^` + "```")
	reDottedExact    = regexp.MustCompile(`^\d+(?:\.\d+)+$`)
	reSeeAlsoHeading = regexp.MustCompile(`^##\s+(?:ดูต่อที่เกี่ยวข้อง|ดูเพิ่มเติม|ลิงก์ที่เกี่ยวข้อง)(?:\s|$)`)
)

func stripSeeAlsoGo(body string) string {
	parts := strings.Split(body, "\n## ")
	if len(parts) <= 1 {
		return strings.TrimRight(body, " \t\r\n")
	}
	kept := make([]string, 0, len(parts))
	for i, p := range parts {
		if i == 0 {
			kept = append(kept, p)
			continue
		}
		sec := "## " + p
		if reSeeAlsoHeading.MatchString(strings.TrimLeft(sec, " \t")) {
			continue
		}
		kept = append(kept, sec)
	}
	res := strings.Join(kept, "\n")
	res = strings.TrimRight(res, " \t\r\n")
	if strings.HasSuffix(res, "\n---") {
		res = strings.TrimRight(res[:len(res)-4], " \t\r\n")
	}
	return res
}

func stripTypedWikiPrefix(body string) string {
	if !strings.Contains(body, "::") || !strings.Contains(body, "[[") {
		return body
	}
	var sb strings.Builder
	sb.Grow(len(body))
	rest := body
	for len(rest) > 0 {
		idx := strings.Index(rest, "[[")
		if idx < 0 {
			sb.WriteString(rest)
			break
		}
		sb.WriteString(rest[:idx+2])
		rest = rest[idx+2:]
		sep := strings.Index(rest, "::")
		if sep > 0 && sep <= 20 && relationSet[rest[:sep]] {
			rest = rest[sep+2:]
		}
	}
	return sb.String()
}

var broadMediaHubs = map[string]bool{
	"index":                             true,
	"video-visual-tutorials":            true,
	"website-manual-and-blog-directory": true,
}

func NewEngine(pack *Pack) *Engine {
	tok := NewTokenizer(pack.Vocab, pack.StopWords, pack.Synonyms)
	e := &Engine{
		pack:         pack,
		tok:          tok,
		notesBySlug:  make(map[string]*Note, len(pack.Notes)),
		indexes:      make(map[string]*SearchIndex, 3),
		secIndexes:   make(map[string]*SectionSearchIndex, 3),
		grounding:    NewGroundingRuntime(pack.GroundingIndex),
		menuByCode:   make(map[string]*MenuLookupEntry, len(pack.Menus)),
		menuByLegacy: make(map[string]*MenuLookupEntry, len(pack.Menus)),
		tableByName:  make(map[string]*TableLookupEntry, len(pack.Tables)),
		rowsByAud:    make(map[string][]*Note, 3),
	}

	for _, n := range pack.Notes {
		if n.Tags == nil {
			n.Tags = []string{}
		}
		if n.Aliases == nil {
			n.Aliases = []string{}
		}
		if n.Sources == nil {
			n.Sources = []string{}
		}
		if n.Links == nil {
			n.Links = []string{}
		}
		if n.Backlinks == nil {
			n.Backlinks = []string{}
		}
		if n.CleanBody == "" {
			n.CleanBody = stripSeeAlsoGo(n.Body)
		}
		if n.Haystack.Title == "" {
			n.Haystack.Title = NormalizeText(n.Title)
		}
		if n.Haystack.Meta == "" {
			parts := make([]string, 0, 2+len(n.Tags)+len(n.Aliases))
			parts = append(parts, n.Slug, n.Folder)
			parts = append(parts, n.Tags...)
			parts = append(parts, n.Aliases...)
			n.Haystack.Meta = NormalizeText(strings.Join(parts, " "))
		}
		if n.Haystack.Body == "" {
			n.Haystack.Body = NormalizeText(stripTypedWikiPrefix(n.Body))
		}
		n.BodyLenU16 = utf16Len(n.Haystack.Body)
		secs := noteSections(n)
		for si := range secs {
			if secs[si].Norm == "" {
				secs[si].Norm = NormalizeText(secs[si].Raw)
			}
		}
		e.notesBySlug[n.Slug] = n
	}

	for i := range pack.Menus {
		m := &pack.Menus[i]
		m.NameNorm = NormalizeText(m.Name)
		if m.Haystack == "" {
			m.Haystack = NormalizeText(m.Code + " " + m.LegacyCode + " " + m.Name + " " + m.MenuPath)
		}
		e.menuByCode[m.Code] = m
		if m.LegacyCode != "" && reDottedExact.MatchString(m.LegacyCode) {
			if _, ok := e.menuByLegacy[m.LegacyCode]; !ok {
				e.menuByLegacy[m.LegacyCode] = m
			}
		}
	}

	for i := range pack.Tables {
		t := &pack.Tables[i]
		t.TitleNorm = NormalizeText(t.Table + " " + t.SchemaTitle)
		e.tableByName[t.Table] = t
	}

	var wg sync.WaitGroup
	auds := []string{"all", "user", "dev"}
	builtIdx := make([]*SearchIndex, len(auds))
	builtSecIdx := make([]*SectionSearchIndex, len(auds))
	for ai, aud := range auds {
		rows := make([]*Note, 0, len(pack.Notes))
		for _, n := range pack.Notes {
			if matchesAudience(n.Audience, aud) {
				rows = append(rows, n)
			}
		}
		e.rowsByAud[aud] = rows
		wg.Add(2)
		go func(i int, a string) {
			defer wg.Done()
			builtIdx[i] = e.buildSearchIndex(a)
		}(ai, aud)
		go func(i int, a string) {
			defer wg.Done()
			builtSecIdx[i] = e.buildSectionIndex(a)
		}(ai, aud)
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		e.errIndex = e.buildErrorIndex()
	}()
	wg.Wait()
	for ai, aud := range auds {
		e.indexes[aud] = builtIdx[ai]
		e.secIndexes[aud] = builtSecIdx[ai]
	}
	// Free pre-tokenized maps & raw grounding map duplicates after indexes are built to keep RSS lean
	for _, n := range pack.Notes {
		n.Tokens = NoteTokens{}
	}
	pack.Vocab = nil
	pack.GroundingIndex.Menus = nil
	pack.GroundingIndex.Tables = nil
	return e
}

func sliceRunes(s string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	count := 0
	for i := range s {
		if count == maxRunes {
			return s[:i]
		}
		count++
	}
	return s
}

func isASCIIWordByte(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '_'
}

// countOccurrences matches lib/vault.ts count(hay, t, max): underscore identifiers require word boundaries.
func countOccurrences(hay, t string, max int) int {
	if t == "" || hay == "" || max <= 0 {
		return 0
	}
	whole := strings.ContainsRune(t, '_')
	n := 0
	pos := 0
	tLen := len(t)
	hLen := len(hay)
	for n < max && pos < hLen {
		idx := strings.Index(hay[pos:], t)
		if idx < 0 {
			break
		}
		abs := pos + idx
		if !whole {
			n++
		} else {
			prevWord := abs > 0 && isASCIIWordByte(hay[abs-1])
			nextWord := abs+tLen < hLen && isASCIIWordByte(hay[abs+tLen])
			if !prevWord && !nextWord {
				n++
			}
		}
		pos = abs + tLen
	}
	return n
}

func (e *Engine) buildSearchIndex(filter string) *SearchIndex {
	notes := make([]*Note, 0, len(e.pack.Notes))
	for _, n := range e.pack.Notes {
		if matchesAudience(n.Audience, filter) {
			notes = append(notes, n)
		}
	}
	N := len(notes)
	slugToIdx := make(map[string]int, N)
	bodies := make([]string, N)
	titles := make([]string, N)
	metas := make([]string, N)
	aliasSets := make([]map[string]bool, N)
	isHub := make([]bool, N)

	totalLen := 0.0
	for i, n := range notes {
		slugToIdx[n.Slug] = i
		bodies[i] = n.Haystack.Body
		titles[i] = n.Haystack.Title
		metas[i] = n.Haystack.Meta
		totalLen += float64(n.BodyLenU16)
		aset := make(map[string]bool, len(n.Aliases))
		for _, a := range n.Aliases {
			aset[NormalizeText(a)] = true
		}
		aliasSets[i] = aset
		if strings.HasSuffix(n.Slug, "-overview") || n.Folder == "root" {
			isHub[i] = true
		}
	}
	avgLen := 1.0
	if N > 0 && totalLen/float64(N) > 1.0 {
		avgLen = totalLen / float64(N)
	}

	type tempBucket struct {
		idx []int32
		raw []float32
	}
	tempPostings := make(map[string]*tempBucket, 4096)

	for i, n := range notes {
		norm := bm25K1 * (1.0 - bm25B + (bm25B*float64(n.BodyLenU16))/avgLen)
		titleSet := make(map[string]bool, len(n.Tokens.Title))
		for _, t := range n.Tokens.Title {
			titleSet[t] = true
		}
		metaSet := make(map[string]bool, len(n.Tokens.Meta))
		for _, t := range n.Tokens.Meta {
			metaSet[t] = true
		}
		seen := make(map[string]bool, len(n.Tokens.Title)+len(n.Tokens.Meta)+len(n.Tokens.Body))
		for t := range titleSet {
			seen[t] = true
		}
		for t := range metaSet {
			seen[t] = true
		}
		for t := range n.Tokens.Body {
			seen[t] = true
		}

		for t := range seen {
			tf := float64(n.Tokens.Body[t])
			bodyBm25 := 0.0
			if tf > 0 {
				bodyBm25 = ((tf * (bm25K1 + 1.0)) / (tf + norm)) * 2.5
			}
			raw := bodyBm25
			if titleSet[t] {
				raw += 10.0
			}
			if metaSet[t] {
				raw += 6.0
			}
			if raw == 0 {
				continue
			}
			b := tempPostings[t]
			if b == nil {
				b = &tempBucket{}
				tempPostings[t] = b
			}
			b.idx = append(b.idx, int32(i))
			b.raw = append(b.raw, float32(raw))
		}
	}

	postings := make(map[string]*Posting, len(tempPostings))
	for t, b := range tempPostings {
		postings[t] = &Posting{
			Idx: b.idx,
			Raw: b.raw,
			IDF: math.Log(1.0 + float64(N)/float64(1+len(b.idx))),
		}
	}

	nbIdx := make([][]int32, N)
	nbWeights := make([][]float32, N)
	for i, n := range notes {
		wMap := make(map[int]float32, len(n.OutEdges)+len(n.InEdges))
		for _, ed := range n.OutEdges {
			if ed.Slug == "index" {
				continue
			}
			j, ok := slugToIdx[ed.Slug]
			if !ok || j == i {
				continue
			}
			w := float32(0.9)
			if strongRel[ed.Rel] {
				w = 1.15
			}
			if w > wMap[j] {
				wMap[j] = w
			}
		}
		for _, ed := range n.InEdges {
			if ed.Slug == "index" {
				continue
			}
			j, ok := slugToIdx[ed.Slug]
			if !ok || j == i {
				continue
			}
			w := float32(0.9)
			if strongRel[ed.Rel] {
				w = 1.15
			}
			if w > wMap[j] {
				wMap[j] = w
			}
		}
		ids := make([]int32, 0, len(wMap))
		ws := make([]float32, 0, len(wMap))
		for j, w := range wMap {
			ids = append(ids, int32(j))
			ws = append(ws, w)
		}
		nbIdx[i] = ids
		nbWeights[i] = ws
	}

	idx := &SearchIndex{
		notes:           notes,
		slugToIdx:       slugToIdx,
		avgLen:          avgLen,
		postings:        postings,
		fallback:        make(map[string]*Posting, 256),
		fallbackOrder:   make([]string, 0, 256),
		bodies:          bodies,
		titles:          titles,
		metas:           metas,
		aliasSets:       aliasSets,
		neighborIdx:     nbIdx,
		neighborWeights: nbWeights,
		isHub:           isHub,
		bufPool: sync.Pool{
			New: func() any {
				return &searchScratch{
					base:    make([]float64, N),
					matched: make([]int32, N),
				}
			},
		},
	}

	// Pre-warm multi-token synonym phrases once so runtime queries never scan full bodies
	for _, grp := range e.tok.synOrder {
		for _, p := range grp {
			if _, ok := idx.postings[p]; !ok {
				idx.getPosting(p)
			}
		}
	}
	return idx
}

func (idx *SearchIndex) getPosting(t string) *Posting {
	if direct, ok := idx.postings[t]; ok {
		return direct
	}
	idx.fallbackMu.RLock()
	if cached, ok := idx.fallback[t]; ok {
		idx.fallbackMu.RUnlock()
		return cached
	}
	idx.fallbackMu.RUnlock()

	N := len(idx.notes)
	hitIdx := make([]int32, 0, 16)
	hitRaw := make([]float32, 0, 16)
	for i := 0; i < N; i++ {
		tf := countOccurrences(idx.bodies[i], t, 16)
		tHit := countOccurrences(idx.titles[i], t, 1)
		mHit := countOccurrences(idx.metas[i], t, 1)
		if tf == 0 && tHit == 0 && mHit == 0 {
			continue
		}
		norm := bm25K1 * (1.0 - bm25B + (bm25B*float64(idx.notes[i].BodyLenU16))/idx.avgLen)
		bodyBm25 := 0.0
		if tf > 0 {
			ftf := float64(tf)
			bodyBm25 = ((ftf * (bm25K1 + 1.0)) / (ftf + norm)) * 2.5
		}
		raw := bodyBm25
		if tHit > 0 {
			raw += 10.0
		}
		if mHit > 0 {
			raw += 6.0
		}
		if raw > 0 {
			hitIdx = append(hitIdx, int32(i))
			hitRaw = append(hitRaw, float32(raw))
		}
	}
	built := &Posting{
		Idx: hitIdx,
		Raw: hitRaw,
		IDF: math.Log(1.0 + float64(N)/float64(1+len(hitIdx))),
	}

	idx.fallbackMu.Lock()
	if len(idx.fallback) >= 256 && len(idx.fallbackOrder) > 0 {
		oldest := idx.fallbackOrder[0]
		idx.fallbackOrder = idx.fallbackOrder[1:]
		delete(idx.fallback, oldest)
	}
	if _, exists := idx.fallback[t]; !exists {
		idx.fallback[t] = built
		idx.fallbackOrder = append(idx.fallbackOrder, t)
	}
	idx.fallbackMu.Unlock()
	return built
}

func (e *Engine) GetNote(rawSlug string) *Note {
	return e.notesBySlug[toSlug(rawSlug)]
}

func (e *Engine) ListNotes(folder, tag, filter string) []*Note {
	if filter == "" {
		filter = "all"
	}
	f := strings.ToLower(strings.TrimSpace(folder))
	t := strings.ToLower(strings.TrimSpace(tag))
	rows := e.rowsByAud[filter]
	if rows == nil {
		rows = e.rowsByAud["all"]
	}
	if f == "" && t == "" {
		return rows
	}
	out := make([]*Note, 0, len(rows))
	for _, n := range rows {
		if f != "" && n.Folder != f {
			continue
		}
		if t != "" {
			hasTag := false
			for _, x := range n.Tags {
				if strings.ToLower(x) == t {
					hasTag = true
					break
				}
			}
			if !hasTag {
				continue
			}
		}
		out = append(out, n)
	}
	return out
}

func snippetForNote(body string, ts []string) string {
	first := ""
	rest := body
	for len(rest) > 0 {
		var line string
		if nl := strings.IndexByte(rest, '\n'); nl >= 0 {
			line = rest[:nl]
			rest = rest[nl+1:]
		} else {
			line = rest
			rest = ""
		}
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if first == "" {
			first = sliceRunes(strings.TrimSpace(reWhitespace.ReplaceAllString(trimmed, " ")), 280)
		}
		if len(ts) > 0 {
			norm := NormalizeText(trimmed)
			for _, t := range ts {
				if strings.Contains(norm, t) {
					return sliceRunes(strings.TrimSpace(reWhitespace.ReplaceAllString(trimmed, " ")), 280)
				}
			}
		}
	}
	return first
}

// Search matches lib/vault.ts search() with BM25 + synonym expansion + menu/ident/alias/phrase boost + 1-hop graph boost + RRF tie-break.
func (e *Engine) Search(q string, limit int, filter string) []SearchHit {
	if limit <= 0 {
		limit = 8
	}
	if filter == "" {
		filter = "all"
	}
	ts := e.tok.Terms(q)
	if len(ts) == 0 {
		return []SearchHit{}
	}
	idx := e.indexes[filter]
	if idx == nil {
		idx = e.indexes["all"]
	}
	N := len(idx.notes)
	if N == 0 {
		return []SearchHit{}
	}

	synTerms := e.tok.ExpandSynonyms(ts)
	phrase := NormalizeText(strings.TrimSpace(q))
	rawChunks := strings.Fields(phrase)
	chunks := make([]string, 0, len(rawChunks))
	identChunks := make([]string, 0, 2)
	for _, c := range rawChunks {
		if utf8.RuneCountInString(c) > 1 {
			chunks = append(chunks, c)
			if strings.ContainsRune(c, '_') {
				identChunks = append(identChunks, c)
			}
		}
	}
	menuCodes := make([]string, 0, 2)
	for _, t := range ts {
		if isMenuCode(t) {
			menuCodes = append(menuCodes, t)
		}
	}

	scratch := idx.bufPool.Get().(*searchScratch)
	defer idx.bufPool.Put(scratch)
	base := scratch.base
	matched := scratch.matched
	clear(base)
	clear(matched)

	idfSum := 0.0
	for _, t := range ts {
		p := idx.getPosting(t)
		idfSum += p.IDF
		pidf := p.IDF
		for k, docID := range p.Idx {
			base[docID] += float64(p.Raw[k]) * pidf
			matched[docID]++
		}
	}
	bonus := idfSum / float64(len(ts))

	maxMatched := int32(0)
	tsLen := int32(len(ts))
	for i := 0; i < N; i++ {
		if matched[i] > maxMatched {
			maxMatched = matched[i]
		}
		if tsLen > 1 && matched[i] == tsLen {
			base[i] *= 1.5
		}
	}

	for _, st := range synTerms {
		sp := idx.getPosting(st)
		weight := sp.IDF * 0.3
		for k, docID := range sp.Idx {
			base[docID] += float64(sp.Raw[k]) * weight
		}
	}

	for _, mc := range menuCodes {
		mp := idx.getPosting(mc)
		for _, docID := range mp.Idx {
			slug := idx.notes[docID].Slug
			if slug == "index" {
				continue
			}
			if strings.HasPrefix(slug, "menu-cat") {
				base[docID] += 18.0 * bonus
			} else {
				base[docID] += 24.0 * bonus
			}
		}
	}

	phraseRunes := utf8.RuneCountInString(phrase)
	checkPhrase := phraseRunes > 3 && phraseRunes <= 48 && len(chunks) <= 4 && len(ts) > 1
	checkAliasChunks := len(chunks) > 1
	for i := 0; i < N; i++ {
		sc := base[i]
		hasBase := sc > 0
		if hasBase && checkPhrase && matched[i] >= tsLen && strings.Contains(idx.bodies[i], phrase) {
			sc += 8.0 * bonus
		}
		if hasBase || len(identChunks) > 0 {
			aset := idx.aliasSets[i]
			exactAlias := 0
			if phraseRunes > 1 && aset[phrase] {
				exactAlias = 1
			}
			if checkAliasChunks {
				for _, ch := range chunks {
					if ch != phrase && aset[ch] {
						exactAlias++
					}
				}
			}
			if exactAlias > 0 {
				sc += 12.0 * bonus * float64(exactAlias)
			}
			for _, c := range identChunks {
				kebab := strings.ReplaceAll(c, "_", "-")
				slug := idx.notes[i].Slug
				if countOccurrences(idx.titles[i], c, 1) > 0 {
					sc += 10.0 * bonus
				}
				if slug == kebab || slug == "tbl-"+kebab {
					sc += 18.0 * bonus
				}
			}
		}
		base[i] = sc
	}

	type rankedItem struct {
		docID int
		score float64
	}
	broadQuery := len(ts) >= 3
	ranked := make([]rankedItem, 0, 32)
	for i := 0; i < N; i++ {
		sc := base[i]
		if sc <= 0 {
			continue
		}
		nbs := idx.neighborIdx[i]
		nbW := idx.neighborWeights[i]
		var t1, t2, t3 float64
		activeCount := 0
		for ni, nbID := range nbs {
			rawNb := base[nbID]
			if rawNb <= 0 {
				continue
			}
			activeCount++
			nbScore := rawNb * float64(nbW[ni])
			if nbScore >= t1 {
				t3 = t2
				t2 = t1
				t1 = nbScore
			} else if nbScore >= t2 {
				t3 = t2
				t2 = nbScore
			} else if nbScore > t3 {
				t3 = nbScore
			}
		}
		graphBoost := (t1 + t2 + t3) * 0.08
		hubBoost := 0.0
		if broadQuery && len(identChunks) == 0 && idx.isHub[i] && matched[i] >= maxMatched && activeCount >= 4 {
			factor := math.Log2(float64(activeCount)) * 0.07
			if factor > 0.22 {
				factor = 0.22
			}
			hubBoost = sc * factor
		}
		ranked = append(ranked, rankedItem{docID: i, score: sc + graphBoost + hubBoost})
	}

	sort.Slice(ranked, func(a, b int) bool {
		if ranked[a].score != ranked[b].score {
			return ranked[a].score > ranked[b].score
		}
		return idx.notes[ranked[a].docID].Slug < idx.notes[ranked[b].docID].Slug
	})

	// Subtle section-level RRF tie-breaker across top candidates (never inflates traps or overrides clear BM25 winners)
	if len(ranked) > 1 && len(ts) >= 2 && ranked[0].score > 0 && ranked[1].score >= ranked[0].score*0.92 {
		topK := len(ranked)
		if topK > 6 {
			topK = 6
		}
		type secCand struct {
			pos     int
			secHits int
		}
		secCands := make([]secCand, topK)
		anySec := false
		for p := 0; p < topK; p++ {
			note := idx.notes[ranked[p].docID]
			secs := noteSections(note)
			bestSec := 0
			for _, sec := range secs {
				sh := 0
				for _, t := range ts {
					if strings.Contains(sec.Norm, t) {
						sh++
					}
				}
				if sh > bestSec {
					bestSec = sh
				}
			}
			if bestSec > 0 {
				anySec = true
			}
			secCands[p] = secCand{pos: p, secHits: bestSec}
		}
		if anySec {
			sort.SliceStable(secCands, func(a, b int) bool {
				return secCands[a].secHits > secCands[b].secHits
			})
			for sr, sc := range secCands {
				if sc.secHits == len(ts) {
					rrf := 1.0 / float64(60+sr+1)
					ranked[sc.pos].score += ranked[sc.pos].score * rrf * 0.25
				}
			}
			sort.Slice(ranked[:topK], func(a, b int) bool {
				if ranked[a].score != ranked[b].score {
					return ranked[a].score > ranked[b].score
				}
				return idx.notes[ranked[a].docID].Slug < idx.notes[ranked[b].docID].Slug
			})
		}
	}

	if limit > len(ranked) {
		limit = len(ranked)
	}
	res := make([]SearchHit, 0, limit)
	for i := 0; i < limit; i++ {
		note := idx.notes[ranked[i].docID]
		hit := SearchHit{
			Slug:     note.Slug,
			Title:    note.Title,
			Folder:   note.Folder,
			Audience: note.Audience,
			Tags:     note.Tags,
			Score:    int(math.Round(ranked[i].score)),
			Snippet:  snippetForNote(note.Body, ts),
		}
		if len(note.Media.Images) > 0 {
			m := len(note.Media.Images)
			if m > 3 {
				m = 3
			}
			hit.Images = note.Media.Images[:m]
		}
		if len(note.Media.Videos) > 0 {
			m := len(note.Media.Videos)
			if m > 3 {
				m = 3
			}
			hit.Videos = note.Media.Videos[:m]
		}
		res = append(res, hit)
	}
	return res
}

// SearchWithMeta matches lib/vault.ts searchWithMeta() confidence and anti-hallucination thresholds 1:1.
func (e *Engine) SearchWithMeta(q string, limit int, filter string) SearchMetaResult {
	ts := e.tok.Terms(q)
	hits := e.Search(q, limit, filter)
	if len(hits) == 0 || len(ts) == 0 {
		return SearchMetaResult{
			Hits:             hits,
			Confidence:       "low",
			TotalTerms:       len(ts),
			BestMatchedTerms: 0,
			TopScore:         0,
		}
	}
	topNote := e.GetNote(hits[0].Slug)
	bestMatched := 0
	if topNote != nil {
		for _, t := range ts {
			if strings.Contains(topNote.Haystack.Title, t) ||
				strings.Contains(topNote.Haystack.Meta, t) ||
				strings.Contains(topNote.Haystack.Body, t) {
				bestMatched++
			}
		}
	}
	denom := len(ts)
	if denom < 1 {
		denom = 1
	}
	coverage := float64(bestMatched) / float64(denom)
	topScore := hits[0].Score
	conf := "low"
	if (coverage >= 0.6 && topScore >= 35) || (len(ts) == 1 && topScore >= 25) || (coverage == 1.0 && topScore >= 20) {
		conf = "high"
	} else if coverage >= 0.5 && topScore >= 18 {
		conf = "medium"
	}
	return SearchMetaResult{
		Hits:             hits,
		Confidence:       conf,
		TotalTerms:       len(ts),
		BestMatchedTerms: bestMatched,
		TopScore:         topScore,
	}
}

// ---------- Graph Traversal & Connected Neighbors ----------
type dirEdge struct {
	slug      string
	rel       string
	direction string
}

func edgeListFor(n *Note, dir string) []dirEdge {
	out := make([]dirEdge, 0, len(n.OutEdges)+len(n.InEdges))
	if dir != "in" {
		for _, ed := range n.OutEdges {
			out = append(out, dirEdge{slug: ed.Slug, rel: ed.Rel, direction: "out"})
		}
	}
	if dir != "out" {
		for _, ed := range n.InEdges {
			out = append(out, dirEdge{slug: ed.Slug, rel: ed.Rel, direction: "in"})
		}
	}
	return out
}

func (e *Engine) bfsPath(startSlug, targetSlug, dir, filter, relation string, avoidIndex bool) []TraverseStep {
	if startSlug == targetSlug {
		return []TraverseStep{}
	}
	visited := map[string]bool{startSlug: true}
	type parentEntry struct {
		prev string
		step TraverseStep
	}
	parent := make(map[string]parentEntry, 32)
	type qItem struct {
		slug string
		hop  int
	}
	queue := []qItem{{slug: startSlug, hop: 0}}

	for qi := 0; qi < len(queue); qi++ {
		cur := queue[qi]
		if cur.hop >= 6 {
			continue
		}
		node := e.notesBySlug[cur.slug]
		if node == nil {
			continue
		}
		for _, ed := range edgeListFor(node, dir) {
			if relation != "" && ed.rel != relation {
				continue
			}
			if visited[ed.slug] {
				continue
			}
			nb := e.notesBySlug[ed.slug]
			if nb == nil || !matchesAudience(nb.Audience, filter) {
				continue
			}
			if avoidIndex && ed.slug == "index" && ed.slug != targetSlug {
				continue
			}
			visited[ed.slug] = true
			step := TraverseStep{
				Slug:      nb.Slug,
				Title:     nb.Title,
				Folder:    nb.Folder,
				Audience:  nb.Audience,
				Hop:       cur.hop + 1,
				Via:       cur.slug,
				Rel:       ed.rel,
				Direction: ed.direction,
			}
			parent[nb.Slug] = parentEntry{prev: cur.slug, step: step}
			if nb.Slug == targetSlug {
				path := make([]TraverseStep, 0, cur.hop+1)
				c := targetSlug
				for c != "" && c != startSlug {
					pe, ok := parent[c]
					if !ok {
						break
					}
					path = append(path, pe.step)
					c = pe.prev
				}
				for l, r := 0, len(path)-1; l < r; l, r = l+1, r-1 {
					path[l], path[r] = path[r], path[l]
				}
				return path
			}
			queue = append(queue, qItem{slug: nb.Slug, hop: cur.hop + 1})
		}
	}
	return nil
}

func (e *Engine) TraverseGraph(opts TraverseOptions) TraverseResult {
	filter := opts.Audience
	if filter == "" {
		filter = "all"
	}
	dir := opts.Direction
	if dir == "" {
		dir = "both"
	}
	mode := "neighborhood"
	if opts.ToSlug != "" {
		mode = "path"
	}
	start := e.GetNote(opts.Slug)
	if start == nil || !matchesAudience(start.Audience, filter) {
		return TraverseResult{Start: nil, Mode: mode}
	}

	if opts.ToSlug != "" {
		target := e.GetNote(opts.ToSlug)
		if target == nil || !matchesAudience(target.Audience, filter) {
			return TraverseResult{Start: start, Target: nil, Mode: "path"}
		}
		avoidIdx := start.Slug != "index" && target.Slug != "index"
		p := e.bfsPath(start.Slug, target.Slug, dir, filter, opts.Relation, avoidIdx)
		if p == nil && avoidIdx {
			p = e.bfsPath(start.Slug, target.Slug, dir, filter, opts.Relation, false)
		}
		return TraverseResult{Start: start, Target: target, Mode: "path", Neighbors: p, Path: p}
	}

	maxDepth := opts.Depth
	if maxDepth < 1 {
		maxDepth = 2
	}
	if maxDepth > 3 {
		maxDepth = 3
	}
	maxLimit := opts.Limit
	if maxLimit < 1 {
		maxLimit = 25
	}
	if maxLimit > 50 {
		maxLimit = 50
	}

	visited := map[string]bool{start.Slug: true}
	found := make([]TraverseStep, 0, 32)
	type qItem struct {
		slug string
		hop  int
	}
	queue := []qItem{{slug: start.Slug, hop: 0}}

	for qi := 0; qi < len(queue); qi++ {
		cur := queue[qi]
		if cur.hop >= maxDepth {
			continue
		}
		if cur.hop >= 1 && cur.slug == "index" && start.Slug != "index" {
			continue
		}
		node := e.notesBySlug[cur.slug]
		if node == nil {
			continue
		}
		for _, ed := range edgeListFor(node, dir) {
			if opts.Relation != "" && ed.rel != opts.Relation {
				continue
			}
			if visited[ed.slug] {
				continue
			}
			nb := e.notesBySlug[ed.slug]
			if nb == nil || !matchesAudience(nb.Audience, filter) {
				continue
			}
			visited[ed.slug] = true
			nextHop := cur.hop + 1
			found = append(found, TraverseStep{
				Slug:      nb.Slug,
				Title:     nb.Title,
				Folder:    nb.Folder,
				Audience:  nb.Audience,
				Hop:       nextHop,
				Via:       cur.slug,
				Rel:       ed.rel,
				Direction: ed.direction,
			})
			queue = append(queue, qItem{slug: nb.Slug, hop: nextHop})
		}
	}

	folderFilter := strings.ToLower(strings.TrimSpace(opts.Folder))
	filtered := found
	if folderFilter != "" {
		filtered = make([]TraverseStep, 0, len(found))
		for _, s := range found {
			if s.Folder == folderFilter {
				filtered = append(filtered, s)
			}
		}
	}
	degreeOf := func(slug string) int {
		if n := e.notesBySlug[slug]; n != nil {
			return len(n.Links) + len(n.Backlinks)
		}
		return 0
	}
	sort.Slice(filtered, func(a, b int) bool {
		if filtered[a].Hop != filtered[b].Hop {
			return filtered[a].Hop < filtered[b].Hop
		}
		da, db := degreeOf(filtered[a].Slug), degreeOf(filtered[b].Slug)
		if da != db {
			return da > db
		}
		return filtered[a].Slug < filtered[b].Slug
	})
	if len(filtered) > maxLimit {
		filtered = filtered[:maxLimit]
	}
	return TraverseResult{Start: start, Mode: "neighborhood", Neighbors: filtered}
}

func (e *Engine) ConnectedNeighbors(seedSlugs []string, filter string, limit int) []TraverseStep {
	if filter == "" {
		filter = "all"
	}
	if limit <= 0 {
		limit = 6
	}
	seeds := make(map[string]bool, len(seedSlugs))
	for _, s := range seedSlugs {
		seeds[s] = true
	}
	type accItem struct {
		step     TraverseStep
		shared   int
		priority int
	}
	acc := make(map[string]*accItem, 24)
	for _, seedSlug := range seedSlugs {
		seed := e.notesBySlug[seedSlug]
		if seed == nil || !matchesAudience(seed.Audience, filter) {
			continue
		}
		perSeed := make(map[string]bool, len(seed.OutEdges)+len(seed.InEdges))
		for _, ed := range edgeListFor(seed, "both") {
			if seeds[ed.slug] || ed.slug == "index" || perSeed[ed.slug] {
				continue
			}
			nb := e.notesBySlug[ed.slug]
			if nb == nil || !matchesAudience(nb.Audience, filter) {
				continue
			}
			perSeed[ed.slug] = true
			pri := relPriority[ed.rel]
			if pri == 0 {
				pri = 1
			}
			prev := acc[ed.slug]
			if prev == nil {
				acc[ed.slug] = &accItem{
					step: TraverseStep{
						Slug:      nb.Slug,
						Title:     nb.Title,
						Folder:    nb.Folder,
						Audience:  nb.Audience,
						Hop:       1,
						Via:       seedSlug,
						Rel:       ed.rel,
						Direction: ed.direction,
					},
					shared:   1,
					priority: pri,
				}
			} else {
				prev.shared++
				if pri > prev.priority {
					prev.priority = pri
					prev.step.Rel = ed.rel
					prev.step.Via = seedSlug
					prev.step.Direction = ed.direction
				}
			}
		}
	}
	items := make([]*accItem, 0, len(acc))
	for _, it := range acc {
		items = append(items, it)
	}
	sort.Slice(items, func(a, b int) bool {
		if items[a].shared != items[b].shared {
			return items[a].shared > items[b].shared
		}
		if items[a].priority != items[b].priority {
			return items[a].priority > items[b].priority
		}
		return items[a].step.Slug < items[b].step.Slug
	})
	if len(items) > limit {
		items = items[:limit]
	}
	out := make([]TraverseStep, len(items))
	for i, it := range items {
		st := it.step
		st.Shared = it.shared
		out[i] = st
	}
	return out
}

// ---------- Block-Aware Section Excerpting ----------
func splitMarkdownSections(body string) []NoteSection {
	parts := strings.Split(body, "\n## ")
	out := make([]NoteSection, len(parts))
	for i, p := range parts {
		raw := p
		if i > 0 {
			raw = "## " + p
		}
		firstLine := raw
		if nl := strings.IndexByte(raw, '\n'); nl >= 0 {
			firstLine = raw[:nl]
		}
		heading := strings.TrimSpace(strings.TrimLeft(firstLine, "#"))
		out[i] = NoteSection{
			Heading: heading,
			Raw:     raw,
			Norm:    NormalizeText(raw),
		}
	}
	return out
}

func noteSections(n *Note) []NoteSection {
	n.secOnce.Do(func() {
		if len(n.Sections) == 0 {
			src := n.CleanBody
			if src == "" {
				src = n.Body
			}
			n.Sections = splitMarkdownSections(src)
		}
	})
	return n.Sections
}

func (e *Engine) ExcerptNote(n *Note, ts []string, budget int, stripFooter bool) string {
	source := n.Body
	var secs []NoteSection
	if stripFooter {
		source = n.CleanBody
		if source == "" {
			source = n.Body
		}
		if utf8.RuneCountInString(source) <= budget {
			return source
		}
		secs = noteSections(n)
	} else if utf8.RuneCountInString(source) <= budget {
		return source
	}
	if len(secs) == 0 {
		secs = splitMarkdownSections(source)
	}
	hits := make([]int, len(secs))
	for si, sec := range secs {
		h := 0
		for _, t := range ts {
			w := 1
			if isMenuCode(t) {
				w = 20
			}
			h += countOccurrences(sec.Norm, t, 16) * w
		}
		hits[si] = h
	}

	keep := map[int]bool{0: true}
	used := utf8.RuneCountInString(secs[0].Raw)
	if len(secs) > 1 {
		order := make([]int, len(secs)-1)
		for i := range order {
			order[i] = i + 1
		}
		sort.SliceStable(order, func(a, b int) bool {
			return hits[order[a]] > hits[order[b]]
		})
		for _, idx := range order {
			secLen := utf8.RuneCountInString(secs[idx].Raw)
			if used+secLen <= budget {
				keep[idx] = true
				used += secLen
			}
		}
	}

	var keptRaw []string
	var omitted []string
	for i, sec := range secs {
		if keep[i] {
			keptRaw = append(keptRaw, sec.Raw)
		} else if sec.Heading != "" {
			omitted = append(omitted, sec.Heading)
		}
	}
	out := strings.Join(keptRaw, "\n")
	cut := out
	if utf8.RuneCountInString(out) > budget {
		cut, _ = TrimBlockAware(out, budget)
	}
	omitPart := ""
	if len(omitted) > 0 {
		shown := omitted
		ellipsis := ""
		if len(shown) > 6 {
			shown = shown[:6]
			ellipsis = " …"
		}
		omitPart = "omitted sections: " + strings.Join(shown, " | ") + ellipsis + ". "
	}
	return cut + "\n\n[excerpt — " + omitPart + "read_note for the full note]"
}

// ---------- Direct Menu (1001–9070) & SQL Table Lookup ----------
func (e *Engine) LookupDirect(query, filter string, limit int) DirectLookupResult {
	if filter == "" {
		filter = "all"
	}
	if limit < 1 {
		limit = 6
	}
	if limit > 15 {
		limit = 15
	}
	raw := strings.TrimSpace(query)
	norm := NormalizeText(raw)
	if norm == "" {
		return DirectLookupResult{Kind: "none"}
	}

	var foundMenus []*MenuLookupEntry
	seenMenu := make(map[string]bool)
	addMenu := func(m *MenuLookupEntry) {
		if m == nil || seenMenu[m.Code] {
			return
		}
		seenMenu[m.Code] = true
		foundMenus = append(foundMenus, m)
	}

	var foundTables []*TableLookupEntry
	seenTable := make(map[string]bool)
	addTable := func(t *TableLookupEntry) {
		if t == nil || seenTable[t.Table] {
			return
		}
		seenTable[t.Table] = true
		foundTables = append(foundTables, t)
	}

	for _, m := range reMenu4.FindAllStringSubmatch(raw, -1) {
		addMenu(e.menuByCode[m[1]])
	}
	for _, m := range reMenuLegacy.FindAllStringSubmatch(raw, -1) {
		addMenu(e.menuByLegacy[m[1]])
	}

	if filter != "user" {
		for _, id := range reBodyIdent.FindAllString(norm, -1) {
			addTable(e.tableByName[id])
		}
		if len(foundTables) == 0 && strings.ContainsRune(norm, '_') {
			for i := range e.pack.Tables {
				t := &e.pack.Tables[i]
				if strings.Contains(t.Table, norm) {
					addTable(t)
					if len(foundTables) >= limit {
						break
					}
				}
			}
		}
	}

	if len(foundMenus) < limit && (filter != "dev" || len(foundTables) == 0) {
		rawTerms := e.tok.Terms(raw)
		qTerms := make([]string, 0, len(rawTerms))
		for _, qt := range rawTerms {
			if !reMenuNoise.MatchString(qt) {
				qTerms = append(qTerms, qt)
			}
		}
		if len(qTerms) > 0 {
			type scoredMenu struct {
				entry *MenuLookupEntry
				score int
			}
			scored := make([]scoredMenu, 0, 16)
			for i := range e.pack.Menus {
				m := &e.pack.Menus[i]
				if seenMenu[m.Code] {
					continue
				}
				hitCount := 0
				score := 0
				if strings.Contains(m.Haystack, norm) {
					score += 30
				}
				if m.NameNorm == norm {
					score += 60
				} else if strings.Contains(m.NameNorm, norm) {
					score += 25
				}
				for _, qt := range qTerms {
					if strings.Contains(m.NameNorm, qt) {
						hitCount++
						score += 10
					} else if strings.Contains(m.Haystack, qt) {
						hitCount++
						score += 4
					}
				}
				if hitCount > 0 && (hitCount == len(qTerms) || score >= 14) {
					if hitCount == len(qTerms) {
						score += 15
					}
					scored = append(scored, scoredMenu{entry: m, score: score})
				}
			}
			sort.Slice(scored, func(a, b int) bool {
				if scored[a].score != scored[b].score {
					return scored[a].score > scored[b].score
				}
				return scored[a].entry.Code < scored[b].entry.Code
			})
			for _, s := range scored {
				addMenu(s.entry)
				if len(foundMenus) >= limit {
					break
				}
			}
		}
	}

	if filter != "user" && len(foundTables) < limit && len(foundMenus) == 0 {
		qTerms := e.tok.Terms(raw)
		if len(qTerms) > 0 {
			for i := range e.pack.Tables {
				t := &e.pack.Tables[i]
				if seenTable[t.Table] {
					continue
				}
				allMatch := true
				for _, qt := range qTerms {
					if !strings.Contains(t.TitleNorm, qt) {
						allMatch = false
						break
					}
				}
				if allMatch {
					addTable(t)
					if len(foundTables) >= limit {
						break
					}
				}
			}
		}
	}

	var menusOut []HydratedMenu
	if !(filter == "dev" && len(foundTables) > 0) {
		capM := len(foundMenus)
		if capM > limit {
			capM = limit
		}
		menusOut = make([]HydratedMenu, 0, capM)
		for _, m := range foundMenus[:capM] {
			docs := make([]DocSummary, 0, 4)
			relSlugs := make([]string, 0, 4)
			for _, s := range m.RelatedSlugs {
				n := e.notesBySlug[s]
				if n == nil || !matchesAudience(n.Audience, filter) {
					continue
				}
				docs = append(docs, DocSummary{Slug: n.Slug, Title: n.Title, Folder: n.Folder, Audience: n.Audience})
				relSlugs = append(relSlugs, n.Slug)
				if len(docs) >= 4 {
					break
				}
			}
			menusOut = append(menusOut, HydratedMenu{
				Code:         m.Code,
				LegacyCode:   m.LegacyCode,
				Name:         m.Name,
				MenuPath:     m.MenuPath,
				Edition:      m.Edition,
				CatalogSlug:  m.CatalogSlug,
				RelatedSlugs: relSlugs,
				Docs:         docs,
			})
		}
	}

	var tablesOut []HydratedTable
	if filter != "user" {
		capT := len(foundTables)
		if capT > limit {
			capT = limit
		}
		tablesOut = make([]HydratedTable, 0, capT)
		for _, t := range foundTables[:capT] {
			docs := make([]DocSummary, 0, 4)
			for _, s := range t.RelatedSlugs {
				n := e.notesBySlug[s]
				if n == nil || !matchesAudience(n.Audience, filter) {
					continue
				}
				docs = append(docs, DocSummary{Slug: n.Slug, Title: n.Title, Folder: n.Folder, Audience: n.Audience})
				if len(docs) >= 4 {
					break
				}
			}
			tablesOut = append(tablesOut, HydratedTable{
				Table:        t.Table,
				SchemaSlug:   t.SchemaSlug,
				SchemaTitle:  t.SchemaTitle,
				RelatedSlugs: t.RelatedSlugs,
				Docs:         docs,
			})
		}
	}

	kind := "none"
	if len(menusOut) > 0 && len(tablesOut) > 0 {
		kind = "mixed"
	} else if len(menusOut) > 0 {
		kind = "menu"
	} else if len(tablesOut) > 0 {
		kind = "table"
	}
	return DirectLookupResult{Kind: kind, Menus: menusOut, Tables: tablesOut}
}

// ---------- O(1) + Inverted Token Error Message Lookup ----------
func (e *Engine) LookupError(query, filter string, limit int) []ErrorLookupEntry {
	return e.LookupErrorV3(query, filter, limit)
}

// ---------- Temporal / Recency Query (whats_new) ----------
type WhatsNewEntry struct {
	Slug       string
	Title      string
	Folder     string
	Audience   string
	UpdatedAt  string
	LastCommit string
	Tldr       string
}

func (e *Engine) WhatsNew(days int, filter string, limit int) []WhatsNewEntry {
	if days < 1 {
		days = 7
	}
	if days > 365 {
		days = 365
	}
	if filter == "" {
		filter = "all"
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	// Anchor lookback window against the latest known note timestamp (or now, whichever is newer)
	// so offline packs/tests remain deterministic even if a repo hasn't been touched today.
	now := time.Now().UTC()
	cutoff := now.Add(-time.Duration(days) * 24 * time.Hour)

	type item struct {
		n  *Note
		ts time.Time
	}
	rows := e.rowsByAud[filter]
	if rows == nil {
		rows = e.rowsByAud["all"]
	}
	matched := make([]item, 0, 32)
	for _, n := range rows {
		if n.UpdatedAt == "" {
			continue
		}
		parsed, err := time.Parse(time.RFC3339, n.UpdatedAt)
		if err != nil {
			continue
		}
		if parsed.Before(cutoff) {
			continue
		}
		matched = append(matched, item{n: n, ts: parsed})
	}
	sort.Slice(matched, func(a, b int) bool {
		if !matched[a].ts.Equal(matched[b].ts) {
			return matched[a].ts.After(matched[b].ts)
		}
		return matched[a].n.Slug < matched[b].n.Slug
	})
	if len(matched) > limit {
		matched = matched[:limit]
	}
	out := make([]WhatsNewEntry, len(matched))
	for i, it := range matched {
		out[i] = WhatsNewEntry{
			Slug:       it.n.Slug,
			Title:      it.n.Title,
			Folder:     it.n.Folder,
			Audience:   it.n.Audience,
			UpdatedAt:  it.n.UpdatedAt,
			LastCommit: it.n.LastCommit,
			Tldr:       it.n.Tldr,
		}
	}
	return out
}

// ---------- Media Aggregation & FindMedia ----------
func (e *Engine) CollectRelatedMedia(seedSlugs []string, filter string, maxImages, maxVideos, maxPages int) NoteMedia {
	if filter == "" {
		filter = "all"
	}
	var out NoteMedia
	seenImg := make(map[string]bool)
	seenVid := make(map[string]bool)
	seenWeb := make(map[string]bool)

	pushFromNote := func(n *Note) {
		for _, img := range n.Media.Images {
			if len(out.Images) >= maxImages || seenImg[img.URL] {
				continue
			}
			seenImg[img.URL] = true
			out.Images = append(out.Images, img)
		}
		for _, vid := range n.Media.Videos {
			if len(out.Videos) >= maxVideos || seenVid[vid.URL] {
				continue
			}
			seenVid[vid.URL] = true
			out.Videos = append(out.Videos, vid)
		}
		for _, wp := range n.Media.WebPages {
			if len(out.WebPages) >= maxPages || seenWeb[wp.URL] {
				continue
			}
			seenWeb[wp.URL] = true
			out.WebPages = append(out.WebPages, wp)
		}
	}

	for _, s := range seedSlugs {
		if n := e.notesBySlug[s]; n != nil && matchesAudience(n.Audience, filter) {
			pushFromNote(n)
		}
	}

	if len(out.Images) == 0 || len(out.Videos) == 0 {
		visited := make(map[string]bool, len(seedSlugs)+16)
		for _, s := range seedSlugs {
			visited[s] = true
		}
		for _, s := range seedSlugs {
			seed := e.notesBySlug[s]
			if seed == nil || !matchesAudience(seed.Audience, filter) {
				continue
			}
			for _, ed := range edgeListFor(seed, "both") {
				if visited[ed.slug] || broadMediaHubs[ed.slug] {
					continue
				}
				visited[ed.slug] = true
				nb := e.notesBySlug[ed.slug]
				if nb == nil || !matchesAudience(nb.Audience, filter) {
					continue
				}
				pushFromNote(nb)
				if len(out.Images) >= maxImages && len(out.Videos) >= maxVideos {
					break
				}
			}
		}
	}
	return out
}

func (e *Engine) FindMedia(query, kind, filter string, limit int) ([]MediaItem, []EventHit) {
	if filter == "" {
		filter = "user"
	}
	if kind == "" {
		kind = "all"
	}
	if limit < 1 {
		limit = 12
	}
	if limit > 40 {
		limit = 40
	}
	q := strings.TrimSpace(query)

	candidateNotes := make([]*Note, 0, 24)
	if q != "" && q != "*" {
		hits := e.Search(q, 10, filter)
		seenSlugs := make(map[string]bool, len(hits)+16)
		for _, h := range hits {
			if n := e.notesBySlug[h.Slug]; n != nil {
				candidateNotes = append(candidateNotes, n)
				seenSlugs[n.Slug] = true
			}
		}
		hopCap := len(hits)
		if hopCap > 4 {
			hopCap = 4
		}
		for _, h := range hits[:hopCap] {
			seed := e.notesBySlug[h.Slug]
			if seed == nil {
				continue
			}
			for _, ed := range edgeListFor(seed, "both") {
				if seenSlugs[ed.slug] || broadMediaHubs[ed.slug] {
					continue
				}
				nb := e.notesBySlug[ed.slug]
				if nb != nil && matchesAudience(nb.Audience, filter) {
					seenSlugs[nb.Slug] = true
					candidateNotes = append(candidateNotes, nb)
				}
			}
		}
	} else {
		for _, hubSlug := range []string{"video-visual-tutorials", "website-manual-and-blog-directory"} {
			if hn := e.notesBySlug[hubSlug]; hn != nil && matchesAudience(hn.Audience, filter) {
				candidateNotes = append(candidateNotes, hn)
			}
		}
		for _, n := range e.pack.Notes {
			if matchesAudience(n.Audience, filter) && !broadMediaHubs[n.Slug] {
				candidateNotes = append(candidateNotes, n)
			}
		}
	}

	items := make([]MediaItem, 0, limit)
	seenURL := make(map[string]bool, limit)
	usedOrder := make([]EventHit, 0, 8)
	usedSeen := make(map[string]bool)
	recordNote := func(n *Note) {
		if !usedSeen[n.Slug] {
			usedSeen[n.Slug] = true
			usedOrder = append(usedOrder, EventHit{Slug: n.Slug, Title: n.Title, Folder: n.Folder})
		}
	}

	for _, n := range candidateNotes {
		if kind == "all" || kind == "youtube" {
			for _, v := range n.Media.Videos {
				if len(items) >= limit {
					break
				}
				if seenURL[v.URL] {
					continue
				}
				seenURL[v.URL] = true
				items = append(items, MediaItem{
					Kind:         "youtube",
					Title:        v.Title,
					URL:          v.URL,
					VideoID:      v.VideoID,
					ListID:       v.ListID,
					ThumbnailURL: v.ThumbnailURL,
					EmbedURL:     v.EmbedURL,
					NoteSlug:     n.Slug,
					NoteTitle:    n.Title,
				})
				recordNote(n)
			}
		}
		if kind == "all" || kind == "image" {
			for _, img := range n.Media.Images {
				if len(items) >= limit {
					break
				}
				if seenURL[img.URL] {
					continue
				}
				seenURL[img.URL] = true
				items = append(items, MediaItem{
					Kind:      "image",
					Title:     img.Alt,
					URL:       img.URL,
					NoteSlug:  n.Slug,
					NoteTitle: n.Title,
				})
				recordNote(n)
			}
		}
		if kind == "all" || kind == "webpage" {
			for _, wp := range n.Media.WebPages {
				if len(items) >= limit {
					break
				}
				if seenURL[wp.URL] {
					continue
				}
				seenURL[wp.URL] = true
				items = append(items, MediaItem{
					Kind:      "webpage",
					Title:     wp.Title,
					URL:       wp.URL,
					NoteSlug:  n.Slug,
					NoteTitle: n.Title,
				})
				recordNote(n)
			}
		}
		if len(items) >= limit {
			break
		}
	}
	return items, usedOrder
}

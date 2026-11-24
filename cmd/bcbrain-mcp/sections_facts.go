package main

import (
	"math"
	"regexp"
	"sort"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"
)

// ============================================================================
// 1. Block-Aware Markdown Trimmer (1:1 parity with lib/vault-retrieval.ts)
// ============================================================================

var (
	reTableSep   = regexp.MustCompile(`^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$`)
	reListStart  = regexp.MustCompile(`^\s*(?:\d+[.)]|[-*+])\s+`)
	reHeading    = regexp.MustCompile(`^#{1,6}\s+`)
	reHR         = regexp.MustCompile(`^\s*(?:---+|\*\*\*+|___+)\s*$`)
	reUserTech   = regexp.MustCompile(`(?i)\b(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|COALESCE|NUMERIC|VARCHAR|BIGINT|trans_flag|last_status|ic_trans|ic_trans_detail|ic_inventory|gl_journal|ar_customer|ap_supplier|cb_chq_list|erp_option|fa_asset|bc_user_list|bc_mcp_access_tokens)\b|\b[a-z]{2,12}_[a-z0-9]+(?:_[a-z0-9]+)+\b|\.(?:go|tsx?|sql):\d+`)
	reFactPrefix = regexp.MustCompile(`^\[(menu|rule|limit|error|formula)\]\s+(.+)$`)
)

type mdBlock struct {
	kind   string // "heading" | "hr" | "paragraph" | "list_item" | "code" | "table"
	text   string
	header string
	rows   []string
}

func isTableRowLine(line string) bool {
	t := strings.TrimSpace(line)
	return strings.HasPrefix(t, "|") && strings.IndexByte(t[1:], '|') >= 0
}

func leadingIndent(line string) int {
	for i := 0; i < len(line); i++ {
		if line[i] != ' ' && line[i] != '\t' {
			return i
		}
	}
	return len(line)
}

func parseMarkdownBlocks(text string) []mdBlock {
	lines := strings.Split(text, "\n")
	blocks := make([]mdBlock, 0, 16)
	i := 0
	for i < len(lines) {
		line := lines[i]
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			i++
			continue
		}
		if strings.HasPrefix(trimmed, "```") {
			start := i
			i++
			for i < len(lines) && !strings.HasPrefix(strings.TrimSpace(lines[i]), "```") {
				i++
			}
			if i < len(lines) {
				i++
			}
			blocks = append(blocks, mdBlock{kind: "code", text: strings.Join(lines[start:i], "\n")})
			continue
		}
		if reHR.MatchString(line) {
			blocks = append(blocks, mdBlock{kind: "hr", text: line})
			i++
			continue
		}
		if reHeading.MatchString(trimmed) {
			blocks = append(blocks, mdBlock{kind: "heading", text: line})
			i++
			continue
		}
		if isTableRowLine(line) && i+1 < len(lines) && reTableSep.MatchString(lines[i+1]) {
			header := line + "\n" + lines[i+1]
			i += 2
			var rows []string
			for i < len(lines) && isTableRowLine(lines[i]) {
				rows = append(rows, lines[i])
				i++
			}
			full := header
			if len(rows) > 0 {
				full = header + "\n" + strings.Join(rows, "\n")
			}
			blocks = append(blocks, mdBlock{kind: "table", header: header, rows: rows, text: full})
			continue
		}
		if reListStart.MatchString(line) {
			baseIndent := leadingIndent(line)
			start := i
			i++
			for i < len(lines) {
				next := lines[i]
				nextTrim := strings.TrimSpace(next)
				if nextTrim == "" {
					break
				}
				if strings.HasPrefix(nextTrim, "```") || reHeading.MatchString(nextTrim) || reHR.MatchString(next) {
					break
				}
				if isTableRowLine(next) && i+1 < len(lines) && reTableSep.MatchString(lines[i+1]) {
					break
				}
				if reListStart.MatchString(next) && leadingIndent(next) <= baseIndent {
					break
				}
				i++
			}
			blocks = append(blocks, mdBlock{kind: "list_item", text: strings.Join(lines[start:i], "\n")})
			continue
		}
		start := i
		i++
		for i < len(lines) {
			next := lines[i]
			nextTrim := strings.TrimSpace(next)
			if nextTrim == "" {
				break
			}
			if strings.HasPrefix(nextTrim, "```") || reHeading.MatchString(nextTrim) || reHR.MatchString(next) || reListStart.MatchString(next) {
				break
			}
			if isTableRowLine(next) && i+1 < len(lines) && reTableSep.MatchString(lines[i+1]) {
				break
			}
			i++
		}
		blocks = append(blocks, mdBlock{kind: "paragraph", text: strings.Join(lines[start:i], "\n")})
	}
	return blocks
}

func trimSentenceBoundary(text string, maxRunes int) string {
	if utf8.RuneCountInString(text) <= maxRunes {
		return text
	}
	cut := sliceRunes(text, maxRunes)
	safeEnd := len(cut)
	minSafe := len(cut) * 40 / 100
	if lastOpenWiki := strings.LastIndex(cut, "[["); lastOpenWiki > strings.LastIndex(cut, "]]") && lastOpenWiki > minSafe {
		safeEnd = lastOpenWiki
	}
	if lastOpenLink := strings.LastIndex(cut, "["); lastOpenLink > strings.LastIndex(cut, ")") && lastOpenLink > minSafe && lastOpenLink < safeEnd {
		safeEnd = lastOpenLink
	}
	cand := cut[:safeEnd]
	minSep := len(cut) * 45 / 100
	for _, sep := range []string{"\n", " — ", ". ", " "} {
		if idx := strings.LastIndex(cand, sep); idx >= minSep {
			return strings.TrimRight(cand[:idx], " \t\r\n")
		}
	}
	return strings.TrimRight(cand, " \t\r\n")
}

func joinBlockSep(prevKind, curKind string) string {
	if prevKind == "" {
		return ""
	}
	if prevKind == "list_item" && curKind == "list_item" {
		return "\n"
	}
	if prevKind == "heading" {
		return "\n"
	}
	return "\n\n"
}

// TrimBlockAware trims Markdown cleanly at block/table-row/list-item/code-fence boundaries.
func TrimBlockAware(text string, maxChars int) (string, bool) {
	src := strings.TrimRight(text, " \t\r\n")
	if maxChars <= 0 {
		return "", len(src) > 0
	}
	if utf8.RuneCountInString(src) <= maxChars {
		return src, false
	}

	blocks := parseMarkdownBlocks(src)
	kept := make([]mdBlock, 0, len(blocks))
	acc := ""
	truncated := false

	fits := func(cand string) bool {
		return utf8.RuneCountInString(cand) <= maxChars
	}
	hasSubstantial := func() bool {
		for _, b := range kept {
			if b.kind != "heading" && b.kind != "hr" {
				return true
			}
		}
		return false
	}

	for _, blk := range blocks {
		prevKind := ""
		if len(kept) > 0 {
			prevKind = kept[len(kept)-1].kind
		}
		sep := joinBlockSep(prevKind, blk.kind)
		nextFull := blk.text
		if acc != "" {
			nextFull = acc + sep + blk.text
		}
		if fits(nextFull) {
			kept = append(kept, blk)
			acc = nextFull
			continue
		}

		truncated = true

		if blk.kind == "table" && len(blk.rows) > 0 {
			tableAcc := blk.header
			addedRows := 0
			for _, row := range blk.rows {
				candTable := tableAcc + "\n" + row
				candFull := candTable
				if acc != "" {
					candFull = acc + sep + candTable
				}
				if fits(candFull) {
					tableAcc = candTable
					addedRows++
				} else {
					break
				}
			}
			if addedRows > 0 {
				if acc != "" {
					acc = acc + sep + tableAcc
				} else {
					acc = tableAcc
				}
				kept = append(kept, mdBlock{kind: "table", header: blk.header, rows: blk.rows[:addedRows], text: tableAcc})
			}
			break
		}

		if blk.kind == "code" {
			if !hasSubstantial() {
				codeLines := strings.Split(blk.text, "\n")
				openLine := "```"
				if len(codeLines) > 0 {
					openLine = codeLines[0]
				}
				closeLine := "```"
				endIdx := len(codeLines)
				if endIdx > 1 && strings.HasPrefix(strings.TrimSpace(codeLines[endIdx-1]), "```") {
					endIdx--
				}
				innerLines := codeLines[1:endIdx]
				built := openLine
				keptLines := 0
				for _, cl := range innerLines {
					test := built + "\n" + cl + "\n" + closeLine
					full := test
					if acc != "" {
						full = acc + sep + test
					}
					if fits(full) {
						built = built + "\n" + cl
						keptLines++
					} else {
						break
					}
				}
				if keptLines > 0 {
					closed := built + "\n" + closeLine
					if acc != "" {
						acc = acc + sep + closed
					} else {
						acc = closed
					}
					kept = append(kept, mdBlock{kind: "code", text: closed})
				} else if len(innerLines) > 0 {
					used := 0
					if acc != "" {
						used = utf8.RuneCountInString(acc) + utf8.RuneCountInString(sep)
					}
					avail := maxChars - used - utf8.RuneCountInString(openLine) - utf8.RuneCountInString(closeLine) - 2
					if avail >= 16 {
						closed := openLine + "\n" + trimSentenceBoundary(innerLines[0], avail) + "\n" + closeLine
						cand := closed
						if acc != "" {
							cand = acc + sep + closed
						}
						if fits(cand) {
							acc = cand
							kept = append(kept, mdBlock{kind: "code", text: closed})
						}
					}
				}
			}
			break
		}

		if blk.kind == "list_item" || blk.kind == "paragraph" {
			if !hasSubstantial() {
				used := 0
				if acc != "" {
					used = utf8.RuneCountInString(acc) + utf8.RuneCountInString(sep)
				}
				avail := maxChars - used
				if avail < 24 {
					avail = 24
				}
				clipped := trimSentenceBoundary(blk.text, avail)
				cand := clipped
				if acc != "" {
					cand = acc + sep + clipped
				}
				if clipped != "" && fits(cand) {
					acc = cand
					kept = append(kept, mdBlock{kind: blk.kind, text: clipped})
				}
			}
			break
		}

		break
	}

	for truncated && len(kept) > 1 && (kept[len(kept)-1].kind == "heading" || kept[len(kept)-1].kind == "hr") {
		kept = kept[:len(kept)-1]
	}
	if truncated {
		var sb strings.Builder
		for k, b := range kept {
			if k > 0 {
				sb.WriteString(joinBlockSep(kept[k-1].kind, b.kind))
			}
			sb.WriteString(b.text)
		}
		acc = sb.String()
	}
	if acc == "" && src != "" {
		acc = trimSentenceBoundary(src, maxChars)
		truncated = true
	}
	return strings.TrimRight(acc, " \t\r\n"), truncated
}

// ============================================================================
// 2. Section-Level Inverted BM25 Index (1:1 parity with lib/vault-retrieval.ts)
// ============================================================================

const (
	secBM25K1 = 1.2
	secBM25B  = 0.75
)

type SectionChunk struct {
	NoteIdx      int
	SectionIndex int
	Slug         string
	Title        string
	Folder       string
	Audience     string
	Heading      string
	Raw          string
	Norm         string
	NormLenU16   int
}

type SectionSearchIndex struct {
	sections []SectionChunk
	avgLen   float64
	postings map[string]*Posting
	bufPool  sync.Pool
}

type sectionScratch struct {
	scores  []float64
	matched []int32
	touched []int32
}

type SectionSearchHit struct {
	Slug         string
	Title        string
	Folder       string
	Audience     string
	SectionIndex int
	Heading      string
	Score        int
	MatchedTerms int
	Raw          string
}

type SectionExcerptItem struct {
	Slug         string   `json:"slug"`
	Title        string   `json:"title"`
	Folder       string   `json:"folder"`
	Audience     string   `json:"audience"`
	Heading      string   `json:"heading"`
	Score        int      `json:"score"`
	MatchedTerms int      `json:"matchedTerms"`
	Excerpt      string   `json:"excerpt"`
	Truncated    bool     `json:"truncated"`
	Facts        []string `json:"facts"`
}

func (e *Engine) buildSectionIndex(filter string) *SectionSearchIndex {
	notes := e.rowsByAud[filter]
	if notes == nil {
		notes = e.rowsByAud["all"]
	}
	chunks := make([]SectionChunk, 0, len(notes)*5)
	for ni, n := range notes {
		secs := noteSections(n)
		for si, s := range secs {
			norm := s.Norm
			if norm == "" {
				norm = NormalizeText(s.Raw)
			}
			if strings.TrimSpace(norm) == "" {
				continue
			}
			heading := s.Heading
			if heading == "" {
				heading = n.Title
			}
			chunks = append(chunks, SectionChunk{
				NoteIdx:      ni,
				SectionIndex: si,
				Slug:         n.Slug,
				Title:        n.Title,
				Folder:       n.Folder,
				Audience:     n.Audience,
				Heading:      heading,
				Raw:          s.Raw,
				Norm:         norm,
				NormLenU16:   utf16Len(norm),
			})
		}
	}

	S := len(chunks)
	totalLen := 0.0
	for i := range chunks {
		totalLen += float64(chunks[i].NormLenU16)
	}
	avgLen := 1.0
	if S > 0 && totalLen/float64(S) > 1.0 {
		avgLen = totalLen / float64(S)
	}

	type tempBucket struct {
		idx []int32
		raw []float32
	}
	temp := make(map[string]*tempBucket, 4096)

	for i := range chunks {
		sec := &chunks[i]
		headSet := make(map[string]bool, 12)
		for _, w := range e.tok.TokenizeNormalized(NormalizeText(sec.Heading)) {
			headSet[w] = true
		}
		bodyTf := make(map[string]int, 32)
		for _, w := range e.tok.TokenizeNormalized(sec.Norm) {
			if bodyTf[w] < 12 {
				bodyTf[w]++
			}
		}
		normFactor := secBM25K1 * (1.0 - secBM25B + (secBM25B*float64(sec.NormLenU16))/avgLen)
		seen := make(map[string]bool, len(headSet)+len(bodyTf))
		for t := range headSet {
			seen[t] = true
		}
		for t := range bodyTf {
			seen[t] = true
		}
		for t := range seen {
			tf := float64(bodyTf[t])
			bodyBm25 := 0.0
			if tf > 0 {
				bodyBm25 = ((tf * (secBM25K1 + 1.0)) / (tf + normFactor)) * 2.5
			}
			raw := bodyBm25
			if headSet[t] {
				raw += 9.0
			}
			if raw == 0 {
				continue
			}
			b := temp[t]
			if b == nil {
				b = &tempBucket{}
				temp[t] = b
			}
			b.idx = append(b.idx, int32(i))
			b.raw = append(b.raw, float32(raw))
		}
	}

	postings := make(map[string]*Posting, len(temp))
	for t, b := range temp {
		postings[t] = &Posting{
			Idx: b.idx,
			Raw: b.raw,
			IDF: math.Log(1.0 + float64(S)/float64(1+len(b.idx))),
		}
	}

	return &SectionSearchIndex{
		sections: chunks,
		avgLen:   avgLen,
		postings: postings,
		bufPool: sync.Pool{
			New: func() any {
				return &sectionScratch{
					scores:  make([]float64, S),
					matched: make([]int32, S),
					touched: make([]int32, S),
				}
			},
		},
	}
}

func (e *Engine) SearchSections(q string, limit int, filter string) []SectionSearchHit {
	if limit <= 0 {
		limit = 5
	}
	if limit > 15 {
		limit = 15
	}
	if filter == "" {
		filter = "all"
	}
	ts := e.tok.Terms(q)
	if len(ts) == 0 {
		return nil
	}
	secIdx := e.secIndexes[filter]
	if secIdx == nil {
		secIdx = e.secIndexes["all"]
	}
	if secIdx == nil || len(secIdx.sections) == 0 {
		return nil
	}

	synTerms := e.tok.ExpandSynonyms(ts)
	phrase := NormalizeText(strings.TrimSpace(q))
	menuCodes := make([]string, 0, 2)
	for _, t := range ts {
		if isMenuCode(t) {
			menuCodes = append(menuCodes, t)
		}
	}

	sc := secIdx.bufPool.Get().(*sectionScratch)
	defer secIdx.bufPool.Put(sc)
	scoreBuf := sc.scores
	matchBuf := sc.matched
	touched := sc.touched
	touchedCount := 0

	idfSum := 0.0
	for _, t := range ts {
		p := secIdx.postings[t]
		if p == nil {
			continue
		}
		idfSum += p.IDF
		pidf := p.IDF
		for k, si := range p.Idx {
			if scoreBuf[si] == 0 && matchBuf[si] == 0 {
				touched[touchedCount] = si
				touchedCount++
			}
			scoreBuf[si] += float64(p.Raw[k]) * pidf
			matchBuf[si]++
		}
	}

	capSyn := len(synTerms)
	if capSyn > 4 {
		capSyn = 4
	}
	for i := 0; i < capSyn; i++ {
		sp := secIdx.postings[synTerms[i]]
		if sp == nil {
			continue
		}
		weight := sp.IDF * 0.25
		for k, si := range sp.Idx {
			if scoreBuf[si] > 0 {
				scoreBuf[si] += float64(sp.Raw[k]) * weight
			} else if touchedCount < 200 {
				touched[touchedCount] = si
				touchedCount++
				scoreBuf[si] = float64(sp.Raw[k]) * weight
			}
		}
	}

	avgIDF := 1.0
	if len(ts) > 0 && idfSum > 0 {
		avgIDF = idfSum / float64(len(ts))
	}
	for _, mc := range menuCodes {
		mp := secIdx.postings[mc]
		if mp == nil {
			continue
		}
		for _, si := range mp.Idx {
			if scoreBuf[si] == 0 && matchBuf[si] == 0 {
				touched[touchedCount] = si
				touchedCount++
			}
			scoreBuf[si] += 16.0 * avgIDF
		}
	}

	type cand struct {
		secIdx  int32
		score   float64
		matched int
	}
	qLen := len(ts)
	cands := make([]cand, 0, touchedCount)
	for k := 0; k < touchedCount; k++ {
		si := touched[k]
		sVal := scoreBuf[si]
		mVal := int(matchBuf[si])
		if qLen > 1 && mVal == qLen {
			sVal *= 1.45
		}
		if secIdx.sections[si].SectionIndex > 0 && mVal >= 2 {
			sVal *= 1.08
		}
		cands = append(cands, cand{secIdx: si, score: sVal, matched: mVal})
		scoreBuf[si] = 0
		matchBuf[si] = 0
	}

	sort.Slice(cands, func(a, b int) bool {
		if cands[a].score != cands[b].score {
			return cands[a].score > cands[b].score
		}
		return cands[a].secIdx < cands[b].secIdx
	})
	topK := 30
	if limit > topK {
		topK = limit
	}
	if len(cands) > topK {
		cands = cands[:topK]
	}

	phraseRunes := utf8.RuneCountInString(phrase)
	if phraseRunes >= 4 && phraseRunes <= 64 && qLen > 1 {
		minMatch := 2
		if qLen < minMatch {
			minMatch = qLen
		}
		for i := range cands {
			if cands[i].matched >= minMatch && strings.Contains(secIdx.sections[cands[i].secIdx].Norm, phrase) {
				cands[i].score += 10.0 * avgIDF
			}
		}
		sort.Slice(cands, func(a, b int) bool {
			if cands[a].score != cands[b].score {
				return cands[a].score > cands[b].score
			}
			return cands[a].secIdx < cands[b].secIdx
		})
	}

	if len(cands) > limit {
		cands = cands[:limit]
	}
	out := make([]SectionSearchHit, len(cands))
	for i, c := range cands {
		sec := secIdx.sections[c.secIdx]
		out[i] = SectionSearchHit{
			Slug:         sec.Slug,
			Title:        sec.Title,
			Folder:       sec.Folder,
			Audience:     sec.Audience,
			SectionIndex: sec.SectionIndex,
			Heading:      sec.Heading,
			Score:        int(math.Round(c.score)),
			MatchedTerms: c.matched,
			Raw:          sec.Raw,
		}
	}
	return out
}

// ============================================================================
// 3. Structured Facts (SafeNoteFacts + CollectFacts)
// ============================================================================

type ParsedFact struct {
	Kind      string
	Text      string
	Formatted string
}

type FactResultItem struct {
	Kind      string `json:"kind"`
	Text      string `json:"text"`
	Formatted string `json:"formatted"`
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	Folder    string `json:"folder"`
}

var validFactKinds = map[string]bool{
	"menu":    true,
	"rule":    true,
	"limit":   true,
	"error":   true,
	"formula": true,
}

var factFolderPriorityUser = map[string]int{
	"start":        0,
	"howto":        1,
	"troubleshoot": 2,
	"sales":        3,
	"faq":          4,
	"reports":      5,
	"systems":      6,
	"glossary":     7,
	"playbook":     8,
	"root":         9,
}

var factFolderPriorityDev = map[string]int{
	"dev-playbook": 0,
	"doctypes":     1,
	"schema":       2,
	"api":          3,
	"queries":      4,
	"architecture": 5,
	"root":         6,
}

func SafeNoteFacts(n *Note, filter string, kinds map[string]bool, maxPerNote int) []ParsedFact {
	if n == nil || !matchesAudience(n.Audience, filter) {
		return nil
	}
	if maxPerNote <= 0 {
		maxPerNote = 8
	}
	out := make([]ParsedFact, 0, maxPerNote)
	for _, formatted := range n.Facts {
		m := reFactPrefix.FindStringSubmatch(formatted)
		if len(m) < 3 {
			continue
		}
		kind := m[1]
		text := m[2]
		if len(kinds) > 0 && !kinds[kind] {
			continue
		}
		if filter == "user" && reUserTech.MatchString(text) {
			continue
		}
		out = append(out, ParsedFact{Kind: kind, Text: text, Formatted: formatted})
		if len(out) >= maxPerNote {
			break
		}
	}
	return out
}

func (e *Engine) CollectFacts(query string, slugs []string, kinds []string, filter string, limit int) ([]FactResultItem, []EventHit) {
	if filter == "" {
		filter = "all"
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	var kindSet map[string]bool
	if len(kinds) > 0 {
		kindSet = make(map[string]bool, len(kinds))
		for _, k := range kinds {
			kl := strings.ToLower(strings.TrimSpace(k))
			if validFactKinds[kl] {
				kindSet[kl] = true
			}
		}
	}

	targetNotes := make([]*Note, 0, 16)
	seenNote := make(map[string]bool)

	for _, rawSlug := range slugs {
		n := e.GetNote(rawSlug)
		if n == nil || !matchesAudience(n.Audience, filter) || seenNote[n.Slug] {
			continue
		}
		seenNote[n.Slug] = true
		targetNotes = append(targetNotes, n)
	}

	qTrim := strings.TrimSpace(query)
	if qTrim != "" {
		for _, h := range e.Search(qTrim, 6, filter) {
			n := e.GetNote(h.Slug)
			if n != nil && matchesAudience(n.Audience, filter) && !seenNote[n.Slug] {
				seenNote[n.Slug] = true
				targetNotes = append(targetNotes, n)
			}
		}
	}

	if len(slugs) == 0 && qTrim == "" {
		priMap := factFolderPriorityUser
		if filter == "dev" {
			priMap = factFolderPriorityDev
		}
		rows := e.rowsByAud[filter]
		if rows == nil {
			rows = e.rowsByAud["all"]
		}
		pool := make([]*Note, 0, len(rows))
		for _, n := range rows {
			if n.Slug != "index" {
				pool = append(pool, n)
			}
		}
		priOf := func(f string) int {
			if p, ok := priMap[f]; ok {
				return p
			}
			return 20
		}
		sort.Slice(pool, func(a, b int) bool {
			pa, pb := priOf(pool[a].Folder), priOf(pool[b].Folder)
			if pa != pb {
				return pa < pb
			}
			return pool[a].Slug < pool[b].Slug
		})
		capPool := len(pool)
		if capPool > 40 {
			capPool = 40
		}
		targetNotes = append(targetNotes, pool[:capPool]...)
	}

	facts := make([]FactResultItem, 0, limit)
	seenText := make(map[string]bool, limit)
	matchedNotes := make([]EventHit, 0, 6)
	seenHit := make(map[string]bool)

	for _, n := range targetNotes {
		for _, f := range SafeNoteFacts(n, filter, kindSet, 8) {
			key := f.Kind + "\x00" + strings.ToLower(f.Text)
			if seenText[key] {
				continue
			}
			seenText[key] = true
			facts = append(facts, FactResultItem{
				Kind:      f.Kind,
				Text:      f.Text,
				Formatted: f.Formatted,
				Slug:      n.Slug,
				Title:     n.Title,
				Folder:    n.Folder,
			})
			if !seenHit[n.Slug] && len(matchedNotes) < 6 {
				seenHit[n.Slug] = true
				matchedNotes = append(matchedNotes, EventHit{Slug: n.Slug, Title: n.Title, Folder: n.Folder})
			}
			if len(facts) >= limit {
				return facts, matchedNotes
			}
		}
	}
	return facts, matchedNotes
}

// ============================================================================
// 4. Upgraded O(1) + Inverted Token Error Index (parity with vault-retrieval.ts)
// ============================================================================

var (
	rePlaceholder   = regexp.MustCompile(`(?i)<[^>]{1,24}>|\[\s*<[^>]{1,24}>\s*\]|\bDD/MM/YYYY\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b|\.{2,}|…|\([^)]{1,40}\)`)
	reUpperCodeTok  = regexp.MustCompile(`\b[A-Z0-9_-]{3,16}\b`)
	reNonWordSpace  = regexp.MustCompile(`[^\x{0E00}-\x{0E7F}a-z0-9]+`)
)

func stripLeadingEmojiSpace(s string) string {
	return strings.TrimLeftFunc(s, func(r rune) bool {
		if unicode.IsSpace(r) || r == 0xFE0F || r == 0x200D {
			return true
		}
		return r >= 0x2600 && !isThaiRune(r) && !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
}

func canonicalErrorKey(s string) string {
	norm := stripLeadingEmojiSpace(NormalizeText(s))
	norm = reNonWordSpace.ReplaceAllString(norm, " ")
	return strings.TrimSpace(norm)
}

func strippedTemplateKey(s string) string {
	norm := stripLeadingEmojiSpace(NormalizeText(s))
	norm = rePlaceholder.ReplaceAllString(norm, " ")
	norm = reUpperCodeTok.ReplaceAllString(norm, " ")
	norm = reNonWordSpace.ReplaceAllString(norm, " ")
	return strings.TrimSpace(norm)
}

type ErrorSearchIndex struct {
	entries       []ErrorLookupEntry
	exactMap      map[string][]int
	tokenPostings map[string][]int32
	normTexts     []string
	strippedTexts []string
}

func (e *Engine) buildErrorIndex() *ErrorSearchIndex {
	n := len(e.pack.Errors)
	exactMap := make(map[string][]int, n*2)
	normTexts := make([]string, n)
	strippedTexts := make([]string, n)
	tempPostings := make(map[string]map[int32]bool, 512)

	registerKey := func(key string, idx int) {
		if utf8.RuneCountInString(key) < 4 {
			return
		}
		for _, ex := range exactMap[key] {
			if ex == idx {
				return
			}
		}
		exactMap[key] = append(exactMap[key], idx)
	}

	for i := 0; i < n; i++ {
		er := &e.pack.Errors[i]
		normKey := canonicalErrorKey(er.ErrorText)
		if normKey == "" {
			normKey = canonicalErrorKey(er.Norm)
		}
		stripped := er.Stripped
		if stripped == "" {
			stripped = strippedTemplateKey(er.ErrorText)
		}
		normTexts[i] = normKey
		strippedTexts[i] = stripped

		registerKey(normKey, i)
		if stripped != "" && stripped != normKey {
			registerKey(stripped, i)
		}
		beforeDelim := er.ErrorText
		if idx := strings.IndexAny(beforeDelim, "(:"); idx >= 0 {
			beforeDelim = beforeDelim[:idx]
		}
		bp := canonicalErrorKey(beforeDelim)
		if utf8.RuneCountInString(bp) >= 6 && bp != normKey {
			registerKey(bp, i)
		}

		tokSet := make(map[string]bool, 16)
		for _, t := range e.tok.TokenizeNormalized(normKey) {
			tokSet[t] = true
		}
		for _, t := range e.tok.TokenizeNormalized(stripped) {
			tokSet[t] = true
		}
		if er.Folder == "troubleshoot" {
			for _, t := range e.tok.TokenizeNormalized(NormalizeText(er.Title)) {
				tokSet[t] = true
			}
		}
		for t := range tokSet {
			m := tempPostings[t]
			if m == nil {
				m = make(map[int32]bool, 4)
				tempPostings[t] = m
			}
			m[int32(i)] = true
		}
	}

	tokenPostings := make(map[string][]int32, len(tempPostings))
	for t, m := range tempPostings {
		arr := make([]int32, 0, len(m))
		for ei := range m {
			arr = append(arr, ei)
		}
		sort.Slice(arr, func(a, b int) bool { return arr[a] < arr[b] })
		tokenPostings[t] = arr
	}

	return &ErrorSearchIndex{
		entries:       e.pack.Errors,
		exactMap:      exactMap,
		tokenPostings: tokenPostings,
		normTexts:     normTexts,
		strippedTexts: strippedTexts,
	}
}

func (e *Engine) LookupErrorV3(query, filter string, limit int) []ErrorLookupEntry {
	if filter == "" {
		filter = "all"
	}
	if limit < 1 {
		limit = 5
	}
	if limit > 20 {
		limit = 20
	}
	raw := strings.TrimSpace(query)
	if raw == "" || e.errIndex == nil {
		return nil
	}
	idx := e.errIndex
	qNorm := canonicalErrorKey(raw)
	qStripped := strippedTemplateKey(raw)

	scoreMap := make(map[int]float64, 16)
	exactHits := make(map[int]bool, 8)
	bump := func(ei int, delta float64) {
		if !matchesAudience(idx.entries[ei].Audience, filter) {
			return
		}
		scoreMap[ei] += delta
	}

	for _, ei := range idx.exactMap[qNorm] {
		if matchesAudience(idx.entries[ei].Audience, filter) {
			exactHits[ei] = true
			bump(ei, 120)
		}
	}
	if qStripped != "" && qStripped != qNorm {
		for _, ei := range idx.exactMap[qStripped] {
			if matchesAudience(idx.entries[ei].Audience, filter) {
				exactHits[ei] = true
				bump(ei, 100)
			}
		}
	}

	strippedToks := e.tok.TokenizeNormalized(qStripped)
	rawToks := strippedToks
	if len(rawToks) == 0 {
		rawToks = e.tok.TokenizeNormalized(qNorm)
	}
	seenQ := make(map[string]bool, len(rawToks))
	qTerms := make([]string, 0, len(rawToks))
	for _, t := range rawToks {
		if !seenQ[t] {
			seenQ[t] = true
			qTerms = append(qTerms, t)
		}
	}

	qualified := make(map[int]bool, len(exactHits)+16)
	for ei := range exactHits {
		qualified[ei] = true
	}

	if len(qTerms) > 0 {
		matchCounts := make(map[int]int, 32)
		rawTokenScores := make(map[int]float64, 32)
		totalEntries := float64(len(idx.entries))
		for _, t := range qTerms {
			posting := idx.tokenPostings[t]
			if len(posting) == 0 {
				continue
			}
			idf := math.Log(1.0 + totalEntries/float64(1+len(posting)))
			for _, ei32 := range posting {
				ei := int(ei32)
				if !matchesAudience(idx.entries[ei].Audience, filter) {
					continue
				}
				matchCounts[ei]++
				add := 10.0 * idf
				rawTokenScores[ei] += add
				bump(ei, add)
			}
		}

		qNormLen := utf8.RuneCountInString(qNorm)
		qStripLen := utf8.RuneCountInString(qStripped)
		for ei, mCount := range matchCounts {
			nt := idx.normTexts[ei]
			st := idx.strippedTexts[ei]
			ntLen := utf8.RuneCountInString(nt)
			stLen := utf8.RuneCountInString(st)

			hasNormSubstr := qNormLen >= 6 && ntLen >= 6 &&
				((strings.Contains(nt, qNorm) && qNormLen >= 8) || (strings.Contains(qNorm, nt) && ntLen >= 8))
			hasStrippedSubstr := qStripLen >= 6 && stLen >= 6 &&
				((strings.Contains(st, qStripped) && qStripLen >= 8) || (strings.Contains(qStripped, st) && stLen >= 8))

			cov := float64(mCount) / float64(len(qTerms))
			tokScore := rawTokenScores[ei]
			passes := exactHits[ei] || hasNormSubstr || hasStrippedSubstr
			if !passes {
				if len(qTerms) >= 2 {
					passes = mCount >= 2 && cov >= 0.45 && tokScore >= 18
				} else {
					passes = tokScore >= 18
				}
			}
			if !passes {
				continue
			}
			qualified[ei] = true
			if hasNormSubstr {
				bump(ei, 45)
			} else if hasStrippedSubstr {
				bump(ei, 35)
			}
			if mCount == len(qTerms) {
				bump(ei, 25)
			} else if cov >= 0.6 {
				bump(ei, 10)
			}
			switch idx.entries[ei].Folder {
			case "troubleshoot":
				bump(ei, 12)
			case "howto":
				bump(ei, 5)
			}
		}
	}

	type rankedErr struct {
		ei    int
		score float64
	}
	ranked := make([]rankedErr, 0, len(qualified))
	for ei := range qualified {
		if sc := scoreMap[ei]; sc >= 18 {
			ranked = append(ranked, rankedErr{ei: ei, score: sc})
		}
	}
	sort.Slice(ranked, func(a, b int) bool {
		if ranked[a].score != ranked[b].score {
			return ranked[a].score > ranked[b].score
		}
		return ranked[a].ei < ranked[b].ei
	})

	out := make([]ErrorLookupEntry, 0, limit)
	seenText := make(map[string]bool)
	slugCounts := make(map[string]int)
	for _, r := range ranked {
		entry := idx.entries[r.ei]
		key := entry.Slug + "\x00" + idx.normTexts[r.ei]
		if seenText[key] {
			continue
		}
		if slugCounts[entry.Slug] >= 2 && len(ranked) > limit {
			continue
		}
		seenText[key] = true
		slugCounts[entry.Slug]++
		out = append(out, entry)
		if len(out) >= limit {
			break
		}
	}
	return out
}

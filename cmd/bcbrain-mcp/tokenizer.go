package main

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	rePnd      = regexp.MustCompile(`ภ\.ง\.ด\.\s*(\d+)`)
	rePp       = regexp.MustCompile(`ภ\.พ\.\s*(\d+)`)
	reETax     = regexp.MustCompile(`\be-tax\b`)
	reEWht     = regexp.MustCompile(`\be-wht\b`)
	reEFiling  = regexp.MustCompile(`\be-filing\b`)
	reEPod     = regexp.MustCompile(`\be-pod\b`)
	re3Way     = regexp.MustCompile(`\b3-way\b`)
	reShortcut = regexp.MustCompile(`\b(ctrl|alt|shift)\s*\+\s*([a-z0-9]+)\b`)
	reDotted   = regexp.MustCompile(`^\d+(?:\.\d+)+$`)
)

var textReplacer = strings.NewReplacer(
	"สต๊อก", "สต็อก",
	"ล๊อก", "ล็อก",
	"แพ็คเกจ", "แพ็กเกจ",
	"พ.ศ.", "พศ",
	"ค.ศ.", "คศ",
	"เครม", "เคลม",
)

// NormalizeText matches lib/vault.ts normalizeText() 1:1 with fast substring guards (avoids RE2 scans on 99% of inputs).
func NormalizeText(s string) string {
	s = strings.ToLower(s)
	if strings.Contains(s, "ภ.") {
		s = rePnd.ReplaceAllString(s, "ภงด$1")
		s = rePp.ReplaceAllString(s, "ภพ$1")
	}
	s = textReplacer.Replace(s)
	if strings.Contains(s, "-") {
		if strings.Contains(s, "e-tax") {
			s = reETax.ReplaceAllString(s, "etax")
		}
		if strings.Contains(s, "e-wht") {
			s = reEWht.ReplaceAllString(s, "ewht")
		}
		if strings.Contains(s, "e-filing") {
			s = reEFiling.ReplaceAllString(s, "efiling")
		}
		if strings.Contains(s, "e-pod") {
			s = reEPod.ReplaceAllString(s, "epod")
		}
		if strings.Contains(s, "3-way") {
			s = re3Way.ReplaceAllString(s, "3way")
		}
	}
	if strings.Contains(s, "+") && (strings.Contains(s, "ctrl") || strings.Contains(s, "alt") || strings.Contains(s, "shift")) {
		s = reShortcut.ReplaceAllString(s, "${1}_${2}")
	}
	return s
}

func isThaiRune(r rune) bool {
	return r >= 0x0E00 && r <= 0x0E7F
}

func isThaiConsonant(r rune) bool {
	return r >= 0x0E01 && r <= 0x0E2E
}

func isThaiLeadingVowel(r rune) bool {
	return r == 'เ' || r == 'แ' || r == 'โ' || r == 'ใ' || r == 'ไ'
}

func isThaiCombiningOrTone(r rune) bool {
	switch r {
	case '่', '้', '๊', '๋', 'ั', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', '็', '์', 'ํ', '๎':
		return true
	}
	return false
}

func isAllThai(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !isThaiRune(r) {
			return false
		}
	}
	return true
}

func needsGluePrev(prev string) bool {
	r, _ := utf8.DecodeLastRuneInString(prev)
	return r == 'เ' || r == 'แ' || r == 'โ' || r == 'ใ' || r == 'ไ' || r == '็' || r == 'ั'
}

func needsGlueCur(cur string) bool {
	if cur == "" {
		return false
	}
	runes := []rune(cur)
	r0 := runes[0]
	if r0 == '่' || r0 == '้' || r0 == '๊' || r0 == '๋' || r0 == 'ั' || r0 == 'ิ' || r0 == 'ี' || r0 == 'ึ' || r0 == 'ื' || r0 == 'ุ' || r0 == 'ู' || r0 == '็' || r0 == '์' {
		return true
	}
	if len(runes) == 1 && isThaiConsonant(r0) {
		return true
	}
	if len(runes) == 2 && isThaiConsonant(r0) && runes[1] == '์' {
		return true
	}
	if len(runes) == 3 && isThaiConsonant(r0) && isThaiConsonant(runes[1]) && runes[2] == '์' {
		return true
	}
	return false
}

// trieNode stores Thai dictionary entries for zero-allocation longest-match segmentation.
type trieNode struct {
	children map[rune]*trieNode
	freq     int
}

type Tokenizer struct {
	root        *trieNode
	stop        map[string]bool
	synonyms    map[string][]string
	synOrder    [][]string
	maxWordRune int
}

func NewTokenizer(vocab map[string]int, stopWords []string, synGroups [][]string) *Tokenizer {
	tok := &Tokenizer{
		root:     &trieNode{},
		stop:     make(map[string]bool, len(stopWords)),
		synonyms: make(map[string][]string),
		synOrder: make([][]string, 0, len(synGroups)),
	}
	for _, sw := range stopWords {
		tok.stop[sw] = true
	}
	for w, freq := range vocab {
		if freq <= 0 {
			freq = 1
		}
		runes := []rune(w)
		if len(runes) == 0 {
			continue
		}
		if len(runes) > tok.maxWordRune {
			tok.maxWordRune = len(runes)
		}
		cur := tok.root
		for _, r := range runes {
			if cur.children == nil {
				cur.children = make(map[rune]*trieNode, 4)
			}
			nxt := cur.children[r]
			if nxt == nil {
				nxt = &trieNode{}
				cur.children[r] = nxt
			}
			cur = nxt
		}
		cur.freq = freq
	}
	for _, grp := range synGroups {
		normGrp := make([]string, 0, len(grp))
		for _, w := range grp {
			nw := NormalizeText(w)
			if nw != "" {
				normGrp = append(normGrp, nw)
			}
		}
		tok.synOrder = append(tok.synOrder, normGrp)
		for _, w := range normGrp {
			seen := make(map[string]bool, len(tok.synonyms[w])+len(normGrp))
			for _, ex := range tok.synonyms[w] {
				seen[ex] = true
			}
			for _, other := range normGrp {
				if other != w && !seen[other] {
					seen[other] = true
					tok.synonyms[w] = append(tok.synonyms[w], other)
				}
			}
		}
	}
	return tok
}

// isMenuCode is a fast zero-regex check matching ^[1-9]\d{3}$|^[1-9](?:\.\d+){1,3}$.
func isMenuCode(s string) bool {
	n := len(s)
	if n == 4 {
		return s[0] >= '1' && s[0] <= '9' &&
			s[1] >= '0' && s[1] <= '9' &&
			s[2] >= '0' && s[2] <= '9' &&
			s[3] >= '0' && s[3] <= '9'
	}
	if n < 3 || s[0] < '1' || s[0] > '9' {
		return false
	}
	dots := 0
	prevDot := false
	for i := 1; i < n; i++ {
		c := s[i]
		if c == '.' {
			if prevDot || i == n-1 {
				return false
			}
			dots++
			if dots > 3 {
				return false
			}
			prevDot = true
		} else if c >= '0' && c <= '9' {
			prevDot = false
		} else {
			return false
		}
	}
	return dots >= 1
}

// canMatchAt returns true if any valid dictionary word starts at runes[pos].
func (t *Tokenizer) canMatchAt(runes []rune, pos int) bool {
	n := len(runes)
	if pos >= n {
		return true
	}
	node := t.root
	for j := pos; j < n; j++ {
		if node.children == nil {
			break
		}
		nxt := node.children[runes[j]]
		if nxt == nil {
			break
		}
		node = nxt
		length := j - pos + 1
		if node.freq > 0 {
			if length == 1 && !t.stop[string(runes[pos:j+1])] && node.freq < 80 {
				continue
			}
			if j+1 < n && isThaiCombiningOrTone(runes[j+1]) {
				continue
			}
			return true
		}
	}
	return false
}

// segmentThaiRun segments a Thai (or Thai+digit) rune slice using greedy Longest-Match with
// 1-step valid-continuation lookahead (matching ICU / Node Intl.Segmenter("th") dictionary segmentation).
// Contiguous unknown (OOV) runes are kept intact (and split on leading vowels if long) so out-of-domain
// queries preserve unmatched terms and trigger anti-hallucination abstention identically to Node.
func (t *Tokenizer) segmentThaiRun(runes []rune) []string {
	n := len(runes)
	if n == 0 {
		return nil
	}
	type segItem struct {
		start int
		end   int
		oov   bool
	}
	items := make([]segItem, 0, n/2+1)
	i := 0
	for i < n {
		prevOOV := len(items) > 0 && items[len(items)-1].oov
		blockMatch := false
		if prevOOV {
			prev := items[len(items)-1]
			// Never start a dictionary word directly after an OOV Thai leading vowel (เ แ โ ใ ไ)
			// or after a lone initial OOV consonant (e.g. ป+ลูก in ปลูก -> keep ป+ลูก together as OOV)
			if isThaiLeadingVowel(runes[prev.end-1]) {
				blockMatch = true
			} else if prev.end-prev.start == 1 && isThaiConsonant(runes[prev.start]) && (len(items) == 1 || !items[len(items)-2].oov) {
				blockMatch = true
			}
		}

		node := t.root
		var cands []int
		if !blockMatch {
			for j := i; j < n; j++ {
				if node.children == nil {
					break
				}
				nxt := node.children[runes[j]]
				if nxt == nil {
					break
				}
				node = nxt
				length := j - i + 1
				if node.freq > 0 {
					if length == 1 && !t.stop[string(runes[i:j+1])] && node.freq < 80 {
						continue
					}
					if j+1 < n && isThaiCombiningOrTone(runes[j+1]) {
						continue
					}
					// While inside an OOV span, require a strong domain word (freq >= 30) so unknown
					// Thai words (e.g. ทุเรียน, ภูเขาไฟ) are not shredded into rare tails (เรียน, ไฟ)
					if prevOOV && node.freq < 30 {
						continue
					}
					cands = append(cands, j+1)
				}
			}
		}

		if len(cands) > 0 {
			// Prefer longest match whose remainder starts a valid dictionary word (ICU BreakIterator heuristic)
			chosen := cands[len(cands)-1]
			for ci := len(cands) - 1; ci >= 0; ci-- {
				endPos := cands[ci]
				if endPos == n || t.canMatchAt(runes, endPos) {
					chosen = endPos
					break
				}
			}
			items = append(items, segItem{start: i, end: chosen, oov: false})
			i = chosen
			continue
		}

		// No dictionary match: consume 1 base rune + trailing combining marks as OOV
		end := i + 1
		for end < n && isThaiCombiningOrTone(runes[end]) {
			end++
		}
		items = append(items, segItem{start: i, end: end, oov: true})
		i = end
	}

	// Merge contiguous OOV spans and split long OOV spans cleanly at leading vowels (เ แ โ ใ ไ)
	out := make([]string, 0, len(items))
	for idx := 0; idx < len(items); idx++ {
		it := items[idx]
		if !it.oov {
			out = append(out, string(runes[it.start:it.end]))
			continue
		}
		oovStart := it.start
		oovEnd := it.end
		for idx+1 < len(items) && items[idx+1].oov {
			idx++
			oovEnd = items[idx].end
		}
		chunkStart := oovStart
		for k := oovStart + 2; k < oovEnd; k++ {
			if isThaiLeadingVowel(runes[k]) && k-chunkStart >= 3 && oovEnd-k >= 3 {
				out = append(out, string(runes[chunkStart:k]))
				chunkStart = k
			}
		}
		if chunkStart < oovEnd {
			out = append(out, string(runes[chunkStart:oovEnd]))
		}
	}
	return out
}

func isASCIIWordRune(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_'
}

// TokenizeNormalized produces tokens matching lib/vault.ts tokenizeNormalized().
func (t *Tokenizer) TokenizeNormalized(normText string) []string {
	if normText == "" {
		return nil
	}
	words := make([]string, 0, 16)
	prevThai := false

	pushChunk := func(raw string) {
		thai := isAllThai(raw)
		if thai && prevThai && len(words) > 0 {
			prev := words[len(words)-1]
			if !t.stop[prev] && !t.stop[raw] && t.stop[prev+raw] {
				words[len(words)-1] = prev + raw
				prevThai = false
				return
			}
			if !t.stop[prev] && !t.stop[raw] && (needsGluePrev(prev) || needsGlueCur(raw)) {
				words[len(words)-1] = prev + raw
				prevThai = true
				return
			}
		}
		words = append(words, raw)
		if strings.Contains(raw, ".") && !reDotted.MatchString(raw) {
			for _, dotPart := range strings.Split(raw, ".") {
				if dotPart == "" {
					continue
				}
				words = append(words, dotPart)
				if strings.Contains(dotPart, "_") {
					for _, u := range strings.Split(dotPart, "_") {
						if u != "" {
							words = append(words, u)
						}
					}
				}
			}
		} else if strings.Contains(raw, "_") {
			for _, u := range strings.Split(raw, "_") {
				if u != "" {
					words = append(words, u)
				}
			}
		}
		prevThai = thai && !t.stop[raw]
	}

	runes := []rune(normText)
	n := len(runes)
	i := 0
	for i < n {
		r := runes[i]
		// Skip non-word punctuation / whitespace
		if !isThaiRune(r) && !isASCIIWordRune(r) && !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			prevThai = false
			i++
			continue
		}

		// Thai run (including immediately attached digits like ภงด53, ภพ30, สบช3)
		if isThaiRune(r) {
			j := i
			for j < n && isThaiRune(runes[j]) {
				j++
			}
			// Check if digits directly follow a Thai run (e.g. ภงด53, ภพ30)
			if j < n && runes[j] >= '0' && runes[j] <= '9' {
				k := j
				for k < n && runes[k] >= '0' && runes[k] <= '9' {
					k++
				}
				// Don't swallow digits if they're part of an ASCII identifier like ap_1 or 7.15.4
				if k == n || (runes[k] != '.' && !(runes[k] >= 'a' && runes[k] <= 'z') && runes[k] != '_') {
					j = k
				}
			}
			segs := t.segmentThaiRun(runes[i:j])
			for _, s := range segs {
				pushChunk(s)
			}
			i = j
			continue
		}

		// ASCII word/identifier/number/dotted code run (e.g., ic_trans_detail.wh_code, 7.15.4, ctrl_s, pos)
		if isASCIIWordRune(r) {
			j := i
			for j < n {
				c := runes[j]
				if isASCIIWordRune(c) {
					j++
					continue
				}
				// Keep internal dots when surrounded by word chars (7.15.4, ic_trans_detail.wh_code)
				if c == '.' && j+1 < n && isASCIIWordRune(runes[j+1]) {
					j++
					continue
				}
				break
			}
			pushChunk(string(runes[i:j]))
			prevThai = false
			i = j
			continue
		}

		// Other unicode letters/digits
		j := i + 1
		for j < n && (unicode.IsLetter(runes[j]) || unicode.IsDigit(runes[j])) && !isThaiRune(runes[j]) {
			j++
		}
		pushChunk(string(runes[i:j]))
		prevThai = false
		i = j
	}

	out := make([]string, 0, len(words))
	for _, w := range words {
		if utf8.RuneCountInString(w) > 1 && !t.stop[w] {
			out = append(out, w)
		}
	}
	return out
}

// Terms returns deduplicated normalized query terms (matching lib/vault.ts terms()).
func (t *Tokenizer) Terms(q string) []string {
	raw := t.TokenizeNormalized(NormalizeText(q))
	if len(raw) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(raw))
	out := make([]string, 0, len(raw))
	for _, w := range raw {
		if !seen[w] {
			seen[w] = true
			out = append(out, w)
		}
	}
	return out
}

// ExpandSynonyms matches lib/vault.ts expandSynonyms() (capped at 8).
func (t *Tokenizer) ExpandSynonyms(primaryTerms []string) []string {
	seen := make(map[string]bool, len(primaryTerms)+8)
	for _, pt := range primaryTerms {
		seen[pt] = true
	}
	out := make([]string, 0, 8)
	for _, pt := range primaryTerms {
		for _, syn := range t.synonyms[pt] {
			if seen[syn] || t.stop[syn] {
				continue
			}
			seen[syn] = true
			out = append(out, syn)
			if len(out) >= 8 {
				return out
			}
		}
	}
	return out
}

// utf16Len returns JS String.length equivalent (UTF-16 code units) for exact BM25 parity.
func utf16Len(s string) int {
	n := 0
	for _, r := range s {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

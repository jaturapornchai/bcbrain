package main

import (
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Defense-in-depth: never validate or hint about internal auth/token/system tables.
var reForbiddenTable = regexp.MustCompile(`(?i)^(?:bc_user_list|bc_mcp_access_tokens|bc_mcp_token_databases|bc_mcp_token_audit|bc_google_account|pg_shadow|pg_authid|pg_stats)`)
var reValidMenu4 = regexp.MustCompile(`^[1-9]\d{3}$`)
var reValidIdent = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
var reValidColIdent = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)
var reMenuPrefix = regexp.MustCompile(`(?i)^เมนู\s*`)

type VerifyReferenceInput struct {
	Menus    []string `json:"menus"`
	Tables   []string `json:"tables"`
	Columns  []string `json:"columns"`
	Audience string   `json:"audience"`
}

type VerifiedMenuHit struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Module string `json:"module,omitempty"`
}

type InvalidMenuHit struct {
	Code        string            `json:"code"`
	Suggestions []VerifiedMenuHit `json:"suggestions"`
}

type VerifiedTableHit struct {
	Table       string `json:"table"`
	ColumnCount int    `json:"columnCount"`
}

type InvalidTableHit struct {
	Table       string   `json:"table"`
	Suggestions []string `json:"suggestions"`
}

type VerifiedColumnHit struct {
	Ref    string `json:"ref"`
	Table  string `json:"table"`
	Column string `json:"column"`
}

type InvalidColumnHit struct {
	Ref         string   `json:"ref"`
	Table       string   `json:"table"`
	Column      string   `json:"column"`
	Reason      string   `json:"reason"`
	Suggestions []string `json:"suggestions"`
}

type VerifyMenusSection struct {
	Valid        []VerifiedMenuHit `json:"valid"`
	Invalid      []InvalidMenuHit  `json:"invalid"`
	UnknownMenus []string          `json:"unknownMenus"`
}

type VerifyTablesSection struct {
	Valid   []VerifiedTableHit `json:"valid"`
	Invalid []InvalidTableHit  `json:"invalid"`
}

type VerifyColumnsSection struct {
	Valid   []VerifiedColumnHit `json:"valid"`
	Invalid []InvalidColumnHit  `json:"invalid"`
}

type VerifySummary struct {
	CheckedMenus   int `json:"checkedMenus"`
	ValidMenus     int `json:"validMenus"`
	InvalidMenus   int `json:"invalidMenus"`
	CheckedTables  int `json:"checkedTables"`
	ValidTables    int `json:"validTables"`
	InvalidTables  int `json:"invalidTables"`
	CheckedColumns int `json:"checkedColumns"`
	ValidColumns   int `json:"validColumns"`
	InvalidColumns int `json:"invalidColumns"`
}

type VerifyReferenceResult struct {
	OK                bool                 `json:"ok"`
	IndexAvailable    bool                 `json:"indexAvailable"`
	Audience          string               `json:"audience"`
	TablesRestricted  bool                 `json:"tablesRestricted"`
	RestrictionNotice string               `json:"restrictionNotice,omitempty"`
	Menus             VerifyMenusSection   `json:"menus"`
	Tables            VerifyTablesSection  `json:"tables"`
	Columns           VerifyColumnsSection `json:"columns"`
	Summary           VerifySummary        `json:"summary"`
}

type GroundingStats struct {
	Available   bool   `json:"available"`
	BuiltAt     string `json:"builtAt"`
	MenuCount   int    `json:"menuCount"`
	TableCount  int    `json:"tableCount"`
	ColumnCount int    `json:"columnCount"`
	ErrorCount  int    `json:"errorCount"`
}

type GroundingRuntime struct {
	available       bool
	builtAt         string
	errorCount      int
	menuCount       int
	tableCount      int
	columnCount     int
	menuMap         map[string]GroundingMenuEntry
	menuList        []GroundingMenuEntry
	tableMap        map[string]map[string]bool
	tableColsSorted map[string][]string
	tableNames      []string
}

func NewGroundingRuntime(raw GroundingIndexFile) *GroundingRuntime {
	menuMap := make(map[string]GroundingMenuEntry, len(raw.Menus))
	menuList := make([]GroundingMenuEntry, 0, len(raw.Menus))
	for code, entry := range raw.Menus {
		cleanCode := strings.TrimSpace(code)
		if !reValidMenu4.MatchString(cleanCode) {
			continue
		}
		label := strings.TrimSpace(entry.Label)
		if label == "" {
			continue
		}
		item := GroundingMenuEntry{
			Code:   cleanCode,
			Label:  label,
			Module: strings.TrimSpace(entry.Module),
		}
		menuMap[cleanCode] = item
		menuList = append(menuList, item)
	}
	sort.Slice(menuList, func(a, b int) bool {
		return menuList[a].Code < menuList[b].Code
	})

	tableMap := make(map[string]map[string]bool, len(raw.Tables))
	tableColsSorted := make(map[string][]string, len(raw.Tables))
	tableNames := make([]string, 0, len(raw.Tables))
	colCount := 0
	for rawTbl, rawCols := range raw.Tables {
		tbl := strings.ToLower(strings.TrimSpace(rawTbl))
		if !reValidIdent.MatchString(tbl) || reForbiddenTable.MatchString(tbl) {
			continue
		}
		colSet := make(map[string]bool, len(rawCols))
		for _, c := range rawCols {
			cleanCol := strings.ToLower(strings.TrimSpace(c))
			if reValidColIdent.MatchString(cleanCol) {
				colSet[cleanCol] = true
			}
		}
		sortedCols := make([]string, 0, len(colSet))
		for c := range colSet {
			sortedCols = append(sortedCols, c)
		}
		sort.Strings(sortedCols)
		tableMap[tbl] = colSet
		tableColsSorted[tbl] = sortedCols
		tableNames = append(tableNames, tbl)
		colCount += len(sortedCols)
	}
	sort.Strings(tableNames)

	return &GroundingRuntime{
		available:       len(menuList) > 0 || len(tableNames) > 0,
		builtAt:         raw.BuiltAt,
		errorCount:      raw.ErrorCount,
		menuCount:       len(menuList),
		tableCount:      len(tableNames),
		columnCount:     colCount,
		menuMap:         menuMap,
		menuList:        menuList,
		tableMap:        tableMap,
		tableColsSorted: tableColsSorted,
		tableNames:      tableNames,
	}
}

func (g *GroundingRuntime) Stats() GroundingStats {
	if g == nil {
		return GroundingStats{}
	}
	return GroundingStats{
		Available:   g.available,
		BuiltAt:     g.builtAt,
		MenuCount:   g.menuCount,
		TableCount:  g.tableCount,
		ColumnCount: g.columnCount,
		ErrorCount:  g.errorCount,
	}
}

func editDistanceBounded(a, b string, maxDist int) int {
	if a == b {
		return 0
	}
	al, bl := len(a), len(b)
	diff := al - bl
	if diff < 0 {
		diff = -diff
	}
	if diff > maxDist {
		return maxDist + 1
	}
	prev := make([]int, bl+1)
	cur := make([]int, bl+1)
	for j := 0; j <= bl; j++ {
		prev[j] = j
	}
	for i := 1; i <= al; i++ {
		cur[0] = i
		rowMin := cur[0]
		ca := a[i-1]
		for j := 1; j <= bl; j++ {
			cost := 1
			if ca == b[j-1] {
				cost = 0
			}
			del := prev[j] + 1
			ins := cur[j-1] + 1
			sub := prev[j-1] + cost
			v := del
			if ins < v {
				v = ins
			}
			if sub < v {
				v = sub
			}
			cur[j] = v
			if v < rowMin {
				rowMin = v
			}
		}
		if rowMin > maxDist {
			return maxDist + 1
		}
		prev, cur = cur, prev
	}
	return prev[bl]
}

func suggestIdentifiers(target string, candidates []string, maxSuggestions int) []string {
	if target == "" || len(candidates) == 0 {
		return []string{}
	}
	tTokens := make(map[string]bool)
	for _, p := range strings.Split(target, "_") {
		if len(p) >= 2 {
			tTokens[p] = true
		}
	}
	type scoredIdent struct {
		name  string
		score float64
	}
	scored := make([]scoredIdent, 0, 16)
	for _, c := range candidates {
		score := 0.0
		lenDiff := len(c) - len(target)
		if lenDiff < 0 {
			lenDiff = -lenDiff
		}
		if strings.HasPrefix(c, target) || strings.HasPrefix(target, c) {
			pen := lenDiff
			if pen > 20 {
				pen = 20
			}
			score += float64(55 - pen)
		} else if strings.Contains(c, target) || strings.Contains(target, c) {
			pen := lenDiff
			if pen > 16 {
				pen = 16
			}
			score += float64(36 - pen)
		}
		if len(tTokens) > 0 {
			cParts := strings.Split(c, "_")
			shared := 0
			for _, p := range cParts {
				if tTokens[p] {
					shared++
				}
			}
			if shared > 0 {
				denom := len(tTokens)
				if len(cParts) > denom {
					denom = len(cParts)
				}
				score += float64(shared*28) / float64(denom)
			}
		}
		maxLen := len(target)
		if len(c) > maxLen {
			maxLen = len(c)
		}
		maxEdit := int(math.Floor(float64(maxLen) * 0.38))
		if maxEdit < 2 {
			maxEdit = 2
		}
		if maxEdit > 4 {
			maxEdit = 4
		}
		dist := editDistanceBounded(target, c, maxEdit)
		if dist <= maxEdit {
			score += float64((maxEdit + 1 - dist) * 14)
		}
		if score >= 14 {
			scored = append(scored, scoredIdent{name: c, score: score})
		}
	}
	sort.Slice(scored, func(a, b int) bool {
		if scored[a].score != scored[b].score {
			return scored[a].score > scored[b].score
		}
		return scored[a].name < scored[b].name
	})
	if len(scored) > maxSuggestions {
		scored = scored[:maxSuggestions]
	}
	out := make([]string, len(scored))
	for i, s := range scored {
		out[i] = s.name
	}
	return out
}

func suggestNearestMenus(rawCode string, menuList []GroundingMenuEntry, maxSuggestions int) []VerifiedMenuHit {
	if len(menuList) == 0 {
		return []VerifiedMenuHit{}
	}
	var digitsBuilder strings.Builder
	for i := 0; i < len(rawCode); i++ {
		if rawCode[i] >= '0' && rawCode[i] <= '9' {
			digitsBuilder.WriteByte(rawCode[i])
		}
	}
	digits := digitsBuilder.String()
	if len(digits) > 0 {
		padded := digits
		if len(padded) > 4 {
			padded = padded[:4]
		}
		for len(padded) < 4 {
			padded += "0"
		}
		targetNum, _ := strconv.Atoi(padded)
		leadDigit := digits[0]
		type scoredMenu struct {
			m           GroundingMenuEntry
			sameCat     bool
			prefixMatch int
			dist        int
		}
		scored := make([]scoredMenu, len(menuList))
		for i, m := range menuList {
			mNum, _ := strconv.Atoi(m.Code)
			dist := mNum - targetNum
			if dist < 0 {
				dist = -dist
			}
			pm := 0
			for pm < len(digits) && pm < len(m.Code) && digits[pm] == m.Code[pm] {
				pm++
			}
			scored[i] = scoredMenu{
				m:           m,
				sameCat:     len(m.Code) > 0 && m.Code[0] == leadDigit,
				prefixMatch: pm,
				dist:        dist,
			}
		}
		sort.Slice(scored, func(a, b int) bool {
			if scored[a].sameCat != scored[b].sameCat {
				return scored[a].sameCat
			}
			if scored[a].prefixMatch != scored[b].prefixMatch {
				return scored[a].prefixMatch > scored[b].prefixMatch
			}
			if scored[a].dist != scored[b].dist {
				return scored[a].dist < scored[b].dist
			}
			return scored[a].m.Code < scored[b].m.Code
		})
		capN := len(scored)
		if capN > maxSuggestions {
			capN = maxSuggestions
		}
		out := make([]VerifiedMenuHit, capN)
		for i := 0; i < capN; i++ {
			out[i] = VerifiedMenuHit{Code: scored[i].m.Code, Label: scored[i].m.Label, Module: scored[i].m.Module}
		}
		return out
	}

	low := strings.ToLower(rawCode)
	out := make([]VerifiedMenuHit, 0, maxSuggestions)
	for _, m := range menuList {
		if strings.Contains(strings.ToLower(m.Label), low) {
			out = append(out, VerifiedMenuHit{Code: m.Code, Label: m.Label, Module: m.Module})
			if len(out) >= maxSuggestions {
				break
			}
		}
	}
	return out
}

func cleanUniqueList(arr []string, maxItems int) []string {
	if len(arr) == 0 {
		return nil
	}
	out := make([]string, 0, len(arr))
	seen := make(map[string]bool, len(arr))
	for _, item := range arr {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		out = append(out, trimmed)
		if len(out) >= maxItems {
			break
		}
	}
	return out
}

func normalizeVerifyAudience(aud string) string {
	switch aud {
	case "user":
		return "user"
	case "dev":
		return "dev"
	default:
		return "all"
	}
}

func (g *GroundingRuntime) VerifyReferences(input VerifyReferenceInput) VerifyReferenceResult {
	aud := normalizeVerifyAudience(input.Audience)
	tablesRestricted := aud == "user"

	reqMenus := cleanUniqueList(input.Menus, 50)
	reqTables := cleanUniqueList(input.Tables, 50)
	reqColumns := cleanUniqueList(input.Columns, 100)

	validMenus := []VerifiedMenuHit{}
	invalidMenus := []InvalidMenuHit{}
	unknownMenus := []string{}

	for _, raw := range reqMenus {
		code := strings.TrimSpace(reMenuPrefix.ReplaceAllString(raw, ""))
		if hit, ok := g.menuMap[code]; ok {
			validMenus = append(validMenus, VerifiedMenuHit{Code: hit.Code, Label: hit.Label, Module: hit.Module})
		} else {
			unknownMenus = append(unknownMenus, code)
			invalidMenus = append(invalidMenus, InvalidMenuHit{
				Code:        code,
				Suggestions: suggestNearestMenus(code, g.menuList, 3),
			})
		}
	}

	// STRICT AUDIENCE ISOLATION: in user mode, refuse and omit ALL SQL table & column verification
	// without leaking whether any table or column exists.
	if tablesRestricted {
		requestedSQL := len(reqTables) > 0 || len(reqColumns) > 0
		notice := ""
		if requestedSQL {
			notice = "SQL table and column verification is disabled in user audience mode."
		}
		return VerifyReferenceResult{
			OK:                g.available && len(invalidMenus) == 0 && !requestedSQL,
			IndexAvailable:    g.available,
			Audience:          aud,
			TablesRestricted:  true,
			RestrictionNotice: notice,
			Menus: VerifyMenusSection{
				Valid:        validMenus,
				Invalid:      invalidMenus,
				UnknownMenus: unknownMenus,
			},
			Tables:  VerifyTablesSection{Valid: []VerifiedTableHit{}, Invalid: []InvalidTableHit{}},
			Columns: VerifyColumnsSection{Valid: []VerifiedColumnHit{}, Invalid: []InvalidColumnHit{}},
			Summary: VerifySummary{
				CheckedMenus: len(reqMenus),
				ValidMenus:   len(validMenus),
				InvalidMenus: len(invalidMenus),
			},
		}
	}

	validTables := []VerifiedTableHit{}
	invalidTables := []InvalidTableHit{}
	seenNormTables := make(map[string]bool, len(reqTables))

	for _, raw := range reqTables {
		tbl := strings.ToLower(raw)
		if seenNormTables[tbl] {
			continue
		}
		seenNormTables[tbl] = true
		if reForbiddenTable.MatchString(tbl) {
			invalidTables = append(invalidTables, InvalidTableHit{Table: tbl, Suggestions: []string{}})
			continue
		}
		if cols, ok := g.tableMap[tbl]; ok {
			validTables = append(validTables, VerifiedTableHit{Table: tbl, ColumnCount: len(cols)})
		} else {
			invalidTables = append(invalidTables, InvalidTableHit{
				Table:       tbl,
				Suggestions: suggestIdentifiers(tbl, g.tableNames, 4),
			})
		}
	}

	validColumns := []VerifiedColumnHit{}
	invalidColumns := []InvalidColumnHit{}
	seenNormCols := make(map[string]bool, len(reqColumns))

	for _, raw := range reqColumns {
		norm := strings.ToLower(raw)
		if seenNormCols[norm] {
			continue
		}
		seenNormCols[norm] = true
		parts := strings.Split(norm, ".")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			tblPart := ""
			colPart := ""
			if len(parts) > 0 {
				tblPart = parts[0]
			}
			if len(parts) > 1 {
				colPart = parts[1]
			}
			invalidColumns = append(invalidColumns, InvalidColumnHit{
				Ref:         norm,
				Table:       tblPart,
				Column:      colPart,
				Reason:      "expected table.column format",
				Suggestions: []string{},
			})
			continue
		}
		tbl, col := parts[0], parts[1]
		if reForbiddenTable.MatchString(tbl) {
			invalidColumns = append(invalidColumns, InvalidColumnHit{
				Ref:         tbl + "." + col,
				Table:       tbl,
				Column:      col,
				Reason:      "unknown table",
				Suggestions: []string{},
			})
			continue
		}
		colSet, ok := g.tableMap[tbl]
		if !ok {
			nearTables := suggestIdentifiers(tbl, g.tableNames, 4)
			suggestions := make([]string, len(nearTables))
			for i, nt := range nearTables {
				if ntCols, exists := g.tableMap[nt]; exists && ntCols[col] {
					suggestions[i] = nt + "." + col
				} else {
					suggestions[i] = nt
				}
			}
			invalidColumns = append(invalidColumns, InvalidColumnHit{
				Ref:         tbl + "." + col,
				Table:       tbl,
				Column:      col,
				Reason:      "unknown table",
				Suggestions: suggestions,
			})
			continue
		}
		if colSet[col] {
			validColumns = append(validColumns, VerifiedColumnHit{Ref: tbl + "." + col, Table: tbl, Column: col})
		} else {
			nearCols := suggestIdentifiers(col, g.tableColsSorted[tbl], 4)
			suggestions := make([]string, len(nearCols))
			for i, c := range nearCols {
				suggestions[i] = tbl + "." + c
			}
			invalidColumns = append(invalidColumns, InvalidColumnHit{
				Ref:         tbl + "." + col,
				Table:       tbl,
				Column:      col,
				Reason:      "unknown column",
				Suggestions: suggestions,
			})
		}
	}

	checkedTables := len(validTables) + len(invalidTables)
	checkedColumns := len(validColumns) + len(invalidColumns)
	ok := g.available && len(invalidMenus) == 0 && len(invalidTables) == 0 && len(invalidColumns) == 0

	return VerifyReferenceResult{
		OK:               ok,
		IndexAvailable:   g.available,
		Audience:         aud,
		TablesRestricted: false,
		Menus: VerifyMenusSection{
			Valid:        validMenus,
			Invalid:      invalidMenus,
			UnknownMenus: unknownMenus,
		},
		Tables: VerifyTablesSection{
			Valid:   validTables,
			Invalid: invalidTables,
		},
		Columns: VerifyColumnsSection{
			Valid:   validColumns,
			Invalid: invalidColumns,
		},
		Summary: VerifySummary{
			CheckedMenus:   len(reqMenus),
			ValidMenus:     len(validMenus),
			InvalidMenus:   len(invalidMenus),
			CheckedTables:  checkedTables,
			ValidTables:    len(validTables),
			InvalidTables:  len(invalidTables),
			CheckedColumns: checkedColumns,
			ValidColumns:   len(validColumns),
			InvalidColumns: len(invalidColumns),
		},
	}
}

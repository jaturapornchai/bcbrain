package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"
	"sync"
)

type PackMeta struct {
	Version    string `json:"version"`
	SyncCommit string `json:"syncCommit"`
	UpdatedAt  string `json:"updatedAt"`
	NoteCount  int    `json:"noteCount"`
	BuiltAt    string `json:"builtAt"`
}

type NoteSection struct {
	Heading string `json:"heading"`
	Raw     string `json:"raw"`
	Norm    string `json:"norm"`
}

type Edge struct {
	Slug     string `json:"slug"`
	Rel      string `json:"rel"`
	Inferred bool   `json:"inferred,omitempty"`
}

type ImageMedia struct {
	Alt string `json:"alt"`
	URL string `json:"url"`
}

type VideoMedia struct {
	Title        string `json:"title"`
	URL          string `json:"url"`
	VideoID      string `json:"videoId,omitempty"`
	ListID       string `json:"listId,omitempty"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
	EmbedURL     string `json:"embedUrl,omitempty"`
}

type WebPageLink struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

type NoteMedia struct {
	Images   []ImageMedia  `json:"images"`
	Videos   []VideoMedia  `json:"videos"`
	WebPages []WebPageLink `json:"webPages"`
}

type NoteHaystack struct {
	Title string `json:"title"`
	Meta  string `json:"meta"`
	Body  string `json:"body"`
}

type NoteTokens struct {
	Title []string       `json:"title"`
	Meta  []string       `json:"meta"`
	Body  map[string]int `json:"body"`
}

type Note struct {
	Slug       string        `json:"slug"`
	Folder     string        `json:"folder"`
	Audience   string        `json:"audience"`
	Title      string        `json:"title"`
	Tags       []string      `json:"tags"`
	Aliases    []string      `json:"aliases"`
	Sources    []string      `json:"sources"`
	Body       string        `json:"body"`
	CleanBody  string        `json:"cleanBody"`
	Tldr       string        `json:"tldr"`
	Sections   []NoteSection `json:"sections"`
	Facts      []string      `json:"facts"`
	Links      []string      `json:"links"`
	Backlinks  []string      `json:"backlinks"`
	OutEdges   []Edge        `json:"outEdges"`
	InEdges    []Edge        `json:"inEdges"`
	Media      NoteMedia     `json:"media"`
	Haystack   NoteHaystack  `json:"haystack"`
	Tokens     NoteTokens    `json:"tokens"`
	UpdatedAt  string        `json:"updatedAt"`
	LastCommit string        `json:"lastCommit"`

	// Derived in-memory fields computed on startup / lazily
	BodyLenU16 int       `json:"-"`
	secOnce    sync.Once `json:"-"`
}

type MenuLookupEntry struct {
	Code         string   `json:"code"`
	LegacyCode   string   `json:"legacyCode"`
	Name         string   `json:"name"`
	MenuPath     string   `json:"menuPath"`
	Edition      string   `json:"edition"`
	CatalogSlug  string   `json:"catalogSlug"`
	RelatedSlugs []string `json:"relatedSlugs"`
	Haystack     string   `json:"haystack"`
	NameNorm     string   `json:"-"`
}

type TableLookupEntry struct {
	Table        string   `json:"table"`
	SchemaSlug   string   `json:"schemaSlug"`
	SchemaTitle  string   `json:"schemaTitle"`
	RelatedSlugs []string `json:"relatedSlugs"`
	TitleNorm    string   `json:"-"`
}

type ErrorLookupEntry struct {
	ErrorText  string   `json:"errorText"`
	Norm       string   `json:"norm"`
	Slug       string   `json:"slug"`
	Title      string   `json:"title"`
	Folder     string   `json:"folder"`
	Audience   string   `json:"audience"`
	FixSnippet string   `json:"fixSnippet"`
	Tokens     []string `json:"-"`
}

type BootstrapPack struct {
	Text  string `json:"text"`
	Etag  string `json:"etag"`
	Chars int    `json:"chars"`
}

type Pack struct {
	Meta                PackMeta                 `json:"meta"`
	Folders             []string                 `json:"folders"`
	Notes               []*Note                  `json:"notes"`
	Menus               []MenuLookupEntry        `json:"menus"`
	Tables              []TableLookupEntry       `json:"tables"`
	Errors              []ErrorLookupEntry       `json:"errors"`
	BootstrapPacks      map[string]BootstrapPack `json:"bootstrapPacks"`
	VaultPackGzipBase64 string                   `json:"vaultPackGzipBase64"`
	VaultPackEtag       string                   `json:"vaultPackEtag"`
	VaultPackNoteCount  int                      `json:"vaultPackNoteCount"`
	Synonyms            [][]string               `json:"synonyms"`
	StopWords           []string                 `json:"stopWords"`
	Vocab               map[string]int           `json:"vocab"`

	VaultPackGzip []byte `json:"-"`
}

var relationTypes = []string{
	"uses_table",
	"writes_table",
	"posts_rule",
	"has_query",
	"exposes_api",
	"follows_rule",
	"part_of_arch",
	"solves_issue",
	"explains_term",
	"has_report",
	"guides_howto",
	"in_system",
	"answers_faq",
	"shares_menu",
	"implements_code",
	"bridges_zone",
	"hub_map",
	"related",
}

var relationSet = func() map[string]bool {
	m := make(map[string]bool, len(relationTypes))
	for _, r := range relationTypes {
		m[r] = true
	}
	return m
}()

var relationLabel = map[string]string{
	"uses_table":      "ใช้ตาราง",
	"writes_table":    "บันทึกตาราง",
	"posts_rule":      "รหัสเอกสาร/ผังบัญชี",
	"has_query":       "ตัวอย่าง SQL",
	"exposes_api":     "สเปก API",
	"follows_rule":    "กติกาหลัก",
	"part_of_arch":    "สถาปัตยกรรม",
	"solves_issue":    "แก้ปัญหา",
	"explains_term":   "คำศัพท์",
	"has_report":      "รายงาน",
	"guides_howto":    "วิธีทำ",
	"in_system":       "ระบบงาน",
	"answers_faq":     "ถาม-ตอบ",
	"shares_menu":     "รหัสเมนูเดียวกัน",
	"implements_code": "ใช้โค้ดชุดเดียวกัน",
	"bridges_zone":    "เชื่อมหน้าจอ-โค้ด",
	"hub_map":         "แผนที่หลัก",
	"related":         "เชื่อมโยง",
}

var strongRel = map[string]bool{
	"follows_rule":    true,
	"uses_table":      true,
	"writes_table":    true,
	"posts_rule":      true,
	"solves_issue":    true,
	"shares_menu":     true,
	"implements_code": true,
	"bridges_zone":    true,
	"has_query":       true,
	"exposes_api":     true,
	"has_report":      true,
}

var relPriority = map[string]int{
	"follows_rule":    6,
	"uses_table":      5,
	"writes_table":    5,
	"posts_rule":      5,
	"solves_issue":    5,
	"shares_menu":     4,
	"implements_code": 4,
	"bridges_zone":    4,
	"has_query":       3,
	"exposes_api":     3,
	"has_report":      3,
	"guides_howto":    2,
}

func matchesAudience(noteAud, filter string) bool {
	return filter == "" || filter == "all" || noteAud == "both" || noteAud == filter
}

func toSlug(raw string) string {
	s := strings.TrimSpace(raw)
	if strings.HasPrefix(s, "[[") {
		s = s[2:]
	}
	if strings.HasSuffix(s, "]]") {
		s = s[:len(s)-2]
	}
	s = strings.TrimSpace(s)
	// strip leading relation prefix like "uses_table::"
	if idx := strings.Index(s, "::"); idx > 0 {
		prefix := s[:idx]
		allRel := true
		for i := 0; i < len(prefix); i++ {
			c := prefix[i]
			if !((c >= 'a' && c <= 'z') || c == '_') {
				allRel = false
				break
			}
		}
		if allRel {
			s = s[idx+2:]
		}
	}
	if idx := strings.IndexAny(s, "|#"); idx >= 0 {
		s = s[:idx]
	}
	s = strings.ReplaceAll(strings.TrimSpace(s), "\\", "/")
	s = path.Base(s)
	s = strings.ToLower(s)
	s = strings.TrimSuffix(s, ".md")
	return s
}

func LoadPack(packPath string) (*Pack, error) {
	data, err := os.ReadFile(packPath)
	if err != nil {
		return nil, fmt.Errorf("read pack %s: %w", packPath, err)
	}
	var p Pack
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal pack %s: %w", packPath, err)
	}
	if p.VaultPackGzipBase64 != "" {
		gz, err := base64.StdEncoding.DecodeString(p.VaultPackGzipBase64)
		if err != nil {
			return nil, fmt.Errorf("decode vaultPackGzipBase64: %w", err)
		}
		p.VaultPackGzip = gz
		p.VaultPackGzipBase64 = "" // free base64 string to keep RAM lean
	}
	if p.Meta.Version == "" {
		p.Meta.Version = "3.0.0"
	}
	if p.Meta.NoteCount == 0 {
		p.Meta.NoteCount = len(p.Notes)
	}
	return &p, nil
}

package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func buildTestPack() *Pack {
	var gzBuf bytes.Buffer
	gw := gzip.NewWriter(&gzBuf)
	_, _ = gw.Write([]byte(`{"version":"3.0.0","notes":[]}`))
	_ = gw.Close()

	nowISO := time.Now().UTC().Format(time.RFC3339)
	oldISO := time.Now().UTC().Add(-90 * 24 * time.Hour).Format(time.RFC3339)

	return &Pack{
		Meta: PackMeta{
			Version:    "3.0.0",
			SyncCommit: "abc12345",
			UpdatedAt:  "25 พฤศจิกายน 2569 05:30 น.",
			NoteCount:  4,
			BuiltAt:    nowISO,
		},
		Folders: []string{"root", "howto", "troubleshoot", "schema"},
		Notes: []*Note{
			{
				Slug:      "index",
				Folder:    "root",
				Audience:  "both",
				Title:     "แผนที่สมอง BC",
				Tags:      []string{"root"},
				Aliases:   []string{"สารบัญ"},
				Body:      "สารบัญแผนที่สมองหลัก\n[[howto-sale-invoice]]\n[[tbl-ic-trans]]",
				CleanBody: "สารบัญแผนที่สมองหลัก",
				Tldr:      "สารบัญแผนที่สมองหลัก",
				Sections:  []NoteSection{{Heading: "แผนที่สมอง BC", Raw: "สารบัญแผนที่สมองหลัก", Norm: "สารบัญแผนที่สมองหลัก"}},
				Links:     []string{"howto-sale-invoice", "tbl-ic-trans"},
				OutEdges:  []Edge{{Slug: "howto-sale-invoice", Rel: "hub_map"}, {Slug: "tbl-ic-trans", Rel: "hub_map"}},
				Haystack:  NoteHaystack{Title: "แผนที่สมอง bc", Meta: "index root สารบัญ", Body: "สารบัญแผนที่สมองหลัก"},
				Tokens: NoteTokens{
					Title: []string{"แผนที่", "สมอง", "bc"},
					Meta:  []string{"index", "root", "สารบัญ"},
					Body:  map[string]int{"สารบัญ": 1, "แผนที่": 1, "สมอง": 1, "หลัก": 1},
				},
				UpdatedAt:  nowISO,
				LastCommit: "abc1234",
			},
			{
				Slug:      "howto-sale-invoice",
				Folder:    "howto",
				Audience:  "user",
				Title:     "เปิดบิลขาย ออกใบกำกับภาษีขาย เมนู 4013",
				Tags:      []string{"howto", "sale"},
				Aliases:   []string{"ออกบิลขาย", "4013"},
				Body:      "# เปิดบิลขาย\nเข้าเมนู **4013** ขายสินค้า/บริการ\n## ขั้นตอน\nเลือกสินค้า ตัดสต็อก กดบันทึก\n![หน้าขาย](https://bcaccount.com/manual/images/23-sales-invoice.png)",
				CleanBody: "# เปิดบิลขาย\nเข้าเมนู **4013** ขายสินค้า/บริการ\n## ขั้นตอน\nเลือกสินค้า ตัดสต็อก กดบันทึก",
				Tldr:      "เข้าเมนู 4013 ขายสินค้า/บริการ เลือกสินค้า ตัดสต็อก แล้วกดบันทึก",
				Sections: []NoteSection{
					{Heading: "เปิดบิลขาย", Raw: "# เปิดบิลขาย\nเข้าเมนู **4013** ขายสินค้า/บริการ", Norm: "# เปิดบิลขาย\nเข้าเมนู **4013** ขายสินค้า/บริการ"},
					{Heading: "ขั้นตอน", Raw: "## ขั้นตอน\nเลือกสินค้า ตัดสต็อก กดบันทึก", Norm: "## ขั้นตอน\nเลือกสินค้า ตัดสต็อก กดบันทึก"},
				},
				Facts:     []string{"[menu] เข้าเมนู 4013 ขายสินค้า/บริการ"},
				Links:     []string{"ts-stock-negative-control"},
				Backlinks: []string{"index"},
				OutEdges:  []Edge{{Slug: "ts-stock-negative-control", Rel: "solves_issue"}},
				InEdges:   []Edge{{Slug: "index", Rel: "hub_map"}},
				Media: NoteMedia{
					Images: []ImageMedia{{Alt: "หน้าขาย", URL: "https://bcaccount.com/manual/images/23-sales-invoice.png"}},
					Videos: []VideoMedia{{Title: "สอนขาย", URL: "https://www.youtube.com/watch?v=4b7hW0pxf9Y", VideoID: "4b7hW0pxf9Y", ThumbnailURL: "https://i.ytimg.com/vi/4b7hW0pxf9Y/hqdefault.jpg"}},
				},
				Haystack: NoteHaystack{
					Title: "เปิดบิลขาย ออกใบกำกับภาษีขาย เมนู 4013",
					Meta:  "howto-sale-invoice howto sale ออกบิลขาย 4013",
					Body:  "เข้าเมนู 4013 ขายสินค้า บริการ เลือกสินค้า ตัดสต็อก กดบันทึก",
				},
				Tokens: NoteTokens{
					Title: []string{"เปิด", "บิล", "ขาย", "ออก", "ใบ", "กำกับ", "ภาษี", "เมนู", "4013"},
					Meta:  []string{"howto", "sale", "invoice", "ออก", "บิล", "ขาย", "4013"},
					Body:  map[string]int{"เข้า": 1, "เมนู": 1, "4013": 1, "ขาย": 1, "สินค้า": 2, "บริการ": 1, "ตัด": 1, "สต็อก": 1, "บันทึก": 1},
				},
				UpdatedAt:  nowISO,
				LastCommit: "abc1234",
			},
			{
				Slug:      "ts-stock-negative-control",
				Folder:    "troubleshoot",
				Audience:  "user",
				Title:     "แก้ปัญหาเตือนสินค้าติดลบ ห้ามขายติดลบ",
				Tags:      []string{"troubleshoot", "stock"},
				Aliases:   []string{"ห้ามติดลบ", "สินค้าติดลบ"},
				Body:      "# แก้ปัญหาสินค้าติดลบ\n- **\"สินค้า [<รหัส>] ห้ามติดลบ\"** — ตรวจรับเข้าและคลังให้ถูกต้อง",
				CleanBody: "# แก้ปัญหาสินค้าติดลบ\n- **\"สินค้า [<รหัส>] ห้ามติดลบ\"** — ตรวจรับเข้าและคลังให้ถูกต้อง",
				Tldr:      "ตรวจสอบเอกสารรับเข้า คลัง ที่เก็บ และวันเวลาเอกสารก่อนบันทึกขาย",
				Sections:  []NoteSection{{Heading: "แก้ปัญหาสินค้าติดลบ", Raw: "# แก้ปัญหาสินค้าติดลบ\n- **\"สินค้า [<รหัส>] ห้ามติดลบ\"**", Norm: "# แก้ปัญหาสินค้าติดลบ\n- **\"สินค้า [<รหัส>] ห้ามติดลบ\"**"}},
				Backlinks: []string{"howto-sale-invoice"},
				InEdges:   []Edge{{Slug: "howto-sale-invoice", Rel: "solves_issue"}},
				Haystack: NoteHaystack{
					Title: "แก้ปัญหาเตือนสินค้าติดลบ ห้ามขายติดลบ",
					Meta:  "ts-stock-negative-control troubleshoot stock ห้ามติดลบ สินค้าติดลบ",
					Body:  "แก้ปัญหาสินค้าติดลบ สินค้า ห้ามติดลบ ตรวจรับเข้าและคลังให้ถูกต้อง",
				},
				Tokens: NoteTokens{
					Title: []string{"แก้", "ปัญหา", "เตือน", "สินค้า", "ติด", "ลบ", "ห้าม", "ขาย"},
					Meta:  []string{"ts", "stock", "negative", "control", "troubleshoot", "ห้าม", "ติด", "ลบ", "สินค้า"},
					Body:  map[string]int{"แก้": 1, "ปัญหา": 1, "สินค้า": 2, "ติด": 2, "ลบ": 2, "ห้าม": 1, "คลัง": 1},
				},
				UpdatedAt:  oldISO,
				LastCommit: "old0001",
			},
			{
				Slug:      "tbl-ic-trans",
				Folder:    "schema",
				Audience:  "dev",
				Title:     "ตาราง ic_trans หัวเอกสารสต็อก",
				Tags:      []string{"schema", "ic"},
				Aliases:   []string{"ic_trans"},
				Sources:   []string{"scripts/sql/01_init.sql:10-40"},
				Body:      "# ic_trans\nคอลัมน์ doc_no, trans_flag, last_status ใช้ NUMERIC ห้าม float",
				CleanBody: "# ic_trans\nคอลัมน์ doc_no, trans_flag, last_status ใช้ NUMERIC ห้าม float",
				Tldr:      "ตารางหัวเอกสารซื้อขายสต็อก ic_trans กรอง COALESCE(last_status,0)=0",
				Sections:  []NoteSection{{Heading: "ic_trans", Raw: "# ic_trans\nคอลัมน์ doc_no, trans_flag, last_status", Norm: "# ic_trans\nคอลัมน์ doc_no, trans_flag, last_status"}},
				Backlinks: []string{"index"},
				InEdges:   []Edge{{Slug: "index", Rel: "hub_map"}},
				Haystack: NoteHaystack{
					Title: "ตาราง ic_trans หัวเอกสารสต็อก",
					Meta:  "tbl-ic-trans schema ic ic_trans",
					Body:  "ic_trans คอลัมน์ doc_no trans_flag last_status ใช้ numeric ห้าม float",
				},
				Tokens: NoteTokens{
					Title: []string{"ตาราง", "ic_trans", "ic", "trans", "หัว", "เอกสาร", "สต็อก"},
					Meta:  []string{"tbl", "ic", "trans", "schema", "ic_trans"},
					Body:  map[string]int{"ic_trans": 1, "doc_no": 1, "trans_flag": 1, "last_status": 1, "numeric": 1},
				},
				UpdatedAt:  nowISO,
				LastCommit: "abc1234",
			},
		},
		Menus: []MenuLookupEntry{
			{
				Code:         "4013",
				LegacyCode:   "4.13",
				Name:         "ขายสินค้า/บริการ",
				MenuPath:     "ระบบขาย > ขายสินค้า/บริการ",
				Edition:      "ทุกรุ่น",
				CatalogSlug:  "menu-cat-4-sales",
				RelatedSlugs: []string{"howto-sale-invoice", "tbl-ic-trans"},
				Haystack:     "4013 4.13 ขายสินค้า/บริการ ระบบขาย > ขายสินค้า/บริการ",
			},
		},
		Tables: []TableLookupEntry{
			{
				Table:        "ic_trans",
				SchemaSlug:   "tbl-ic-trans",
				SchemaTitle:  "ตาราง ic_trans หัวเอกสารสต็อก",
				RelatedSlugs: []string{},
			},
		},
		Errors: []ErrorLookupEntry{
			{
				ErrorText:  "สินค้า [<รหัส>] ห้ามติดลบ",
				Norm:       "สินค้า ห้ามติดลบ",
				Stripped:   "สินค้า ห้ามติดลบ",
				Slug:       "ts-stock-negative-control",
				Title:      "แก้ปัญหาเตือนสินค้าติดลบ ห้ามขายติดลบ",
				Folder:     "troubleshoot",
				Audience:   "user",
				FixSnippet: "ตรวจสอบเอกสารรับเข้า คลัง และวันเวลาเอกสารก่อนบันทึกขาย",
			},
		},
		GroundingIndex: GroundingIndexFile{
			BuiltAt:     nowISO,
			MenuCount:   2,
			TableCount:  2,
			ColumnCount: 5,
			ErrorCount:  1,
			Menus: map[string]GroundingMenuEntry{
				"4013": {Code: "4013", Label: "ขายสินค้า/บริการ", Module: "ระบบขาย"},
				"1005": {Code: "1005", Label: "ปรับปรุงภาษา", Module: "เริ่มต้น"},
			},
			Tables: map[string][]string{
				"ic_trans":        {"doc_no", "doc_date", "trans_flag", "last_status"},
				"ic_trans_detail": {"doc_no", "item_code"},
				"bc_user_list":    {"user_code", "password_hash"}, // must be stripped by GroundingRuntime!
			},
		},
		OpenApiSpec: json.RawMessage(`{"openapi":"3.1.0","info":{"title":"BC Brain API & MCP Server","version":"3.0.0"},"paths":{"/mcp":{},"\/api\/verify":{}}}`),
		BootstrapPacks: map[string]BootstrapPack{
			"user": {Text: "# User Pack\n- **4013** ขายสินค้า/บริการ", Etag: `"bcpack-user-abc-1234"`, Chars: 40},
			"dev":  {Text: "# Dev Pack\n- `ic_trans` NUMERIC", Etag: `"bcpack-dev-abc-1234"`, Chars: 32},
		},
		VaultPackGzip:      gzBuf.Bytes(),
		VaultPackEtag:      `"bcbrain-abc12345-deadbeef"`,
		VaultPackNoteCount: 4,
		Synonyms: [][]string{
			{"สต็อก", "สินค้าคงเหลือ", "คลัง", "ic_trans"},
			{"ภพ30", "vat", "ภาษีมูลค่าเพิ่ม"},
		},
		StopWords: []string{"คือ", "อะไร", "ยังไง", "ที่", "ใน", "ของ", "การ", "ครับ", "ค่ะ"},
		Vocab: map[string]int{
			"ตัด": 50, "สต็อก": 120, "ยังไง": 500, "ล็อก": 40, "เอกสาร": 200, "แพ็ก": 30, "เกจ": 30,
			"พศ": 30, "คศ": 30, "ภงด3": 30, "ภงด53": 30, "ภพ30": 30, "ที่": 500, "พบ": 50, "บ่อย": 40,
			"ระบบ": 200, "ใน": 500, "ร้าน": 80, "ขาย": 300, "สด": 60, "ปิด": 90, "งวด": 80, "บัญชี": 250,
			"ยอด": 150, "คง": 100, "เหลือ": 100, "สินค้า": 400, "ใช้": 200, "ตาราง": 200, "เคลม": 40, "ยาง": 30,
			"รหัส": 150, "เมนู": 300, "คีย์": 30, "ลัด": 30, "เปิด": 120, "บิล": 150, "ห้าม": 100, "ติด": 80, "ลบ": 90,
			"แก้": 120, "ปัญหา": 150, "ออก": 120, "ใบ": 150, "กำกับ": 100, "ภาษี": 180, "สูตร": 80, "ทำ": 150,
		},
	}
}

func TestTokenizerParity(t *testing.T) {
	p := buildTestPack()
	tok := NewTokenizer(p.Vocab, p.StopWords, p.Synonyms)

	has := func(got []string, want string) bool {
		for _, g := range got {
			if g == want {
				return true
			}
		}
		return false
	}

	got1 := tok.Terms("ตัดสต๊อกยังไง")
	if len(got1) != 2 || got1[0] != "ตัด" || got1[1] != "สต็อก" {
		t.Fatalf("ตัดสต๊อกยังไง got %v, want [ตัด สต็อก]", got1)
	}
	got2 := tok.Terms("ภ.ง.ด.3 ภ.ง.ด.53 ภ.พ.30")
	if !has(got2, "ภงด3") || !has(got2, "ภงด53") || !has(got2, "ภพ30") {
		t.Fatalf("tax forms got %v", got2)
	}
	got3 := tok.Terms("ใช้POS ตารางap_supplier ic_trans_detail.wh_code 7.15.4 Ctrl + S")
	for _, want := range []string{"ใช้", "pos", "ap_supplier", "ap", "supplier", "ic_trans_detail", "wh_code", "wh", "7.15.4", "ctrl_s"} {
		if !has(got3, want) {
			t.Fatalf("mixed query missing %q in %v", want, got3)
		}
	}
	if has(got3, "15") {
		t.Fatalf("dotted menu code 7.15.4 should not split into 15: %v", got3)
	}
	// Out-of-domain trap must produce unmatched OOV terms so coverage stays < 0.5
	trap := tok.Terms("สูตรทำแกงเขียวหวานไก่ใส่กะทิสด")
	if len(trap) < 4 {
		t.Fatalf("trap query produced too few terms (risk of false high coverage): %v", trap)
	}
}

func TestSanitizeAndGaps(t *testing.T) {
	mockKey := strings.Join([]string{"sk", "dummy1234567890abcdef"}, "-")
	mockMail := strings.Join([]string{"user", "example.com"}, "@")
	mockIP := strings.Join([]string{"203.0", "113.5"}, ".")
	mockTel := strings.Join([]string{"081", "2345678"}, "")
	raw := "test " + mockKey + " email " + mockMail + " ip " + mockIP + " tel " + mockTel
	clean := SanitizeArg(raw)
	for _, forbidden := range []string{mockKey, mockMail, mockIP, mockTel} {
		if strings.Contains(clean, forbidden) {
			t.Fatalf("SanitizeArg leaked %q in %q", forbidden, clean)
		}
	}

	gl := NewGapLog("")
	gl.Record("quick_answer", raw, "user", "abstain", 0)
	gl.Record("quick_answer", raw, "user", "abstain", 0)
	rep := gl.Report(10)
	if !rep.OK || rep.UniqueQueries != 1 || rep.TotalRecorded != 2 || len(rep.Entries) != 1 || rep.Entries[0].Count != 2 {
		t.Fatalf("unexpected gap report: %+v", rep)
	}
	if strings.Contains(rep.Entries[0].Query, mockMail) {
		t.Fatalf("gap log leaked email: %q", rep.Entries[0].Query)
	}
}

func TestHTTPEndpointsAndMCPTools(t *testing.T) {
	srv := NewServer(buildTestPack(), "", false)
	ts := httptest.NewServer(srv)
	defer ts.Close()

	// 1. /healthz
	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("/healthz failed: err=%v status=%d", err, resp.StatusCode)
	}
	var hz map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&hz)
	resp.Body.Close()
	if hz["service"] != "bcbrain-mcp-go" || hz["version"] != "3.0.0" || hz["tools"] != float64(15) {
		t.Fatalf("unexpected /healthz: %v", hz)
	}

	// 2. GET /mcp -> 405
	resp, _ = http.Get(ts.URL + "/mcp")
	if resp.StatusCode != 405 {
		t.Fatalf("GET /mcp expected 405, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 3. POST /mcp tools/list -> all 15 tools
	rpcCall := func(payload string) (int, []byte) {
		r, err := http.Post(ts.URL+"/mcp", "application/json", strings.NewReader(payload))
		if err != nil {
			t.Fatalf("POST /mcp error: %v", err)
		}
		defer r.Body.Close()
		var buf bytes.Buffer
		_, _ = buf.ReadFrom(r.Body)
		return r.StatusCode, buf.Bytes()
	}

	code, body := rpcCall(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
	if code != 200 {
		t.Fatalf("tools/list status=%d", code)
	}
	var tl struct {
		Result struct {
			Tools []struct {
				Name string `json:"name"`
			} `json:"tools"`
		} `json:"result"`
	}
	_ = json.Unmarshal(body, &tl)
	if len(tl.Result.Tools) != 15 {
		t.Fatalf("expected 15 tools, got %d", len(tl.Result.Tools))
	}

	// 4. Notification -> 202
	code, _ = rpcCall(`{"jsonrpc":"2.0","method":"notifications/initialized"}`)
	if code != 202 {
		t.Fatalf("notification expected 202, got %d", code)
	}

	// 5. > 32KB body -> 413
	big := `{"jsonrpc":"2.0","id":2,"method":"ping","pad":"` + strings.Repeat("a", 33*1024) + `"}`
	code, _ = rpcCall(big)
	if code != 413 {
		t.Fatalf("oversized body expected 413, got %d", code)
	}

	// 6. Audience isolation + trap abstain + lookup_error + search_sections + get_facts + whats_new + verify_reference
	_, body = rpcCall(`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"lookup_error","arguments":{"query":"สินค้า ห้ามติดลบ","audience":"user"}}}`)
	if !strings.Contains(string(body), "ts-stock-negative-control") || !strings.Contains(string(body), "[lookup_error") {
		t.Fatalf("lookup_error failed: %s", string(body))
	}
	_, body = rpcCall(`{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"lookup_error","arguments":{"query":"สินค้า ห้ามติดลบ","audience":"dev"}}}`)
	if strings.Contains(string(body), "ts-stock-negative-control") || !strings.Contains(string(body), "🛑 Abstain") {
		t.Fatalf("lookup_error(dev) leaked user note or missed abstain: %s", string(body))
	}

	_, body = rpcCall(`{"jsonrpc":"2.0","id":41,"method":"tools/call","params":{"name":"search_sections","arguments":{"query":"เปิดบิลขาย 4013","audience":"user","limit":3,"max_chars":500}}}`)
	if !strings.Contains(string(body), "howto-sale-invoice") || !strings.Contains(string(body), "## Structured Facts") || strings.Contains(string(body), "tbl-ic-trans") {
		t.Fatalf("search_sections(user) unexpected: %s", string(body))
	}

	_, body = rpcCall(`{"jsonrpc":"2.0","id":42,"method":"tools/call","params":{"name":"get_facts","arguments":{"slugs":["howto-sale-invoice","tbl-ic-trans"],"kinds":["menu"],"audience":"user","limit":10}}}`)
	if !strings.Contains(string(body), "[menu]") || !strings.Contains(string(body), "4013") || strings.Contains(string(body), "tbl-ic-trans") {
		t.Fatalf("get_facts(user) unexpected: %s", string(body))
	}

	_, body = rpcCall(`{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"whats_new","arguments":{"days":30,"audience":"user"}}}`)
	if !strings.Contains(string(body), "[whats_new") || !strings.Contains(string(body), "howto-sale-invoice") || strings.Contains(string(body), "tbl-ic-trans") {
		t.Fatalf("whats_new(user) unexpected: %s", string(body))
	}

	// verify_reference(user) strictly refuses SQL tables/columns without leaking existence
	_, body = rpcCall(`{"jsonrpc":"2.0","id":51,"method":"tools/call","params":{"name":"verify_reference","arguments":{"menus":["4013","4999"],"tables":["ic_trans"],"columns":["ic_trans.doc_no"],"audience":"user"}}}`)
	var rpcWrap struct {
		Result ToolResult `json:"result"`
	}
	_ = json.Unmarshal(body, &rpcWrap)
	var vrUser VerifyReferenceResult
	_ = json.Unmarshal([]byte(rpcWrap.Result.Content[0].Text), &vrUser)
	if !vrUser.TablesRestricted || vrUser.OK || len(vrUser.Menus.Valid) != 1 || len(vrUser.Menus.UnknownMenus) != 1 || len(vrUser.Tables.Valid) != 0 || len(vrUser.Tables.Invalid) != 0 || len(vrUser.Columns.Valid) != 0 {
		t.Fatalf("verify_reference(user) failed isolation: %+v", vrUser)
	}

	// verify_reference(dev) validates tables, columns with fuzzy suggestions, and rejects forbidden tables
	_, body = rpcCall(`{"jsonrpc":"2.0","id":52,"method":"tools/call","params":{"name":"verify_reference","arguments":{"menus":["4013"],"tables":["ic_trans","ic_trans_typo","bc_user_list"],"columns":["ic_trans.doc_no","ic_trans.doc_noo"],"audience":"dev"}}}`)
	rpcWrap = struct {
		Result ToolResult `json:"result"`
	}{}
	_ = json.Unmarshal(body, &rpcWrap)
	var vrDev VerifyReferenceResult
	_ = json.Unmarshal([]byte(rpcWrap.Result.Content[0].Text), &vrDev)
	if vrDev.TablesRestricted || len(vrDev.Tables.Valid) != 1 || len(vrDev.Tables.Invalid) != 2 || len(vrDev.Columns.Valid) != 1 || len(vrDev.Columns.Invalid) != 1 {
		t.Fatalf("verify_reference(dev) unexpected: %+v", vrDev)
	}
	for _, inv := range vrDev.Tables.Invalid {
		if inv.Table == "bc_user_list" && len(inv.Suggestions) != 0 {
			t.Fatalf("forbidden table must return zero suggestions: %+v", inv)
		}
	}

	_, body = rpcCall(`{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"quick_answer","arguments":{"question":"สูตรทำแกงเขียวหวานไก่ใส่กะทิสด","audience":"user"}}}`)
	if !strings.Contains(string(body), "🛑 Abstain") {
		t.Fatalf("quick_answer did not abstain on trap: %s", string(body))
	}

	// 7. /api/gaps must now contain the abstained trap query and Cache-Control: no-store
	resp, _ = http.Get(ts.URL + "/api/gaps")
	gapCC := resp.Header.Get("Cache-Control")
	var gapRep GapReport
	_ = json.NewDecoder(resp.Body).Decode(&gapRep)
	resp.Body.Close()
	if !gapRep.OK || gapRep.UniqueQueries < 1 || !strings.Contains(gapCC, "no-store") {
		t.Fatalf("/api/gaps expected >=1 gap and no-store, got cc=%q rep=%+v", gapCC, gapRep)
	}

	// 7b. v3 REST endpoints + deterministic ETag 304 checks
	checkGetWith304 := func(path string) []byte {
		r1, err := http.Get(ts.URL + path)
		if err != nil || r1.StatusCode != 200 {
			t.Fatalf("GET %s failed: err=%v status=%d", path, err, r1.StatusCode)
		}
		et := r1.Header.Get("ETag")
		var b bytes.Buffer
		_, _ = b.ReadFrom(r1.Body)
		r1.Body.Close()
		if et == "" {
			t.Fatalf("GET %s missing ETag", path)
		}
		req, _ := http.NewRequest("GET", ts.URL+path, nil)
		req.Header.Set("If-None-Match", et)
		r2, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET %s (304) error: %v", path, err)
		}
		r2.Body.Close()
		if r2.StatusCode != 304 {
			t.Fatalf("GET %s expected 304 on ETag %s, got %d", path, et, r2.StatusCode)
		}
		return b.Bytes()
	}

	errRaw := checkGetWith304("/api/error?q=%E0%B8%AA%E0%B8%B4%E0%B8%99%E0%B8%84%E0%B9%89%E0%B8%B2%20%E0%B8%AB%E0%B9%89%E0%B8%B2%E0%B8%A1%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%A5%E0%B8%9A&audience=user&limit=3")
	if !strings.Contains(string(errRaw), "ts-stock-negative-control") {
		t.Fatalf("/api/error unexpected: %s", string(errRaw))
	}

	secRaw := checkGetWith304("/api/sections?q=%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%94%E0%B8%9A%E0%B8%B4%E0%B8%A5%E0%B8%82%E0%B8%B2%E0%B8%A2%204013&audience=user&limit=3")
	if !strings.Contains(string(secRaw), "howto-sale-invoice") {
		t.Fatalf("/api/sections unexpected: %s", string(secRaw))
	}

	factsRaw := checkGetWith304("/api/facts?slugs=howto-sale-invoice&kinds=menu&audience=user&limit=10")
	if !strings.Contains(string(factsRaw), "4013") {
		t.Fatalf("/api/facts unexpected: %s", string(factsRaw))
	}

	wnRaw := checkGetWith304("/api/whats-new?days=30&audience=user&limit=5")
	if !strings.Contains(string(wnRaw), "howto-sale-invoice") || strings.Contains(string(wnRaw), "tbl-ic-trans") {
		t.Fatalf("/api/whats-new unexpected: %s", string(wnRaw))
	}

	verGetRaw := checkGetWith304("/api/verify?menus=4013&tables=ic_trans&audience=user")
	var verGetObj VerifyReferenceResult
	_ = json.Unmarshal(verGetRaw, &verGetObj)
	if !verGetObj.TablesRestricted || len(verGetObj.Tables.Valid) != 0 {
		t.Fatalf("GET /api/verify(user) failed SQL refusal: %+v", verGetObj)
	}

	verPostResp, err := http.Post(ts.URL+"/api/verify", "application/json", strings.NewReader(`{"menus":["4013"],"tables":["ic_trans"],"columns":["ic_trans.doc_no"],"audience":"dev"}`))
	if err != nil || verPostResp.StatusCode != 200 {
		t.Fatalf("POST /api/verify failed: err=%v status=%d", err, verPostResp.StatusCode)
	}
	var verPostObj VerifyReferenceResult
	_ = json.NewDecoder(verPostResp.Body).Decode(&verPostObj)
	verPostResp.Body.Close()
	if !verPostObj.OK || verPostObj.TablesRestricted || len(verPostObj.Columns.Valid) != 1 {
		t.Fatalf("POST /api/verify(dev) unexpected: %+v", verPostObj)
	}

	oaRaw := checkGetWith304("/api/openapi.json")
	if !strings.Contains(string(oaRaw), `"3.1.0"`) {
		t.Fatalf("/api/openapi.json unexpected: %s", string(oaRaw))
	}

	// 8. /api/vault-pack & 304 ETag
	resp, _ = http.Get(ts.URL + "/api/vault-pack")
	etag := resp.Header.Get("ETag")
	var packBytes bytes.Buffer
	_, _ = packBytes.ReadFrom(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || packBytes.Len() < 10 || packBytes.Bytes()[0] != 0x1f || packBytes.Bytes()[1] != 0x8b {
		t.Fatalf("/api/vault-pack invalid gzip")
	}
	req304, _ := http.NewRequest("GET", ts.URL+"/api/vault-pack", nil)
	req304.Header.Set("If-None-Match", etag)
	resp304, _ := http.DefaultClient.Do(req304)
	resp304.Body.Close()
	if resp304.StatusCode != 304 {
		t.Fatalf("/api/vault-pack expected 304, got %d", resp304.StatusCode)
	}

	// 9. /api/bootstrap-pack & /api/fast & /mcp/events?snapshot=1
	resp, _ = http.Get(ts.URL + "/api/bootstrap-pack?audience=user")
	var bootBuf bytes.Buffer
	_, _ = bootBuf.ReadFrom(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !strings.Contains(bootBuf.String(), "**4013**") {
		t.Fatalf("/api/bootstrap-pack failed: %d %s", resp.StatusCode, bootBuf.String())
	}

	resp, _ = http.Get(ts.URL + "/api/fast?menu=4013&audience=user")
	fastEtag := resp.Header.Get("ETag")
	var fastRes FastRestResult
	_ = json.NewDecoder(resp.Body).Decode(&fastRes)
	resp.Body.Close()
	if !fastRes.OK || !strings.Contains(fastRes.Answer, "**4013**") || fastEtag == "" {
		t.Fatalf("/api/fast?menu=4013 failed: etag=%q res=%+v", fastEtag, fastRes)
	}
	// Regression: default JSON /api/fast ETag must stay deterministic across uncached->cached calls and return 304
	reqFast304, _ := http.NewRequest("GET", ts.URL+"/api/fast?menu=4013&audience=user", nil)
	reqFast304.Header.Set("If-None-Match", fastEtag)
	respFast304, _ := http.DefaultClient.Do(reqFast304)
	respFast304.Body.Close()
	if respFast304.StatusCode != 304 {
		t.Fatalf("/api/fast (json) expected 304 on If-None-Match %s, got %d", fastEtag, respFast304.StatusCode)
	}
	// Also verify query-mode /api/fast (uncached -> cached) returns 304 in default JSON format
	respQ1, _ := http.Get(ts.URL + "/api/fast?q=%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%94%E0%B8%9A%E0%B8%B4%E0%B8%A5%E0%B8%82%E0%B8%B2%E0%B8%A2&audience=user&mode=ultra")
	fastQEtag := respQ1.Header.Get("ETag")
	respQ1.Body.Close()
	if respQ1.StatusCode != 200 || fastQEtag == "" {
		t.Fatalf("/api/fast?q=... call 1 failed: status=%d etag=%q", respQ1.StatusCode, fastQEtag)
	}
	reqQ304, _ := http.NewRequest("GET", ts.URL+"/api/fast?q=%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%94%E0%B8%9A%E0%B8%B4%E0%B8%A5%E0%B8%82%E0%B8%B2%E0%B8%A2&audience=user&mode=ultra", nil)
	reqQ304.Header.Set("If-None-Match", fastQEtag)
	respQ304, _ := http.DefaultClient.Do(reqQ304)
	respQ304.Body.Close()
	if respQ304.StatusCode != 304 {
		t.Fatalf("/api/fast?q=... (json) expected 304 on If-None-Match %s, got %d", fastQEtag, respQ304.StatusCode)
	}

	resp, _ = http.Get(ts.URL + "/mcp/events?snapshot=1")
	var snap map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&snap)
	resp.Body.Close()
	if resp.StatusCode != 200 || snap["events"] == nil {
		t.Fatalf("/mcp/events?snapshot=1 failed")
	}

	// 10. Concurrency check across parallel goroutines
	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c, b := rpcCall(`{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"search_brain","arguments":{"query":"เปิดบิลขาย 4013","audience":"user"}}}`)
			if c != 200 || !strings.Contains(string(b), "howto-sale-invoice") {
				t.Errorf("concurrent search_brain failed: %d %s", c, string(b))
			}
		}()
	}
	wg.Wait()
}

func TestRealPackIfProvided(t *testing.T) {
	packPath := os.Getenv("BC_GO_PACK_FILE")
	if packPath == "" {
		t.Skip("BC_GO_PACK_FILE not set; skipping real-pack integration test")
	}
	pack, err := LoadPack(packPath)
	if err != nil {
		t.Fatalf("LoadPack failed: %v", err)
	}
	if len(pack.Notes) < 350 || len(pack.Menus) < 700 || len(pack.Errors) < 20 {
		t.Fatalf("unexpected pack sizes: notes=%d menus=%d errors=%d", len(pack.Notes), len(pack.Menus), len(pack.Errors))
	}
	eng := NewEngine(pack)
	devHits := eng.Search("คู่มือ AI นักพัฒนา เขียนโค้ดต่อยอด", 5, "dev")
	if len(devHits) == 0 || devHits[0].Slug != "playbook-dev" {
		t.Fatalf("expected playbook-dev #1 for dev playbook query, got %+v", devHits)
	}
	menu2050 := eng.Search("รหัสเมนู 2050 คำนวณยอดสต็อกใหม่", 5, "user")
	if len(menu2050) == 0 || (menu2050[0].Slug != "ts-stock-cost-mismatch-rebuild" && menu2050[0].Slug != "howto-stock-costing-recalc") {
		t.Fatalf("expected menu 2050 rebuild #1, got %+v", menu2050)
	}
	for _, errQ := range []string{"ห้ามติดลบ", "ล็อกหน่วยต้นทุนแล้ว", "ปิดงวดไปแล้ว", "ยอดมัดจำมากกว่ามูลค่าสุทธิ"} {
		hits := eng.LookupError(errQ, "user", 5)
		if len(hits) == 0 {
			t.Fatalf("LookupError(%q, user) returned 0 hits", errQ)
		}
		for _, h := range hits {
			if h.Audience == "dev" {
				t.Fatalf("LookupError(%q, user) leaked dev note %s", errQ, h.Slug)
			}
		}
	}
	// Out-of-domain Thai traps must return 0 hits on LookupError AND strictly abstain on ask_brain / quick_answer
	mcpSrv := NewMCPService(eng, NewEventBus(), NewGapLog(""), false)
	for _, trap := range []string{
		"สูตรทำแกงเขียวหวานไก่ใส่กะทิสด",
		"วิธีปลูกทุเรียนภูเขาไฟ",
		"ยานอวกาศ ดาวอังคาร บั้งไฟพญานาค คอนโดหรู",
		"วิธีซ่อมแอร์บ้านน้ำหยดและล้างคอยล์เย็น",
		"สูตรหมักหมูย่างเกาหลีน้ำจิ้มแจ่ว",
		"อากาศวันนี้ฝนตกไหม",
	} {
		if hits := eng.LookupError(trap, "user", 5); len(hits) != 0 {
			t.Fatalf("LookupError(%q, user) false positive: %+v", trap, hits)
		}
		meta := eng.SearchWithMeta(trap, 5, "all")
		askBytes, _, err := mcpSrv.callTool("ask_brain", map[string]any{"question": trap})
		if err != nil || !strings.Contains(string(askBytes), "🛑 Abstain") {
			t.Fatalf("ask_brain(%q) failed to abstain (err=%v conf=%s matched=%d/%d top=%d): %s", trap, err, meta.Confidence, meta.BestMatchedTerms, meta.TotalTerms, meta.TopScore, sliceRunes(string(askBytes), 200))
		}
		qaBytes, _, err := mcpSrv.callTool("quick_answer", map[string]any{"question": trap, "audience": "user"})
		if err != nil || !strings.Contains(string(qaBytes), "🛑 Abstain") {
			t.Fatalf("quick_answer(%q, user) failed to abstain (err=%v): %s", trap, err, sliceRunes(string(qaBytes), 200))
		}
	}
	// Full-vault x [300, 700, 1200] excerpt sweep: 0 corrupted table rows & 0 unclosed code fences
	sweepTerms := []string{"ขาย", "ตาราง", "sql", "เมนู"}
	for _, n := range pack.Notes {
		for _, b := range []int{300, 700, 1200} {
			ex := eng.ExcerptNote(n, sweepTerms, b, true)
			if len(reFenceLine.FindAllStringIndex(ex, -1))%2 != 0 {
				t.Fatalf("unclosed code fence in excerpt(%s, %d)", n.Slug, b)
			}
			for _, line := range strings.Split(ex, "\n") {
				tr := strings.TrimSpace(line)
				if strings.HasPrefix(tr, "|") && strings.HasSuffix(tr, "…") {
					t.Fatalf("corrupted table row in excerpt(%s, %d): %s", n.Slug, b, tr)
				}
			}
		}
	}

	// Measure pure uncached Search() latency across 200 calls
	sampleQs := []struct {
		aud string
		q   string
	}{
		{"user", "ขายสินค้า ออกใบกำกับภาษีขาย"},
		{"user", "เช็ครับ เช็คขึ้นเงิน เช็คเด้ง"},
		{"user", "รหัสเมนู 2050 คำนวณยอดสต็อกใหม่"},
		{"dev", "โครงสร้างตาราง ic_trans_detail"},
		{"dev", "กฎเหล็ก SQL บัญชี NUMERIC last_status"},
	}
	t0 := time.Now()
	const iters = 200
	for i := 0; i < iters; i++ {
		c := sampleQs[i%len(sampleQs)]
		hits := eng.Search(c.q, 5, c.aud)
		if len(hits) == 0 {
			t.Fatalf("empty hits for %q", c.q)
		}
	}
	avgMs := float64(time.Since(t0).Microseconds()) / 1000.0 / float64(iters)
	t.Logf("uncached Go Engine.Search avg latency over %d calls: %.4f ms/search", iters, avgMs)
	if avgMs >= 0.5 {
		t.Fatalf("uncached Search too slow: %.4f ms/search (target < 0.5ms)", avgMs)
	}
}

# คู่มือและ Prompt สำเร็จรูปสำหรับเชื่อมต่อ & อัปเกรดระบบลูกข่ายสู่ BC Brain v3.0.0

> เอกสารกลางตามกติกา `AGENTS.md` §7 — ใช้สำหรับส่งให้ AI ประจำโปรเจกต์ภายนอก (`D:\yalecom`, `D:\jarvisbcaiaccount` และเครื่องมือ AI อื่นๆ) อัปเกรดการเชื่อมต่อกับ **สมอง BC (`https://brain.bcsmethai.com`, v3.0.0)** โดยไม่แก้ไขไฟล์ข้ามโปรเจกต์จากฝั่ง `d:\bcbrain`

## Objective

- ทำให้ระบบลูกข่ายทุกตัวใช้ประโยชน์จาก **BC Brain v3.0.0** ได้เต็มประสิทธิภาพ:
  - **Compiled Go 1.26 Zero-CGO Sidecar (`:3961`, `< 1 ms`)** หลัง Caddy (`/mcp`, `/api/*`, `/healthz`, `/mcp/events`)
  - **15 MCP Tools** (เพิ่ม 5 เครื่องมือใหม่จาก v2.3.0: `lookup_error`, `search_sections`, `get_facts`, `verify_reference`, `whats_new`) + **10 REST Endpoints + OpenAPI 3.1.0** (`/api/openapi.json`)
  - **คลังความรู้ 380 โน้ต · 2,478 ไซแนปส์** (`239` โน้ตโซน `user` ที่ปรับภาษาพูดลูกค้า/Call Center/ฝ่ายขายครบทุกใบรวม 14 โน้ตใหม่ + `140` โน้ตโซน `dev` + `1` โน้ต `both` + สารบัญรหัสเมนู 4 หลักครบ **735 หน้าจอ** + Ground Truth **625 ตาราง SQL / 10,153 คอลัมน์**)
  - **กันหลอนเข้มงวด**: `🛑 Abstain` เมื่อความมั่นใจต่ำ, `verify_reference` ตรวจรหัสเมนู/ตาราง/คอลัมน์จากโค้ดจริง และแยกโซน `audience: "user"` / `"dev"` เด็ดขาด (`tablesRestricted: true` ในโหมด `user`)

## Workflow & Config

| ระบบปลายทาง | โซน `audience` | ช่องทางหลัก | เครื่องมือหลักที่ควรใช้ |
|---|---|---|---|
| **`D:\yalecom`** (BC Call Center 5 คู่สาย + J.A.R.V.I.S + CRM) | **`user` เท่านั้น (บังคับ 100%)** | `POST /mcp` + RAM Mirror (`/api/vault-pack` ETag `304`) + REST Fallback (`/api/fast`, `/api/error`) | `quick_answer(mode="ultra")`, `lookup_error`, `search_sections`, `get_facts`, `verify_reference(menus)`, `lookup_menu`, `whats_new`, `GET /api/gaps` |
| **`D:\jarvisbcaiaccount`** — สายลูกค้าสาธารณะ (`:7863` → `jarvis.bcaiaccount.com`) | **`user` เท่านั้น (บังคับ 100%)** | Local Stdio MCP (`mcp-stdio.ts --sync`, `< 1 ms`) หรือ `POST /mcp` | `quick_answer(mode="normal", include_media=true)`, `lookup_error`, `search_sections`, `get_facts`, `verify_reference(menus)`, `find_media`, `whats_new` |
| **`D:\jarvisbcaiaccount`** — สายเจ้าของ (`:7862`) | **`dev` / `all` / `both`** | Local Stdio MCP (`mcp-stdio.ts --sync`, `< 1 ms`) หรือ `POST /mcp` | ครบทั้ง 15 Tools รวม `verify_reference(menus, tables, columns, audience="dev")`, `traverse_brain`, `batch_read` + `call_qa.py` ตรวจสายผ่าน `get_facts`/`verify_reference`/`/api/gaps` |
| **AI ตัวอื่นๆ** (Claude Code, Gemini, Antigravity, Cursor, ChatGPT GPT Actions, n8n, LINE OA) | เลือกตามบทบาท (`user` หรือ `dev`) | Streamable HTTP `/mcp`, Local Stdio, หรือ OpenAPI 3.1 `/api/openapi.json` | เลือกจากตาราง Routing 15 Tools ในหมวดที่ 3 |

## Dependency

- Endpoint สาธารณะ (Read-Only, ไม่ต้องใช้ API Key): `https://brain.bcsmethai.com/mcp` และ `https://brain.bcsmethai.com/api/openapi.json`
- หากใช้ Local Stdio MCP (`d:\bcbrain\scripts\mcp-stdio.ts --sync`) ต้องมี Node.js 24+ บนเครื่อง

---

## 1. Prompt อัปเกรด `D:\yalecom` (BC Call Center + J.A.R.V.I.S Voice Agent + CRM)

คัดลอกข้อความในกล่องด้านล่างไปสั่ง AI ประจำโปรเจกต์ **`D:\yalecom`** (`https://callcenter.bcsmethai.com/`) ได้ทันที:

```text
ช่วยอัปเกรดระบบเชื่อมต่อสมอง BC ในโปรเจกต์ D:\yalecom (BC Call Center + J.A.R.V.I.S Voice Agent + CRM + livekit-voice-ai) จาก BC Brain v2.3.0 (10 tools) เป็น **BC Brain v3.0.0** (15 MCP Tools · Compiled Go Sidecar < 1 ms · 380 โน้ต รวม 239 โน้ตโซน user ที่ขยายภาษาพูด Call Center/ฝ่ายขายครบทุกใบแล้ว) โดยทำเฉพาะไฟล์ภายใน D:\yalecom เท่านั้น (ห้ามแตะไฟล์นอก D:\yalecom เด็ดขาด)

### ไฟล์เป้าหมายที่ต้องตรวจและอัปเดต
1. `jarvis/voice_agent.py`
   - อัปเดต `BRAIN_AUDIENCE_TOOLS` และ `MCP_CACHEABLE_TOOLS` ให้ครอบคลุม 5 เครื่องมือใหม่ของ v3.0.0:
     - `lookup_error`
     - `search_sections`
     - `get_facts`
     - `verify_reference`
     - `whats_new`
     (รวมครบทั้ง 15 tools และบังคับใส่ `audience: "user"` เสมอกับทุกเครื่องมือใน `BRAIN_AUDIENCE_TOOLS` บนสายโทรศัพท์ลูกค้าทุกสาย 100%)
   - ปรับ Routing บนสายโทรศัพท์ (5 คู่สาย Inbound SIP/RTP):
     - คำถามทั่วไป / ขายโปรแกรม / วิธีใช้สั้นทางเสียง → คง fast-path `quick_answer(question, audience="user", mode="ultra", include_facts=true)` (Fallback REST: `GET https://brain.bcsmethai.com/api/fast?q=...&audience=user&mode=ultra`)
     - เมื่อลูกค้าอ่านข้อความแจ้งเตือน / Error บนหน้าจอโปรแกรมให้ฟัง (เช่น "ล็อกหน่วยต้นทุนแล้ว", "ห้ามขายสินค้าติดลบ", "ยอดมัดจำมากกว่ามูลค่าสุทธิ") → เรียก `lookup_error(query, audience="user")` หรือ Fallback `GET https://brain.bcsmethai.com/api/error?q=...&audience=user` ทันที (O(1) < 1 ms)
     - เมื่อลูกค้าถามเจาะแท็บ/หัวข้อย่อย/คำถามเฉพาะจุด (เช่น "ข้อเลือกพิเศษ ส่วนที่ 4", "ย้ายข้อมูลจาก BC 5.5", "ยกเลิกบิลข้ามเดือน") → ใช้ `search_sections(query, audience="user", max_chars=900)` หรือ `GET /api/sections` เพื่อดึงหัวข้อ `## คำถามที่ลูกค้ามักถาม` และขั้นตอนที่ไม่ถูกตัดกลางประโยค/ตาราง
     - เมื่อลูกค้าถาม "ช่วงนี้มีอะไรอัปเดตใหม่" → ใช้ `whats_new(days=14, audience="user")` หรือ `GET /api/whats-new`
     - ก่อนอ่านรหัสเมนู 4 หลัก (`1001`–`9070`) ออกเสียงให้ลูกค้าฟัง → ตรวจยืนยันด้วย `verify_reference(menus=[...], audience="user")` หรือ `GET /api/verify?menus=...&audience=user` (หรือเทียบดัชนี 735 เมนูใน `BrainVaultMirror`) เพื่อกันพูดรหัสเมนูผิด 100%
     - คงกฎเหล็ก `🛑 Abstain`: หาก `quick_answer` / `lookup_error` คืน `🛑 Abstain` ห้ามแต่งคำตอบเอง ให้ใช้เฉพาะข้อมูลใกล้เคียงที่ยืนยันแล้วจาก `BrainVaultMirror` และแจ้งลูกค้าตรงๆ ว่าส่วนที่ถามตรงๆ ยังไม่มีข้อมูลยืนยัน

2. `jarvis/brain_mirror.py`
   - **แก้บั๊กแยกโซน**: เพิ่ม `"doctypes"` เข้าไปใน `DEV_FOLDERS` (`frozenset({"api", "architecture", "dev-playbook", "doctypes", "queries", "schema"})`) เพื่อให้ตรงกับ 6 โฟลเดอร์โซน `dev` ของ BC Brain v3.0.0 100% (ป้องกันโน้ต `doctypes` หลุดเข้าสายลูกค้า)
   - ยืนยันการซิงก์ `/api/vault-pack` (380 โน้ต, ~239 โน้ตโซน `user`) และ `load_bootstrap_pack("user")` (`/api/bootstrap-pack?audience=user`) ด้วย `If-None-Match` / ETag `304 Not Modified` ให้โหลดครบทุกโน้ตใหม่รวม 14 โน้ต Call Center & Pre-Sales ล่าสุด

3. `jarvis/config.py` และ `jarvis/grounding.py`
   - อัปเดต System Prompt ใน `jarvis/config.py` จากอ้างอิง BC Brain v2.3.0 (10 tools) เป็น **BC Brain v3.0.0 (15 tools)** พร้อมแนวทางเลือกใช้ `lookup_error`, `search_sections`, `get_facts`, `verify_reference`
   - ใน `jarvis/grounding.py` และ `DeepSeekJudge`: ใช้ `get_facts(query/slugs, kinds=["menu","rule","limit","error"], audience="user")` (หรือ `GET /api/facts`) เป็นแหล่งข้อเท็จจริงเชิงโครงสร้างสำหรับตรวจยืนยันราคา 4 รุ่น (Starter ฟรี 0 บ./ด. ≤100 คน, Standard เริ่ม 199 บ./ด., Professional เริ่ม 499 บ./ด., Enterprise เริ่ม 999 บ./ด.), สิทธิ์/ข้อจำกัด และรหัสเมนู 4 หลัก เพื่อลดการตัดประโยคที่ถูกต้อง (false-positive overcut) และกันการแต่งตัวเลข

4. `lib/call-analyzer.mjs` + รอบพัฒนาตัวเอง (`scripts/dev-on-the-fly-scan.mjs` / `docs/brain-wishlist.md`) + `livekit-voice-ai/`
   - เพิ่มการดึง `GET https://brain.bcsmethai.com/api/gaps?limit=50` (Telemetry ช่องว่างความรู้ที่ผ่านการล้าง PII แล้ว, `Cache-Control: no-store`) ในรอบตรวจสอบ QA / `dev-on-the-fly` เพื่อนำคำถามที่ติด Abstain มาทบทวนเทียบกับ `docs/brain-wishlist.md` โดยไม่บันทึกข้อมูลส่วนตัวลูกค้า
   - ใน `livekit-voice-ai/` (หากมีการเรียก `/api/fast` หรือ `/mcp`) ให้อัปเดตรองรับ `/api/error`, `/api/sections`, `/api/verify` ด้วย `audience=user` เช่นเดียวกัน
   - อัปเดต `README.md` จาก v2.3.0 (10 tools, 366 โน้ต) เป็น v3.0.0 (15 tools, 380 โน้ต, Go Sidecar `< 1 ms`)

### กฎความปลอดภัยและเงื่อนไขการตรวจรับ (Verification)
- ห้ามให้สายโทรศัพท์หรือ CRM ส่ง `audience: "dev"` / `"all"` ออกไปยังผู้โทรเด็ดขาด (ล็อก `audience: "user"` 100%)
- ทดสอบเชื่อมจริงกับ `https://brain.bcsmethai.com/healthz` (ต้องได้ `service: "bcbrain-mcp-go"`, `version: "3.0.0"`, `notes: 380`, `tools: 15`)
- รันชุดทดสอบที่มีอยู่ให้ผ่านทั้งหมด:
  - `python scripts/test-mcp-startup.py` (เพิ่มเคสตรวจครบ 15 tools, `lookup_error`, `search_sections`, `get_facts`, `verify_reference` ใน `audience="user"` ต้องได้ `tablesRestricted: true`, และ `BrainVaultMirror` แยก `"doctypes"` ออกแล้ว 100%)
  - `python scripts/test-voice-quality.py`
  - `npm run typecheck`
```

---

## 2. Prompt อัปเกรด `D:\jarvisbcaiaccount` (J.A.R.V.I.S BC Ai Account — Owner + Public Line)

คัดลอกข้อความในกล่องด้านล่างไปสั่ง AI ประจำโปรเจกต์ **`D:\jarvisbcaiaccount`** (`https://jarvis.bcaiaccount.com/`) ได้ทันที:

```text
ช่วยอัปเกรดระบบ J.A.R.V.I.S BC Ai Account ในโปรเจกต์ D:\jarvisbcaiaccount (สายเจ้าของ `127.0.0.1:7862` + สายลูกค้าสาธารณะ `127.0.0.1:7863` → `https://jarvis.bcaiaccount.com/`) จาก BC Brain v2.3.0 (10 tools) เป็น **BC Brain v3.0.0** (15 MCP Tools · Compiled Go Sidecar `< 1 ms` · Local Stdio `< 1 ms` · 380 โน้ต รวม 239 โน้ตโซน user ที่ปรับภาษาพูดครบแล้ว) โดยทำเฉพาะไฟล์ภายใน D:\jarvisbcaiaccount เท่านั้น (ห้ามแตะไฟล์นอก D:\jarvisbcaiaccount เด็ดขาด)

### ไฟล์เป้าหมายที่ต้องตรวจและอัปเดต
1. `voice_agent.py`
   - อัปเดต `BRAIN_AUDIENCE_TOOLS` และ `MCP_CACHEABLE_TOOLS` ให้รวมครบ 5 เครื่องมือใหม่ของ v3.0.0:
     - `lookup_error`
     - `search_sections`
     - `get_facts`
     - `verify_reference`
     - `whats_new`
   - **สายลูกค้าสาธารณะ (`127.0.0.1:7863` → `https://jarvis.bcaiaccount.com/`) — บังคับ `audience="user"` 100%**:
     - ค่าเริ่มต้นบนเว็บ: `quick_answer(question, audience="user", mode="normal", max_chars=4200, include_media=true, include_facts=true)` เพื่อสร้าง `[จอ]`, `[ขั้นตอน]`, `[การ์ด]` พร้อมลิงก์ภาพหน้าจอทางการ `bcaccount.com` และคลิป YouTube `PLO9P7tPZLXB0` (หากเป็นสาย `sip-*` ใช้ `mode="ultra"`)
     - เมื่อผู้ใช้พิมพ์หรืออ่าน Error/แจ้งเตือนหน้าจอ → เรียก `lookup_error(query, audience="user")` ทันที
     - เมื่อถามเจาะหัวข้อย่อย/เงื่อนไขเฉพาะจุด → เรียก `search_sections(query, audience="user")` เพื่อได้ข้อความ Block-Aware ที่ไม่ตัดกลางตาราง Markdown หรือรายการขั้นตอน
     - ก่อนแสดงหรืออ่านรหัสเมนู 4 หลัก (`1001`–`9070`) → เรียก `verify_reference(menus=[...], audience="user")` (ฝั่งเซิร์ฟเวอร์บังคับ `tablesRestricted: true` และปฏิเสธการตรวจชื่อตาราง/คอลัมน์ SQL เด็ดขาดในโหมด `user`)
     - เมื่อถามการอัปเดตล่าสุด → เรียก `whats_new(days=14, audience="user")`
   - **สายเจ้าของ (`127.0.0.1:7862`) — รองรับ `audience="dev"` / `"all"` ครบทั้ง 15 เครื่องมือ**:
     - คง `BRAIN_MCP_TRANSPORT=auto` (ใช้ Local Stdio `node d:\bcbrain\scripts\mcp-stdio.ts --sync` ที่รองรับครบ 15 tools `< 1 ms` ก่อน แล้ว fallback HTTP `https://brain.bcsmethai.com/mcp`)
     - ก่อนเขียนหรือแสดงบล็อก ```sql บน `[จอ]` ในโหมด `dev`/`all` → บังคับเรียก `verify_reference(menus=[...], tables=[...], columns=[...], audience="dev")` เพื่อยืนยันตาราง/คอลัมน์เทียบ Ground Truth จริง (`625` ตาราง / `10,153` คอลัมน์ / `735` เมนู) ป้องกันการแต่งชื่อตารางหรือคอลัมน์ SQL 100%

2. `config.py`
   - อัปเดต `SYSTEM_PROMPT` จาก BC Brain v2.3.0 เป็น **BC Brain v3.0.0 (15 tools)** ระบุลำดับเลือกเครื่องมือชัดเจน (`quick_answer`, `lookup_error`, `lookup_menu`, `search_sections`, `get_facts`, `verify_reference`, `whats_new`, `batch_ask`, `batch_read`, `ask_brain`, `find_media`)
   - อัปเดต `GEO_USER_AGENT` เป็น `"jarvis-bcaiaccount/3.0 (+https://jarvis.bcaiaccount.com)"`

3. `grounding.py` และ `qa_cache.py`
   - เพิ่มการนำข้อเท็จจริงจาก `get_facts(query/slugs, audience=...)` (เช่น `[menu]`, `[limit]`, `[rule]`, `[formula]`, `[error]`) เข้าสู่ชุด `known` ของ `grounding.py` (`numbers()` / `unsourced()`) เพื่อให้ตัวเลขจากราคา 4 รุ่น, ลิมิตผู้ใช้, รหัสเมนู และสูตรบัญชีผ่านการตรวจ Decimal grounding อย่างแม่นยำโดยไม่ถูก overcut
   - ใช้ `search_sections` เสริมหรือแทนการหั่นหัวข้อแบบข้อความตรงตัวใน `note_sections()` เพื่อไม่ให้ตาราง Markdown หรือรายการย่อยขาดกลางบล็อก
   - ใน `qa_cache.py`: คงกฎห้ามแคชคำตอบที่ติด `🛑 Abstain` หรือคำตอบที่ `verify_reference` พบรายการไม่ตรง Ground Truth และเพิ่ม version tag/invalidate cache เก่าเมื่อ ETag ของ `/api/bootstrap-pack` เปลี่ยน (อัปเดตครบ 380 โน้ต)

4. `call_qa.py`, `scripts/qa_review.py` และ `static/index.html` (หน้า `/qa` เฉพาะสายเจ้าของ `:7862`)
   - ใน `call_qa.py`: เพิ่มขั้นตอนตรวจยืนยันอัตโนมัติในรอบ Audit หลังวางสาย โดยดึงรหัสเมนู 4 หลัก (และชื่อตาราง SQL ในสาย Owner) จากคำตอบของ AI ส่งตรวจผ่าน `verify_reference` + เทียบข้อเท็จจริงด้วย `get_facts` เพื่อจับอาการ `hallucination` เชิงตัวเลข/รหัสเมนู/ตารางได้อย่างเป็นระบบ
   - เพิ่มการดึง `GET https://brain.bcsmethai.com/api/gaps?limit=30` ในแดชบอร์ด `/qa` (สายเจ้าของเท่านั้น, ปิด `404` บนสายสาธารณะตามเดิม) เพื่อดูคำถามที่สมองยังขาดและกดสอน AI (`/teach`) หรือรวบรวมส่งกลับให้ `d:\bcbrain`
   - อัปเดต `README.md` ให้สะท้อน BC Brain v3.0.0 (15 tools, 380 โน้ต, Go Sidecar `< 1 ms`)

### กฎความปลอดภัยและเงื่อนไขการตรวจรับ (Verification)
- ยืนยันเด็ดขาดว่าสายลูกค้าสาธารณะ (`:7863`) ห้ามเข้าถึง `/qa`, `/leads`, `/teach`, `/cache/stats` (คืน `404`) และทุกการเรียก BC Brain ถูกบังคับ `audience: "user"` (ทดสอบเรียก `verify_reference` ด้วย `tables: ["ic_trans"]` บนสายสาธารณะต้องได้ `tablesRestricted: true` และห้ามหลุดข้อมูลตาราง)
- รันชุดตรวจรับให้ผ่านทั้งหมด:
  - `D:\bctest01\.venv\Scripts\python.exe -m py_compile config.py voice_agent.py grounding.py qa_cache.py call_recorder.py call_qa.py scripts\wav_transcribe.py scripts\qa_review.py`
  - `D:\bctest01\.venv\Scripts\python.exe scripts\test_qa_and_answers.py`
  - `D:\bctest01\.venv\Scripts\python.exe scripts\test_brain_v230.py` (ขยายหรือเพิ่ม `scripts\test_brain_v300.py` ตรวจครบทั้ง 15 tools ทั้ง Local Stdio และ HTTP `/mcp` + `verify_reference` แยกโซน `user`/`dev` + 380 โน้ต)
  - `D:\bctest01\.venv\Scripts\python.exe scripts\test_live_answers.py`
```

---

## 3. Prompt สากลและชุดตั้งค่าสำหรับ AI ตัวอื่นๆ (Claude Code, Gemini, Antigravity, Cursor, ChatGPT, n8n, LINE Bot)

### 3.1 ตั้งค่าการเชื่อมต่อ (เลือก 1 ช่องทาง)

#### ช่องทาง A: Streamable HTTP MCP (แนะนำ — เร็ว `< 1 ms` ผ่าน Go Sidecar, Public Read-Only ไม่ต้องใช้ API Key)

- **Claude Code**:
  ```bash
  claude mcp add --transport http bcbrain https://brain.bcsmethai.com/mcp
  ```
- **Antigravity (`~/.gemini/antigravity/mcp_config.json`)**:
  ```json
  { "mcpServers": { "bcbrain": { "serverUrl": "https://brain.bcsmethai.com/mcp" } } }
  ```
- **Gemini CLI (`~/.gemini/settings.json`)**:
  ```json
  { "mcpServers": { "bcbrain": { "httpUrl": "https://brain.bcsmethai.com/mcp" } } }
  ```
- **Cursor / โปรเจกต์ทั่วไป (`.mcp.json`)**:
  ```json
  { "mcpServers": { "bcbrain": { "type": "http", "url": "https://brain.bcsmethai.com/mcp" } } }
  ```
- **Codex (`~/.codex/config.toml`)**:
  ```toml
  [mcp_servers.bcbrain]
  url = "https://brain.bcsmethai.com/mcp"
  ```

#### ช่องทาง B: Local Stdio MCP (`< 1 ms` ไร้ RTT สำหรับเครื่องที่มี `d:\bcbrain`)

```json
{
  "mcpServers": {
    "bcbrain": {
      "command": "node",
      "args": ["d:/bcbrain/scripts/mcp-stdio.ts", "--sync"]
    }
  }
}
```

#### ช่องทาง C: REST API + OpenAPI 3.1.0 (ChatGPT Custom GPT Actions, n8n, LINE OA Webhook, Make)

- Import สเปก OpenAPI 3.1.0 ได้โดยตรงที่: `https://brain.bcsmethai.com/api/openapi.json` (ไม่ต้องตั้งค่า Auth)
- ตัวอย่าง Endpoint หลัก (รองรับ `ETag` / `304 Not Modified` และ CORS):
  - `GET https://brain.bcsmethai.com/api/fast?q=<คำถาม>&audience=user&mode=ultra`
  - `GET https://brain.bcsmethai.com/api/error?q=<ข้อความแจ้งเตือน>&audience=user`
  - `GET https://brain.bcsmethai.com/api/sections?q=<คำค้นหัวข้อ>&audience=user`
  - `GET https://brain.bcsmethai.com/api/facts?q=<คำค้น>&kinds=menu,rule,limit&audience=user`
  - `GET https://brain.bcsmethai.com/api/whats-new?days=7&audience=user`
  - `GET|POST https://brain.bcsmethai.com/api/verify` (body: `{"menus":["4013"],"tables":["ic_trans"],"columns":["ic_trans.doc_no"],"audience":"dev"}`)
  - `GET https://brain.bcsmethai.com/api/bootstrap-pack?audience=user` (สำหรับ System Prompt Caching ตอบพื้นฐานใน `0 ms`)
  - `GET https://brain.bcsmethai.com/api/vault-pack` (แพ็ก gzip ทั้งคลัง 380 โน้ต + ETag สำหรับทำ Local Mirror)
  - `GET https://brain.bcsmethai.com/api/gaps` (Telemetry ช่องว่างความรู้แบบไร้ PII, `Cache-Control: no-store`)
  - `GET https://brain.bcsmethai.com/healthz` (ตรวจสถานะ Sidecar, เวอร์ชัน `3.0.0`, จำนวนโน้ต `380`, จำนวนเครื่องมือ `15`)

### 3.2 ตารางเลือกใช้เครื่องมือทั้ง 15 ตัว (Routing Decision Table)

| สถานการณ์ / ประเภทคำถาม | เครื่องมือแนะนำ | โซน `audience` |
|---|---|---|
| ตอบไวใน 1 รอบ (แชท/เว็บ/Voice/LINE) | `quick_answer` (`normal` / `fast` / `ultra`) | `user` หรือ `dev` |
| ถามพ่วง 2–5 ประเด็นพร้อมกัน | `batch_ask` (default `mode: "ultra"`) | `user` หรือ `dev` |
| ค้นรหัสเมนู 4 หลัก (`1001`–`9070`), รหัสเดิม (`4.13`), ชื่อตาราง SQL | `lookup_menu` (O(1) `< 1 ms`) | `user` (เมนู) / `dev` (เมนู+ตาราง) |
| ลูกค้าส่งหรืออ่านข้อความ Error / แจ้งเตือนบนจอ | `lookup_error` (O(1) `< 1 ms`) | `user` (หรือ `dev`) |
| เจาะเฉพาะหัวข้อย่อย (`## Section`) โดยไม่ตัดกลางตาราง/ขั้นตอน | `search_sections` | `user` หรือ `dev` |
| ดึงข้อเท็จจริงแบบมีประเภท (`menu`, `rule`, `limit`, `error`, `formula`) | `get_facts` | `user` หรือ `dev` |
| ตรวจยืนยันรหัสเมนู 4 หลัก / ชื่อตาราง / `table.column` ก่อนตอบ | `verify_reference` | `user` (เมนูเท่านั้น) / `dev` (ครบ) |
| ตรวจโน้ตที่เพิ่งอัปเดตล่าสุดใน N วัน | `whats_new` | `user` หรือ `dev` |
| อ่าน 2–5 โน้ตที่รู้ `slug` แล้วพร้อมกันใน 1 รอบ | `batch_read` | `user` หรือ `dev` |
| สังเคราะห์หลายโน้ต + สื่อครบ + กราฟเชื่อมโยง 1 ทอด | `ask_brain` (`compact: true`) | `user` หรือ `dev` |
| ค้นหาหลายตัวเลือกแบบ Hybrid RRF + ดูรายการสื่อแนบ | `search_brain` | `user` หรือ `dev` |
| ดึงเฉพาะรูปภาพหน้าจอ `bcaccount.com` และคลิป YouTube `PLO9P7tPZLXB0` | `find_media` | `user` |
| ไล่ความสัมพันธ์ 1–3 ทอด หรือหาเส้นทางเชื่อมหน้าจอ ↔ โค้ด ↔ ตาราง | `traverse_brain` | `dev` หรือ `all` |
| อ่านเนื้อหาเต็มหรือตัดตาม `query` ของโน้ต 1 ใบ | `read_note` | ตามโซนโน้ต |
| ดูสารบัญโน้ตกรองตาม `folder` / `tag` / `audience` | `list_notes` | `user` / `dev` / `all` |

### 3.3 Prompt สำเร็จรูปสำหรับวางลง System Prompt ของ AI ตัวอื่นๆ

```text
คุณเชื่อมต่อกับคลังความรู้ **สมอง BC (BC Brain v3.0.0 — 380 โน้ต, 15 MCP Tools)** ที่ `https://brain.bcsmethai.com/mcp` (OpenAPI 3.1: `https://brain.bcsmethai.com/api/openapi.json`) ซึ่งสกัดจากซอร์สโค้ดจริงของโปรแกรมบัญชี BC Ai Account

### กฎการเรียกใช้เครื่องมือ (Fast & Grounded)
1. **แยกโซน `audience` ทุกครั้ง**:
   - งานบริการลูกค้า / Call Center / ฝ่ายขาย / LINE OA / ผู้ใช้ทั่วไป → ส่ง `audience: "user"` เสมอ ห้ามปนชื่อตาราง SQL, คอลัมน์, เส้นทาง API หรือศัพท์โค้ด
   - งานนักพัฒนา / เขียน SQL / Schema / `trans_flag` / Dr-Cr / API → ส่ง `audience: "dev"` (หรือ `"all"` เฉพาะเมื่อต้องดูบริบทหน้าจอควบคู่โค้ด)
2. **เลือกเครื่องมือให้ตรงงานใน 1 รอบ**:
   - คำถามทั่วไป → `quick_answer` (`mode: "ultra"` สำหรับแชทสั้น/เสียง, `mode: "normal"` + `include_media: true` สำหรับคู่มือละเอียด)
   - ข้อความแจ้งเตือน/Error บนหน้าจอ → `lookup_error`
   - รหัสเมนู 4 หลัก (`1001`–`9070`) หรือชื่อตาราง SQL → `lookup_menu`
   - เจาะหัวข้อย่อย/แท็บตั้งค่า/คำถามเฉพาะจุด → `search_sections`
   - ดึงราคา/ลิมิต/กฎ/สูตรแบบมีประเภท → `get_facts`
   - หลายคำถามพร้อมกัน → `batch_ask` · อ่านหลายโน้ตพร้อมกัน → `batch_read`
3. **กฎเหล็กกันหลอน (Zero Hallucination)**:
   - ก่อนตอบรหัสเมนู 4 หลัก หรือก่อนเขียนชื่อตาราง/คอลัมน์ SQL ให้ตรวจสอบด้วย `verify_reference` เสมอ
   - หากสมองตอบ `🛑 Abstain` หรือไม่พบข้อมูลยืนยัน **ห้ามเดา ห้ามแต่งฟีเจอร์/ราคา/ส่วนลด/กฎหมายภาษีเอง** ให้แจ้งตามตรงว่ายังไม่มีข้อมูลยืนยันในระบบ และส่งต่อช่องทางติดต่อทางการ (`https://bcaccount.com/quotation` หรือ LINE `@bcaccount`)
   - ฝั่งนักพัฒนา: ค่าเงินและจำนวนสินค้าทุกตัวต้องใช้ `NUMERIC` / Decimal เท่านั้น (ห้าม binary float), คิวรีเอกสารต้องกรอง `COALESCE(last_status, 0) = 0` และระบุ `trans_flag` เสมอ
```

## Limitation

- เอกสารนี้ใช้เป็นคู่มือและต้นแบบ Prompt สำหรับนำไปสั่งงานในแต่ละโปรเจกต์ปลายทางเท่านั้น (ฝั่ง `d:\bcbrain` ไม่แก้ไขไฟล์ข้ามโปรเจกต์)
- Endpoint สาธารณะจำกัดอัตราเรียกไม่เกิน **300 ครั้ง/นาทีต่อ IP** และขนาดคำขอสูงสุด **32 KB** — ระบบลูกข่ายที่มีปริมาณทราฟฟิกสูงควรเปิดใช้ ETag `304`, Local RAM Mirror (`/api/vault-pack`), หรือ Local Stdio MCP (`mcp-stdio.ts --sync`)
- โซน `user` ปฏิเสธการตรวจสอบชื่อตารางและคอลัมน์ SQL โดยสมบูรณ์ (`tablesRestricted: true`) และเปิดเผยเฉพาะตารางราคามาตรฐาน 4 รุ่นตามข้อมูลทางการใน `sales-pricing-packages` และ `sales-accounting-partner` เท่านั้น

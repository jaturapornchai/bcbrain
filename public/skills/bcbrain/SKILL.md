---
name: bcbrain
description: เชื่อมและค้นสมอง BC (https://brain.bcsmethai.com/mcp) ทั้งโหมดนักพัฒนา (Schema, SQL, trans_flag, Dr/Cr, API/MCP) และโหมดผู้ใช้ทั่วไป/Call Center/ฝ่ายขาย เรียกผ่านคำสั่ง /bcbrain หรืออัตโนมัติเมื่อพัฒนาต่อยอด เขียนคิวรี หรือตอบคำถามระบบ BC Ai Account และชุดโปรแกรม BC
---

# สมอง BC (`/bcbrain` · v3.0.0)

Skill สำหรับให้ AI เชื่อมต่อและดึงความรู้จาก **สมอง BC v3.0.0** (`https://brain.bcsmethai.com/mcp`) ซึ่งขับเคลื่อนด้วย **Compiled Go Sidecar (`< 1 ms`) + Hybrid Multi-Signal RRF + Section BM25 + Grounding Verifier** สกัดจากซอร์สโค้ดจริงของ **BC Ai Account** และระบบในชุด BC รองรับทั้งโซนผู้ใช้ทั่วไป (`user`) และโซนนักพัฒนา (`dev`)

## 1. รูปแบบคำสั่ง `/bcbrain` (Slash Modes)

| คำสั่ง | โหมด (`audience`) | ใช้เมื่อไร |
|---|---|---|
| `/bcbrain <คำถามใช้งาน>` | `user` | วิธีใช้งานหน้าจอ แก้ปัญหาหน้างาน Call Center ตอบคำถามลูกค้า/ฝ่ายขาย |
| `/bcbrain dev <โจทย์เทคนิค>` | `dev` | ออกแบบต่อยอด โครงสร้างตาราง SQL `trans_flag` ผังบัญชี Dr/Cr API และสถาปัตยกรรม |
| `/bcbrain all <โจทย์เชื่อมสองฝั่ง>` | `all` | ต้องดูทั้งบริบทหน้าจอผู้ใช้และโครงสร้างเทคนิคพร้อมกัน |
| `/bcbrain setup` | — | แสดงวิธีตั้งค่าเชื่อม MCP `https://brain.bcsmethai.com/mcp` ตามเครื่องมือที่ใช้ |

- หากผู้ใช้ไม่ระบุ `dev` หรือ `user` หลัง `/bcbrain`:
  - ถามเรื่องตาราง, SQL, คอลัมน์, `trans_flag`, API, โค้ด, `WritePolicy`, หรือผัง Dr/Cr เชิงเทคนิค → ใช้ `audience: "dev"`
  - ถามเรื่องวิธีทำบนหน้าจอ, แก้ข้อผิดพลาดหน้างาน, รายงาน, หรือข้อมูลก่อนซื้อ → ใช้ `audience: "user"`

---

## 2. ลำดับการเชื่อมต่อ MCP (`https://brain.bcsmethai.com/mcp`)

1. **ทางหลัก — เรียก MCP Tools ของ server `bcbrain` โดยตรง (15 Tools · Go Sidecar `< 1 ms`)**
   - **กลุ่มตอบเร็วสุด (แนะนำใช้เป็นค่าเริ่มต้น)**:
     - `quick_answer` — จบใน 1 รอบ (`normal` ~2,000 อักษร, `fast` ~1,400 อักษร, หรือ `ultra` ~600 อักษร TL;DR) พร้อมข้อเท็จจริงสรุป (`facts`) และด่าน `🛑 Abstain` กันหลอน
     - `batch_ask` — ถาม 1–5 คำถามพร้อมกันใน 1 รอบ (ค่าเริ่มต้น `mode: "ultra"`)
     - `lookup_menu` — ค้นรหัสเมนู 4 หลัก (`1001`–`9070`), รหัสจุดเดิม (`4.13`), ชื่อเมนู หรือชื่อตาราง SQL แบบ O(1) ใน `< 1 ms`
     - `lookup_error` — ค้นข้อความแจ้งเตือนภาษาไทยบนหน้าจอจริงแบบ O(1) ได้สาเหตุ วิธีแก้ และโน้ตตรงจุดพร้อม `🛑 Abstain`
     - `search_sections` — ค้นเจาะลึกระดับหัวข้อย่อย (`## Section` BM25) คืนข้อความตัดขอบตาราง/รายการ/โค้ดสมบูรณ์ + `Structured Facts`
     - `get_facts` — ดึงข้อเท็จจริงแบบมีประเภท (`[menu]`, `[rule]`, `[limit]`, `[error]`, `[formula]`) กรองตามคำค้น/slug/ประเภท (ไร้ศัพท์โค้ดในโหมด `user`)
     - `verify_reference` — ตรวจยืนยันรหัสเมนู 4 หลัก (ทุกโหมด) และชื่อตาราง SQL / `table.column` (เฉพาะ `dev`/`all` — บล็อกเด็ดขาดในโหมด `user`) เทียบ Ground Truth จากโค้ดจริงเพื่อกันหลอน
     - `whats_new` — ดูโน้ตที่อัปเดตล่าสุดภายใน N วัน
     - `batch_read` — อ่าน 1–5 โน้ตพร้อมกันใน 1 รอบ (รองรับตัดเฉพาะหัวข้อตาม `query`)
   - **กลุ่มค้นเชิงลึก / สื่อ / กราฟ**: `ask_brain`, `search_brain` (Hybrid Multi-Signal RRF + Section BM25), `find_media`, `traverse_brain`, `read_note`, `list_notes` (ในบางเครื่องมืออาจขึ้นชื่อเป็น `mcp_bcbrain_<tool>`, `mcp__bcbrain__<tool>` หรือเรียกผ่าน `call_mcp_tool` ด้วย server `"bcbrain"`)
   - **REST API (OpenAPI 3.1) & Local Mirror ความเร็วสูงสุด**:
     - `GET https://brain.bcsmethai.com/api/fast?q=<คำถาม>&audience=user&mode=ultra` (รองรับ CDN Edge cache `s-maxage=300`, ETag `304`)
     - `GET /api/error`, `/api/sections`, `/api/facts`, `/api/whats-new`, `GET|POST /api/verify`, `/api/gaps`, `/api/bootstrap-pack`, `/api/vault-pack`
     - OpenAPI 3.1 Spec: `GET https://brain.bcsmethai.com/api/openapi.json`
     - Local Stdio MCP (`node scripts/mcp-stdio.ts --sync` ดึงแพ็ก gzip ~675 KB จาก `/api/vault-pack` มาแคชใน RAM บนเครื่อง → `< 1 ms` ไร้ RTT)

2. **ทางสำรองทันที — Stateless HTTP JSON-RPC (เมื่อ session ปัจจุบันยังไม่ได้ผูก MCP `bcbrain`)**
   - Endpoint `https://brain.bcsmethai.com/mcp` เป็น Public Read-Only Stateless Streamable HTTP (ไม่ต้องใช้ API key) สามารถเรียกผ่าน Node.js one-liner ได้ทันที:

```bash
# macOS / Linux / Git Bash
node -e 'const [,,name,args]=process.argv; fetch("https://brain.bcsmethai.com/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:JSON.parse(args)}})}).then(r=>r.json()).then(j=>console.log(j.result?.content?.[0]?.text??JSON.stringify(j)))' quick_answer '{"question":"โครงสร้าง ic_trans","audience":"dev"}'
```

```powershell
# Windows PowerShell (ใช้ here-string กัน shell ตัดเครื่องหมายคำพูดใน JSON)
@'
const r = await fetch("https://brain.bcsmethai.com/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "quick_answer", arguments: { question: "โครงสร้าง ic_trans", audience: "dev" } } }),
});
const j = await r.json();
console.log(j.result?.content?.[0]?.text ?? JSON.stringify(j));
'@ | node --input-type=module -
```

3. **วิธีผูก MCP ถาวร (`/bcbrain setup`)**
   - **Claude Code**:
     ```bash
     claude mcp add --transport http bcbrain https://brain.bcsmethai.com/mcp
     ```
   - **Antigravity (`~/.gemini/antigravity/mcp_config.json`)**:
     ```json
     {
       "mcpServers": {
         "bcbrain": {
           "serverUrl": "https://brain.bcsmethai.com/mcp"
         }
       }
     }
     ```
   - **Gemini CLI (`~/.gemini/settings.json`)**:
     ```json
     {
       "mcpServers": {
         "bcbrain": {
           "httpUrl": "https://brain.bcsmethai.com/mcp"
         }
       }
     }
     ```
   - **Codex (`~/.codex/config.toml`)**:
     ```toml
     [mcp_servers.bcbrain]
     url = "https://brain.bcsmethai.com/mcp"
     ```
   - **ระดับโปรเจกต์ (`.mcp.json`)**:
     ```json
     {
       "mcpServers": {
         "bcbrain": {
           "type": "http",
           "url": "https://brain.bcsmethai.com/mcp"
         }
       }
     }
     ```

---

## 3. ลำดับการค้นแบบเร็วสุดและประหยัด Token (Ultra-Fast Retrieval Workflow)

### โหมดนักพัฒนา (`audience: "dev"`)
1. **ตอบไวใน 1 รอบ (ไม่ต้องเสียรอบอ่าน playbook ก่อนทุกครั้ง)**:
   - ถามโจทย์เทคนิคทั่วไป → เรียก `quick_answer({ question, audience: "dev" })`
   - หาตาราง SQL / รหัสเมนูตรงตัว → เรียก `lookup_menu({ query: "ic_trans", audience: "dev" })`
   - ตรวจยืนยันชื่อตาราง/คอลัมน์ก่อนเขียน SQL กันหลอน → เรียก `verify_reference({ tables: ["ic_trans"], columns: ["ic_trans.doc_no"], audience: "dev" })`
   - เจาะหัวข้อย่อยหรือดึงสูตร/กฎแบบกระชับ → `search_sections({ query, audience: "dev" })` หรือ `get_facts({ query, kinds: ["formula", "rule"], audience: "dev" })`
   - รู้ชื่อ slug 2–5 ใบที่ต้องใช้ → เรียก `batch_read({ slugs: [...], audience: "dev", query })` ในรอบเดียว (ห้ามวนเรียก `read_note` ทีละใบ)
2. ต้องการบริบทหลายโน้ต + กราฟ 1 ทอด → เรียก `ask_brain({ question, audience: "dev", compact: true })` (หรือดูแผนที่ Hub เต็มที่ `playbook-dev` เมื่อจำเป็น)
3. ค้นเฉพาะคำหรือดูสารบัญ → `search_brain({ query, limit: 5, audience: "dev" })` / `list_notes({ folder, audience: "dev" })` / `whats_new({ days: 7, audience: "dev" })` (โฟลเดอร์ฝั่ง dev: `dev-playbook`, `schema`, `queries`, `doctypes`, `api`, `architecture`)
4. ไล่สายสัมพันธ์หลายทอด / หาผลกระทบข้ามหน้าจอ-โค้ด-ตาราง → เรียก `traverse_brain({ slug, depth: 2, audience: "dev" })` (หรือ `audience: "all"` เพื่อไล่ไซแนปส์ `bridges_zone` ข้ามจากหน้าจอผู้ใช้ไปยังไฟล์ Go/TS, ผังบัญชี Dr/Cr และตาราง SQL!) หรือหาเส้นทางสั้นสุดด้วย `traverse_brain({ slug, to_slug, audience })` (รองรับ 18 ชนิดความสัมพันธ์)

### โหมดผู้ใช้ทั่วไป / Call Center / ฝ่ายขาย (`audience: "user"`)
1. **ตอบไวสุดใน 1 รอบ (เหมาะกับ Call Center / LINE OA / Voice Bot — ไม่ต้องเสียรอบอ่าน playbook ก่อนทุกครั้ง)**:
   - ลูกค้าอ่านข้อความแจ้งเตือน/Error บนหน้าจอให้ฟัง → เรียก `lookup_error({ query: "ล็อกหน่วยต้นทุนแล้ว", audience: "user" })` ตอบสาเหตุ + วิธีแก้ตรงเป๊ะทันที
   - คำถามวิธีใช้/แก้ปัญหาทั่วไป → เรียก `quick_answer({ question, audience: "user", include_media: true })` จบใน 1 call (~2,000 อักษร + ข้อเท็จจริงสำคัญ + ลิงก์ภาพ/YouTube กระชับ) หรือส่ง `mode: "ultra"` สำหรับ Voice/LINE Bot
   - หารหัสเมนู 4 หลัก (`1001`–`9070` ครบ 735 หน้าจอ) หรือรหัสจุดเดิม (`4.13`) → เรียก `lookup_menu({ query: "4013", audience: "user" })` หรือตรวจรหัสเมนูด้วย `verify_reference({ menus: ["4013"], audience: "user" })`
   - ค้นเจาะแท็บ/หัวข้อย่อย (เช่น ข้อเลือกพิเศษ 9 ส่วน) → `search_sections({ query, audience: "user" })` หรือดึงกฎ/ลิมิตด้วย `get_facts({ query, kinds: ["menu", "limit", "rule"], audience: "user" })`
   - ต้องอ่านหลายโน้ตพร้อมกัน → เรียก `batch_read({ slugs: [...], audience: "user" })` ในรอบเดียว (ใช้ `playbook-call-center` / `playbook-sales` เมื่อต้องดูสคริปต์คัดกรองหรือรายละเอียดขายฉบับเต็ม)
2. ต้องการคำตอบละเอียดหลายโน้ต + รวมสื่อครบ → เรียก `ask_brain({ question, audience: "user", compact: true })` (รวม `## Media & Reference Links` อัตโนมัติ)
3. การดึงลิงก์รูปภาพหน้าจอจริง (`https://bcaccount.com/...`) และคลิปวิดีโอสอน YouTube (`PLO9P7tPZLXB0` พร้อม `thumbnailUrl` / `embedUrl`):
   - `quick_answer({ ..., include_media: true })` แนบลิงก์คลิป/รูปหลัก 1 บรรทัดกระชับ และ `ask_brain({ question, audience: "user" })` รวมส่วน `## Media & Reference Links` ไว้ท้ายคำตอบอัตโนมัติ
   - หากต้องการค้นหาเฉพาะสื่อเพื่อนำไปแสดงการ์ดรูปหรือส่งลิงก์คลิปให้ลูกค้าโดยตรง เรียก `find_media({ query, kind: "all" | "image" | "youtube" | "webpage", limit: 12, audience: "user" })`
4. ทุกครั้งที่เรียกเครื่องมือทั้งหมด (ยกเว้น `read_note`) **ต้องส่ง `audience: "user"` เสมอ**
   - โฟลเดอร์ฝั่ง user: `playbook`, `start`, `howto`, `troubleshoot`, `faq`, `reports`, `systems`, `glossary`, `sales`

---

## 4. กฎเหล็กเมื่อนำความรู้ไปตอบหรือเขียนโค้ด (Guardrails)

### ฝั่ง Dev (`audience: "dev"`)
- **ห้ามใช้ Binary Float กับเงินและจำนวนสินค้า**: ห้ามใช้ `float`, `double`, `parseFloat`, `Number()` กับยอดเงิน ส่วนลด ภาษี อัตราแลกเปลี่ยน และจำนวนสินค้า — ให้ใช้ PostgreSQL `NUMERIC(p, s)`, Go `*math/big.Rat` และ decimal helper ฝั่ง TypeScript ตาม `dev-rules-accounting-sql`
- **ทุกคิวรีเอกสารต้องกรองสถานะและประเภทเอกสาร**: กรองเอกสารยกเลิกด้วย `COALESCE(last_status, 0) = 0` เสมอ และระบุ `trans_flag` ตาม `doc-trans-flag-catalog` (รวมถึงกลับเครื่องหมายใบลดหนี้/รับคืนเมื่อหายอดสุทธิ)
- **ห้ามแก้ตารางบัญชี-สต็อก-การเงินตรงผ่าน `/query/exec`**: ระบบป้องกันด้วย `WritePolicy` — งานอ่านวิเคราะห์ใช้ `/api/v1/mcp` (`bc_query_readonly`) หรือ `/query/list`; งานสร้าง/แก้ไข/ยกเลิกเอกสารต้องผ่าน Process Engine (`/process/*`) เท่านั้น
- **ตรวจชื่อตาราง/คอลัมน์ก่อนตอบ**: ใช้ `verify_reference` หรือเทียบซอร์สโค้ดจริงใน workspace เสมอ ห้ามเดาชื่อคอลัมน์หรือ endpoint นอกเหนือจากที่ตรวจสอบพบ

### ฝั่ง User / Call Center / Sales (`audience: "user"`)
- **ภาษาไทยเข้าใจง่าย ครบทั้งเส้นทางเมนู รหัสเมนู 4 หลัก รูปหน้าจอ และคลิป YouTube**: ตอบเรียงเป็นขั้นตอน ระบุทั้งเส้นทางเมนูเต็มและรหัสเมนู 4 หลักเสมอ (เช่น `"เริ่มต้น > ตั้งค่าองค์กร พนักงาน และเอกสาร > กำหนดรายละเอียดบริษัท" (รหัสเมนู 1003)`), ชื่อปุ่มจริง คีย์ลัด ข้อความแจ้งเตือน และแนบลิงก์ภาพหน้าจอพร้อมเปิดดู (`https://bcaccount.com/...`) คู่กับคลิปสอน YouTube (`PLO9P7tPZLXB0`) จาก `Media & Reference Links` หรือ `find_media` เสมอเมื่อมีสื่อเกี่ยวข้อง ห้ามปนชื่อตาราง SQL ชื่อไฟล์ หรือศัพท์เทคนิค
- **คัดกรองปัญหาหาเมนูไม่เจออย่างเป็นระบบ**: ตรวจสอบทั้ง 4 รุ่นผลิตภัณฑ์ (`Starter`, `Standard`, `Professional`, `Enterprise`), หน้าตั้งค่าเปิด-ปิดฟีเจอร์ตามประเภทธุรกิจ (`รหัสเมนู 1002`), และสิทธิ์กลุ่มผู้ใช้ (`ts-menu-missing-switchboard`)
- **ราคา แพ็กเกจ และเวลาทำการอ้างอิงตามตารางทางการเท่านั้น**: แจ้งราคาตามตาราง Concurrent Users ใน `sales-pricing-packages` (Starter ฟรี 0 บ./ด. ≤100 คน, Standard เริ่ม 199 บ./ด., Professional เริ่ม 499 บ./ด., Enterprise เริ่ม 999 บ./ด. · รายปีจ่าย 10 เดือน ฟรี 2 เดือน · โครงการสำนักงานบัญชี Partner ฟรี 0 บาท ใน `sales-accounting-partner` · **ยังไม่รวม VAT 7% และไม่รวมค่า AI ภายนอก**) และเวลาทำการจันทร์–ศุกร์ 08:30–17:00 น. (โทร `089-922-3131` / LINE `@bcaccount`) ห้ามแต่งส่วนลดพิเศษหรือเงื่อนไขสัญญาเอง ให้ส่งต่อหน้า `https://bcaccount.com/quotation` หรือฝ่ายขาย
- **ไม่ตีความกฎหมายภาษีแทนผู้เชี่ยวชาญ**: คำถามตีความกฎหมายภาษีเฉพาะกรณี ให้อธิบายเฉพาะขั้นตอนการบันทึกในโปรแกรมและบทความอ้างอิง พร้อมแนะนำตรวจยืนยันกับผู้สอบบัญชีหรือกรมสรรพากร

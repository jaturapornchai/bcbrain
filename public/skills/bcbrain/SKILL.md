---
name: bcbrain
description: เชื่อมและค้นสมอง BC (https://brain.bcsmethai.com/mcp) ทั้งโหมดนักพัฒนา (Schema, SQL, trans_flag, Dr/Cr, API/MCP) และโหมดผู้ใช้ทั่วไป/Call Center/ฝ่ายขาย เรียกผ่านคำสั่ง /bcbrain หรืออัตโนมัติเมื่อพัฒนาต่อยอด เขียนคิวรี หรือตอบคำถามระบบ BC Ai Account และชุดโปรแกรม BC
---

# สมอง BC (`/bcbrain`)

Skill สำหรับให้ AI เชื่อมต่อและดึงความรู้จาก **สมอง BC** (`https://brain.bcsmethai.com/mcp`) ซึ่งสกัดจากซอร์สโค้ดจริงของ **BC Ai Account** และระบบในชุด BC รองรับทั้งโซนผู้ใช้ทั่วไป (`user`) และโซนนักพัฒนา (`dev`)

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

1. **ทางหลัก — เรียก MCP Tools ของ server `bcbrain` โดยตรง**
   - Tools ที่มี (6 ตัว): `ask_brain`, `search_brain`, `find_media`, `traverse_brain`, `read_note`, `list_notes` (ในบางเครื่องมืออาจขึ้นชื่อเป็น `mcp_bcbrain_<tool>`, `mcp__bcbrain__<tool>` หรือเรียกผ่าน `call_mcp_tool` ด้วย server `"bcbrain"`)
2. **ทางสำรองทันที — Stateless HTTP JSON-RPC (เมื่อ session ปัจจุบันยังไม่ได้ผูก MCP `bcbrain`)**
   - Endpoint `https://brain.bcsmethai.com/mcp` เป็น Public Read-Only Stateless Streamable HTTP (ไม่ต้องใช้ API key) สามารถเรียกผ่าน Node.js one-liner ได้ทันที:

```bash
# macOS / Linux / Git Bash
node -e 'const [,,name,args]=process.argv; fetch("https://brain.bcsmethai.com/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:JSON.parse(args)}})}).then(r=>r.json()).then(j=>console.log(j.result?.content?.[0]?.text??JSON.stringify(j)))' ask_brain '{"question":"โครงสร้าง ic_trans","audience":"dev"}'
```

```powershell
# Windows PowerShell (ใช้ here-string กัน shell ตัดเครื่องหมายคำพูดใน JSON)
@'
const r = await fetch("https://brain.bcsmethai.com/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ask_brain", arguments: { question: "โครงสร้าง ic_trans", audience: "dev" } } }),
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

## 3. ลำดับการค้นแบบประหยัด Token (Cheap Retrieval Workflow)

### โหมดนักพัฒนา (`audience: "dev"`)
1. เปิดงานครั้งแรก อ่าน `read_note({ slug: "playbook-dev" })` เพื่อดูแผนที่ Hub (`dev-rules-accounting-sql`, `dev-integration-quickstart`, `schema-overview`, `sql-overview`, `doctypes-overview`, `api-overview`, `api-mcp-gateway`, `arch-overview`)
2. โจทย์เป็นคำถามรวม → เรียก `ask_brain({ question, audience: "dev" })` (ได้โน้ตตรงจุดสูงสุด 4 เรื่องในรอบเดียว)
3. รู้ชื่อตารางหรือคำเฉพาะ → เรียก `search_brain({ query, limit: 8, audience: "dev" })` แล้ว `read_note({ slug })` เฉพาะใบที่ใช้จริง หรือดูสารบัญรายหมวดด้วย `list_notes({ folder, audience: "dev" })`
   - โฟลเดอร์ฝั่ง dev: `dev-playbook`, `schema`, `queries`, `doctypes`, `api`, `architecture`
4. ไล่สายสัมพันธ์หลายทอด / หาผลกระทบข้ามหน้าจอ-โค้ด-ตาราง → เรียก `traverse_brain({ slug, depth: 2, audience: "dev" })` (หรือ `audience: "all"` เพื่อไล่ไซแนปส์ `bridges_zone` ข้ามจากหน้าจอผู้ใช้ไปยังไฟล์ Go/TS, ผังบัญชี Dr/Cr และตาราง SQL!) หรือหาเส้นทางสั้นสุดด้วย `traverse_brain({ slug, to_slug, audience })` (รองรับ 18 ชนิดความสัมพันธ์ เช่น `uses_table`, `writes_table`, `posts_rule`, `has_query`, `implements_code`, `bridges_zone`, `shares_menu`, `solves_issue`)

### โหมดผู้ใช้ทั่วไป / Call Center / ฝ่ายขาย (`audience: "user"`)
1. เปิดบทสนทนาครั้งแรก อ่าน `read_note({ slug: "playbook-call-center" })` (วิธีใช้/แก้ปัญหา/ผังคัดกรองอาการด่วน) หรือ `read_note({ slug: "playbook-sales" })` (จุดเด่น/ตารางราคา 4 รุ่น/โครงการสำนักงานบัญชี Partner)
2. ค้นหาชื่อเมนู รหัสเมนู 4 หลัก (`1001`–`9070` ครบ 734 หน้าจอ) หรือรหัสจุดเดิม (`1.3.1`, `4.13`) → เรียก `search_brain` / `ask_brain` ด้วยรหัสเมนูได้โดยตรง หรือดูสารบัญที่ `menu-catalog-overview` (`menu-cat-1-setup` ถึง `menu-cat-9-gl`), คีย์ลัดและเมนูคลิกขวาที่ `howto-screen-shortcuts-workbench`, หน้าจัดการระบบที่ `howto-admin-system-management`, วิดีโอสอน YouTube (`PLO9P7tPZLXB0`) และรูปหน้าจอจริงที่ `video-visual-tutorials`, และแผนผังเว็บ/บทความทั้งหมดที่ `website-manual-and-blog-directory`
3. การดึงลิงก์รูปภาพหน้าจอจริง (`https://bcaccount.com/...`) และคลิปวิดีโอสอน YouTube (`PLO9P7tPZLXB0` พร้อม `thumbnailUrl` / `embedUrl`):
   - `ask_brain({ question, audience: "user" })` จะรวมส่วน `## Media & Reference Links` ไว้ท้ายคำตอบอัตโนมัติ (รวมจากโน้ตที่ค้นเจอและโน้ตในหัวข้อเดียวกันอีก 1 ทอด แม้ถามเรื่องย่อยก็ได้ลิงก์ภาพและคลิปครบ)
   - `search_brain` คืนอาร์เรย์ `images` และ `videos` ในแต่ละผลลัพธ์ JSON และ `read_note` แสดงบรรทัด `youtube_videos:`, `images:`, `web_pages:`
   - หากต้องการค้นหาเฉพาะสื่อเพื่อนำไปแสดงการ์ดรูปหรือส่งลิงก์คลิปให้ลูกค้าโดยตรง เรียก `find_media({ query, kind: "all" | "image" | "youtube" | "webpage", limit: 12, audience: "user" })`
4. ทุกครั้งที่เรียก `ask_brain`, `search_brain`, `find_media`, `traverse_brain`, `list_notes` **ต้องส่ง `audience: "user"` เสมอ**
   - โฟลเดอร์ฝั่ง user: `playbook`, `start`, `howto`, `troubleshoot`, `faq`, `reports`, `systems`, `glossary`, `sales`

---

## 4. กฎเหล็กเมื่อนำความรู้ไปตอบหรือเขียนโค้ด (Guardrails)

### ฝั่ง Dev (`audience: "dev"`)
- **ห้ามใช้ Binary Float กับเงินและจำนวนสินค้า**: ห้ามใช้ `float`, `double`, `parseFloat`, `Number()` กับยอดเงิน ส่วนลด ภาษี อัตราแลกเปลี่ยน และจำนวนสินค้า — ให้ใช้ PostgreSQL `NUMERIC(p, s)`, Go `*math/big.Rat` และ decimal helper ฝั่ง TypeScript ตาม `dev-rules-accounting-sql`
- **ทุกคิวรีเอกสารต้องกรองสถานะและประเภทเอกสาร**: กรองเอกสารยกเลิกด้วย `COALESCE(last_status, 0) = 0` เสมอ และระบุ `trans_flag` ตาม `doc-trans-flag-catalog` (รวมถึงกลับเครื่องหมายใบลดหนี้/รับคืนเมื่อหายอดสุทธิ)
- **ห้ามแก้ตารางบัญชี-สต็อก-การเงินตรงผ่าน `/query/exec`**: ระบบป้องกันด้วย `WritePolicy` — งานอ่านวิเคราะห์ใช้ `/api/v1/mcp` (`bc_query_readonly`) หรือ `/query/list`; งานสร้าง/แก้ไข/ยกเลิกเอกสารต้องผ่าน Process Engine (`/process/*`) เท่านั้น
- **ยึดซอร์สโค้ดจริงเมื่ออยู่หน้าโค้ด**: หากเปิด workspace ซอร์สโค้ด `BC Ai Account` ควบคู่กันอยู่ ให้ตรวจเทียบกับไฟล์จริงใน workspace และห้ามเดาชื่อคอลัมน์หรือ endpoint นอกเหนือจากที่ตรวจสอบพบ

### ฝั่ง User / Call Center / Sales (`audience: "user"`)
- **ภาษาไทยเข้าใจง่าย ครบทั้งเส้นทางเมนู รหัสเมนู 4 หลัก รูปหน้าจอ และคลิป YouTube**: ตอบเรียงเป็นขั้นตอน ระบุทั้งเส้นทางเมนูเต็มและรหัสเมนู 4 หลักเสมอ (เช่น `"เริ่มต้น > ตั้งค่าองค์กร พนักงาน และเอกสาร > กำหนดรายละเอียดบริษัท" (รหัสเมนู 1003)`), ชื่อปุ่มจริง คีย์ลัด ข้อความแจ้งเตือน และแนบลิงก์ภาพหน้าจอพร้อมเปิดดู (`https://bcaccount.com/...`) คู่กับคลิปสอน YouTube (`PLO9P7tPZLXB0`) จาก `Media & Reference Links` หรือ `find_media` เสมอเมื่อมีสื่อเกี่ยวข้อง ห้ามปนชื่อตาราง SQL ชื่อไฟล์ หรือศัพท์เทคนิค
- **คัดกรองปัญหาหาเมนูไม่เจออย่างเป็นระบบ**: ตรวจสอบทั้ง 4 รุ่นผลิตภัณฑ์ (`Starter`, `Standard`, `Professional`, `Enterprise`), หน้าตั้งค่าเปิด-ปิดฟีเจอร์ตามประเภทธุรกิจ (`รหัสเมนู 1002`), และสิทธิ์กลุ่มผู้ใช้ (`ts-menu-missing-switchboard`)
- **ราคา แพ็กเกจ และเวลาทำการอ้างอิงตามตารางทางการเท่านั้น**: แจ้งราคาตามตาราง Concurrent Users ใน `sales-pricing-packages` (Starter ฟรี 0 บ./ด. ≤100 คน, Standard เริ่ม 199 บ./ด., Professional เริ่ม 499 บ./ด., Enterprise เริ่ม 999 บ./ด. · รายปีจ่าย 10 เดือน ฟรี 2 เดือน · โครงการสำนักงานบัญชี Partner ฟรี 0 บาท ใน `sales-accounting-partner` · **ยังไม่รวม VAT 7% และไม่รวมค่า AI ภายนอก**) และเวลาทำการจันทร์–ศุกร์ 08:30–17:00 น. (โทร `089-922-3131` / LINE `@bcaccount`) ห้ามแต่งส่วนลดพิเศษหรือเงื่อนไขสัญญาเอง ให้ส่งต่อหน้า `https://bcaccount.com/quotation` หรือฝ่ายขาย
- **ไม่ตีความกฎหมายภาษีแทนผู้เชี่ยวชาญ**: คำถามตีความกฎหมายภาษีเฉพาะกรณี ให้อธิบายเฉพาะขั้นตอนการบันทึกในโปรแกรมและบทความอ้างอิง พร้อมแนะนำตรวจยืนยันกับผู้สอบบัญชีหรือกรมสรรพากร

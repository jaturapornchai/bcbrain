# สมอง BC (BC Brain)

## Objective
คลังความรู้ระบบ **BC Ai Account** และระบบในชุด BC สกัดจากซอร์สโค้ดจริงใน `d:\bcaiaccount` (อ่านอย่างเดียว) รองรับทั้ง 2 กลุ่มเป้าหมายในระบบเดียว:
1. **โซนผู้ใช้ทั่วไป (`audience: "user"`)**: คู่มือภาษาไทยที่คนทั่วไปอ่านเข้าใจ (`playbook`, `start`, `howto`, `troubleshoot`, `faq`, `reports`, `systems`, `glossary`, `sales`) สำหรับเจ้าของกิจการ พนักงานบัญชี Call Center และฝ่ายขาย (ไม่มีศัพท์โค้ดปน)
2. **โซนนักพัฒนา (`audience: "dev"`)**: เอกสารเทคนิคสำหรับนักพัฒนาและ AI เขียนโค้ดต่อยอด (`dev-playbook`, `schema`, `queries`, `api`, `doctypes`, `architecture`) ครอบคลุม Data Dictionary, คำสั่ง PostgreSQL `SELECT`/`WITH`, รหัส `trans_flag`, ผังบัญชี Dr/Cr, API/MCP Contract และสถาปัตยกรรมระบบ

เปิดสาธารณะ 3 ทาง: หน้าแรกเป็นสมอง 3 มิติพร้อมตัวสลับโหมด (`ทั้งหมด` · `ผู้ใช้ทั่วไป` · `นักพัฒนา (Dev)`), หน้าคลังโน้ต `/n` (รองรับ `?mode=all|user|dev` และ `?q=...`), และ MCP server `/mcp` (รองรับพารามิเตอร์ `audience`)

## Workflow
1. สกัดความรู้จาก `d:\bcaiaccount` → เขียนโน้ตลง `vault/<โฟลเดอร์>/<slug>.md` ตามกติกาใน `docs/extract-brief.md` (frontmatter `title`, `tags`, `aliases`, `sources` — `sources` เก็บ `path:line` เพื่อตรวจภายใน ไม่แสดงบนหน้าเว็บและ MCP)
   แล้วรัน `npm run check` เพื่อตรวจ frontmatter, slug ซ้ำข้ามโฟลเดอร์, `sources` ที่มีจริง, ลิงก์เสีย (`[[wikilink]]` ทุกตัวต้องมีปลายทาง), ศัพท์โค้ดหลุดในโซนผู้ใช้ทั่วไป (ยกเว้น `playbook/` และโฟลเดอร์ฝั่ง dev), และตัวกรองความปลอดภัย `FORBIDDEN_SECURITY` ทุกโฟลเดอร์
2. `npm run build` → `prebuild` รัน `scripts/scan-secrets.mjs` สแกนคีย์/โทเค็น/รหัสผ่าน/hash (`bcrypt`, `argon2`)/อีเมล/IP สาธารณะ หากพบ build จะหยุดทันที (พิมพ์เฉพาะ `ไฟล์:บรรทัด`)
3. `bash deploy/deploy.sh` → build + แพ็ก standalone + `vault` → อัปโหลดไป `/opt/bcbrain` (สำรองรุ่นก่อนที่ `/opt/bcbrain.prev`) → restart `bcbrain.service`
4. Caddy (`brain.bcsmethai.com` → `127.0.0.1:3951`) ให้บริการ HTTPS สาธารณะ

โครงสร้างโค้ดหลัก:
- `lib/groups.ts` — นิยาม 16 โฟลเดอร์ (`root` = `both`, 9 โฟลเดอร์โซน `user`, 6 โฟลเดอร์โซน `dev`), สี, ชื่อภาษาไทย, `groupOf()`, `matchesAudience()`, `RelationType`, `RELATION_LABEL`, `inferRelation()`
- `lib/vault.ts` — Lean In-Memory GraphRAG: โหลด `vault/`, คำนวณ typed edges + implicit SQL table synapses, อินเด็กซ์กลับด้าน (`Int32Array`/`Float32Array` postings), ตัดคำไทยด้วย `Intl.Segmenter` + คำพ้องไทย-SQL + BM25 + 1-hop graph boost, พิกัดสมอง 3D (`computeBrainLayout()`), แคชระดับ `VaultBundle`, `traverseGraph()` (multi-hop 1–3 ทอด & shortest path) และเรนเดอร์ Markdown แบบกัน XSS
- `app/mcp/route.ts` — Stateless Streamable HTTP MCP 5 tools (`ask_brain`, `search_brain`, `traverse_brain`, `read_note`, `list_notes`) พร้อมตัวกรอง `audience: "all" | "user" | "dev"` และ Connected Graph Context 1 ทอด
- `components/Brain3D.tsx`, `components/Shell.tsx`, `app/page.tsx`, `app/n/page.tsx`, `app/n/[slug]/page.tsx` — หน้าเว็บและตัวสลับโหมด 3 ปุ่ม
- `.agents/skills/bcbrain/SKILL.md`, `public/skills/bcbrain/SKILL.md` — Skill `/bcbrain` สำหรับเชื่อมและเรียกใช้สมอง BC ผ่าน MCP (หรือ HTTP JSON-RPC fallback) พร้อมเผยแพร่ให้ดาวน์โหลดที่ `/skills/bcbrain/SKILL.md`

## Config
| ค่า | ที่ไหน | ความหมาย |
|---|---|---|
| `PORT=3951`, `HOSTNAME=127.0.0.1` | `deploy/bcbrain.service` | ฟังเฉพาะ localhost ให้ Caddy proxy |
| `BC_DEPLOY_HOST` (env), `APP` | `deploy/deploy.sh` | เซิร์ฟเวอร์ปลายทางและโฟลเดอร์ติดตั้ง |
| โฟลเดอร์, สี, โซน `audience` | `lib/groups.ts` | แมป 16 โฟลเดอร์ (`root`, 9 user, 6 dev) → ชื่อไทย, สีเซลล์, `audience` |
| กติกา AI สองโหมด | `app/mcp/route.ts` (`INSTRUCTIONS`), `vault/playbook/`, `vault/dev-playbook/` | แยกโหมด Dev (`playbook-dev`, `audience: "dev"`) และโหมด User/Sales (`playbook-call-center` / `playbook-sales`, `audience: "user"`) |
| ยกเว้นบรรทัดที่ไม่ใช่ความลับ | ใส่ `secret-scan:allow` ในบรรทัดนั้น | ข้ามตัวสแกนความลับ (ใช้เฉพาะบรรทัดที่ตรวจแล้ว) |

ไม่มี env ลับ ไม่มี API key ทั้งหน้าเว็บและ MCP เป็นระบบสาธารณะแบบอ่านอย่างเดียว

## Dependency
Node 24+, Next.js 16 (standalone), React 19, three 0.187, `@modelcontextprotocol/sdk` 1.32, marked 18, yaml, zod 4 · เซิร์ฟเวอร์: systemd + Caddy

## Usage example
```bash
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit       # ตรวจ TypeScript
npm test               # selftest: groups, isolation, ตัดคำไทย, BM25, กัน XSS, ตัวสแกนความลับ
npm run test:deep      # deep-test: 6 มิติ (ตัดคำ 25+, ค้นหา 79 เคส, แยกโซน 313 โน้ต, กราฟ 3D/XSS, fuzz, throughput)
npm run check          # ตรวจโน้ตใน vault (ส่ง path ของ bcaiaccount เพื่อตรวจ sources)
npm run scan           # สแกนความลับใน vault อย่างเดียว
node scripts/mcp-eval.mjs http://localhost:3000/mcp   # ประเมิน MCP ทั้งโหมด user และ dev
BC_DEPLOY_HOST=root@<server> bash deploy/deploy.sh    # deploy ขึ้น brain.bcsmethai.com
```

เชื่อม AI ผ่าน MCP:
```bash
claude mcp add --transport http bcbrain https://brain.bcsmethai.com/mcp
```
Tools:
- `ask_brain(question, audience?)` — `audience`: `"all" | "user" | "dev"` (แนบ Connected Graph Context 1 ทอดท้ายคำตอบ)
- `search_brain(query, limit?, audience?)` — BM25 + คำพ้องไทย-SQL + 1-hop graph boost
- `traverse_brain(slug, to_slug?, depth?, direction?, relation?, folder?, limit?, audience?)` — เดินกราฟ 1–3 ทอดหรือหาเส้นทางสั้นสุด
- `read_note(slug)`
- `list_notes(folder?, tag?, audience?)`

ติดตั้งและใช้งาน Skill `/bcbrain`:
```bash
mkdir -p ~/.claude/skills/bcbrain && curl -fsSL https://brain.bcsmethai.com/skills/bcbrain/SKILL.md -o ~/.claude/skills/bcbrain/SKILL.md
```
- `/bcbrain <คำถามใช้งาน>` — โหมดผู้ใช้ทั่วไป / Call Center / ฝ่ายขาย (`audience: "user"`)
- `/bcbrain dev <โจทย์ SQL/Schema/API>` — โหมดนักพัฒนา (`audience: "dev"`)
- `/bcbrain setup` — แสดงวิธีผูก MCP `https://brain.bcsmethai.com/mcp` ตามเครื่องมือที่ใช้

## Limitation
- ค้นหาแบบ keyword + BM25 length normalization (ตัดคำไทย + ให้คะแนน title/alias/table-name/body) ไม่ใช่ vector embedding — หากคลังเกิน ~1,500 โน้ตควรพิจารณา hybrid/embedding เพิ่มเติม
- โน้ตเป็นภาพถ่ายโค้ด ณ วันที่สกัด หากขัดกับโค้ดปัจจุบันใน `d:\bcaiaccount` ให้ยึดโค้ดจริงเป็นหลัก
- ขอบเขตจำกัดเฉพาะระบบใน `d:\bcaiaccount` เท่านั้น ไม่อ้างอิงระบบภายนอก
- MCP เปิดสาธารณะแบบอ่านอย่างเดียว จำกัดขนาดคำขอ 32 KB และจำกัดอัตราเรียก 180 ครั้ง/นาทีต่อ IP พร้อมรองรับ CORS
- โซนผู้ใช้ทั่วไปไม่มีราคา แพ็กเกจ หรือเงื่อนไขสัญญา AI ถูกสั่งให้ส่งต่อฝ่ายขายที่เป็นคน
- ชื่อไฟล์ (slug) ต้องเป็น ascii kebab-case ตัวเล็กและไม่ซ้ำกันทั้ง `vault/`

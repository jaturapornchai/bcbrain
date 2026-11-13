# สมอง BC (BC Brain)

## Objective
คลังความรู้ระบบ **BC Ai Account** และระบบในชุด BC สกัดจากซอร์สโค้ดจริงใน `d:\bcaiaccount` (อ่านอย่างเดียว) รวม **313 โน้ต ใน 16 โฟลเดอร์** รองรับ 2 กลุ่มเป้าหมายในระบบเดียว:
1. **โซนผู้ใช้ทั่วไป (`audience: "user"` — 9 โฟลเดอร์, 183 โน้ต)**: คู่มือภาษาไทยที่คนทั่วไปอ่านเข้าใจ (`playbook`, `start`, `howto`, `troubleshoot`, `faq`, `reports`, `systems`, `glossary`, `sales`) สำหรับเจ้าของกิจการ พนักงานบัญชี Call Center และฝ่ายขาย (ไม่มีศัพท์โค้ดปน)
2. **โซนนักพัฒนา (`audience: "dev"` — 6 โฟลเดอร์, 129 โน้ต)**: เอกสารเทคนิคสำหรับนักพัฒนาและ AI เขียนโค้ดต่อยอด (`dev-playbook`, `schema`, `queries`, `api`, `doctypes`, `architecture`) ครอบคลุม Data Dictionary, คำสั่ง PostgreSQL `SELECT`/`WITH`, รหัส `trans_flag`, ผังบัญชี Dr/Cr, API/MCP Contract และสถาปัตยกรรมระบบ (พร้อมหน้าดัชนีกลาง `root` `index` = `both` อีก 1 โน้ต)

เปิดสาธารณะ 3 ช่องทางพร้อมรองรับ Google SEO & AI Search (GEO/AEO):
- **หน้าแรก (`/`)**: สมอง 3 มิติพร้อมตัวสลับโหมด (`ทั้งหมด` · `ผู้ใช้ทั่วไป` · `นักพัฒนา (Dev)`)
- **หน้าคลังโน้ต (`/n`, `/n/[slug]`)**: ค้นหาและอ่านรายโน้ต รองรับ `?mode=all|user|dev` และ `?q=...` พร้อม JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`, `CollectionPage`, `BreadcrumbList`, `TechArticle`), OpenGraph/Twitter Card (`/icon.png`, `/opengraph-image.png`), `/robots.txt`, `/sitemap.xml` และ `/llms.txt`
- **MCP Server (`/mcp`)**: Streamable HTTP MCP รองรับตัวกรอง `audience` และ CORS สำหรับเชื่อม AI ทุกค่าย

## Workflow
1. สกัดความรู้จาก `d:\bcaiaccount` → เขียนโน้ตลง `vault/<โฟลเดอร์>/<slug>.md` ตามกติกาใน `docs/extract-brief.md` (frontmatter `title`, `tags`, `aliases`, `sources` — `sources` เก็บ `path:start-end` เพื่อตรวจภายใน ไม่แสดงบนหน้าเว็บและ MCP)
   - รัน `node scripts/check-notes.mjs D:/bcaiaccount --strict` เพื่อตรวจ frontmatter, slug ซ้ำข้ามโฟลเดอร์, `sources` ที่มีอยู่จริงพร้อมตรวจช่วงบรรทัดต้น-จบเทียบ EOF, ลิงก์เสีย (`[[wikilink]]` และ `[[relation::slug]]`), ศัพท์โค้ดหลุดในโซนผู้ใช้ทั่วไป และตัวกรองความปลอดภัย `FORBIDDEN_SECURITY` ทุกโฟลเดอร์
   - รัน `npm run check:drift` เพื่อตรวจสอบว่าไฟล์ต้นทางใน `D:/bcaiaccount` มีการแก้ไขใหม่กว่าวันที่อัปเดตโน้ตหรือไม่
2. `npm run build` → `prebuild` รัน `scripts/scan-secrets.mjs` สแกนคีย์/โทเค็น/รหัสผ่าน/hash (`bcrypt`, `argon2`)/อีเมล/IP สาธารณะใน `vault/` และโฟลเดอร์ skill หากพบ build จะหยุดทันที (พิมพ์เฉพาะ `ไฟล์:บรรทัด`)
3. `bash deploy/deploy.sh` → build + แพ็ก standalone + `public` + `vault` → อัปโหลดไป `/opt/bcbrain` (สำรองรุ่นก่อนที่ `/opt/bcbrain.prev`) → restart `bcbrain.service`
4. Caddy (`brain.bcsmethai.com` → `127.0.0.1:3951`) ให้บริการ HTTPS สาธารณะ

โครงสร้างโค้ดหลัก:
- `lib/groups.ts` — นิยาม 16 โฟลเดอร์ (`root` = `both`, 9 โฟลเดอร์โซน `user`, 6 โฟลเดอร์โซน `dev`), สี, ชื่อภาษาไทย, `groupOf()`, `matchesAudience()`, `RelationType`, `RELATION_LABEL`, `inferRelation()`
- `lib/vault.ts` — Lean In-Memory GraphRAG: โหลด `vault/` แบบ atomic `VaultBundle`, คำนวณ typed edges + implicit SQL table synapses, อินเด็กซ์กลับด้าน (`Int32Array`/`Float32Array` postings), ปรับรูปคำไทย/ภาษี (`ภ.ง.ด.`, `ภ.พ.`, `สต็อก` ฯลฯ) + ตัดคำไทยด้วย `Intl.Segmenter` + คำพ้องไทย-SQL + BM25 + hub/canonical boost + 1-hop graph boost, พิกัดสมอง 3D ล่วงหน้าบนเซิร์ฟเวอร์ (`computeBrainLayout()`), แคชผลค้นหาและ HTML ที่เรนเดอร์แล้ว (กัน XSS), และ `traverseGraph()` (multi-hop 1–3 ทอด & shortest path)
- `app/mcp/route.ts` — Stateless Streamable HTTP MCP 5 tools (`ask_brain`, `search_brain`, `traverse_brain`, `read_note`, `list_notes`) พร้อมตัวกรอง `audience: "all" | "user" | "dev"`, Connected Graph Context 1 ทอด, CORS (`OPTIONS`), จำกัดขนาดคำขอ 32 KB (`413`) และจำกัดอัตราเรียก 180 ครั้ง/นาทีต่อ IP (`429`)
- `components/Brain3D.tsx`, `components/Shell.tsx`, `app/page.tsx`, `app/n/page.tsx`, `app/n/[slug]/page.tsx` — หน้าเว็บสมอง 3 มิติ (ใช้พิกัดที่คำนวณจากเซิร์ฟเวอร์ทันที) และหน้าคลังโน้ตพร้อมตัวสลับโหมด 3 ปุ่ม
- `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `public/llms.txt`, `app/icon.png`, `app/opengraph-image.png`, `next.config.ts` — โครงสร้าง Metadata, OpenGraph/Twitter Image, Sitemap/Robots/LLMs index และ HTTP Security & `Cache-Control` headers
- `.agents/skills/bcbrain/SKILL.md`, `public/skills/bcbrain/SKILL.md` — Skill `/bcbrain` สำหรับเชื่อมและเรียกใช้สมอง BC ผ่าน MCP (หรือ HTTP JSON-RPC fallback) ดาวน์โหลดได้ที่ `/skills/bcbrain/SKILL.md`

## Config
| ค่า | ที่ไหน | ความหมาย |
|---|---|---|
| `PORT=3951`, `HOSTNAME=127.0.0.1` | `deploy/bcbrain.service` | ฟังเฉพาะ localhost ให้ Caddy ทำ reverse proxy |
| `BC_DEPLOY_HOST` (env), `APP` | `deploy/deploy.sh` | เซิร์ฟเวอร์ปลายทางและโฟลเดอร์ติดตั้ง (`/opt/bcbrain`) |
| `MAX_BODY_BYTES = 32768`, `RATE_LIMIT_MAX = 180` | `app/mcp/route.ts` | จำกัดขนาดคำขอ `/mcp` ไม่เกิน 32 KB และไม่เกิน 180 ครั้ง/นาทีต่อ IP พร้อม CORS |
| `DEV_TTL_MS = 5000` | `lib/vault.ts` | อายุแคช `VaultBundle` ในโหมด `dev` (ใน `production` แคชในหน่วยความจำตลอดอายุโปรเซส) |
| `Cache-Control` headers | `next.config.ts`, `app/mcp/route.ts` | `/llms.txt`, `/skills/*` (`max-age=300`), `/n`, `/n/*` (`max-age=60`), `/mcp` (`no-store`) |
| โฟลเดอร์, สี, โซน `audience` | `lib/groups.ts` | แมป 16 โฟลเดอร์ (`root`, 9 user, 6 dev) → ชื่อไทย, สีเซลล์, `audience` |
| กติกา AI สองโหมด | `app/mcp/route.ts` (`INSTRUCTIONS`), `vault/playbook/`, `vault/dev-playbook/` | แยกโหมด Dev (`playbook-dev`, `audience: "dev"`) และโหมด User/Sales (`playbook-call-center` / `playbook-sales`, `audience: "user"`) |
| ยกเว้นบรรทัดที่ไม่ใช่ความลับ | ใส่ `secret-scan:allow` ในบรรทัดนั้น | ข้าม `scripts/scan-secrets.mjs` เฉพาะบรรทัดที่ตรวจยืนยันแล้ว |

ไม่มี env ลับ ไม่มี API key ทั้งหน้าเว็บและ MCP เป็นระบบสาธารณะแบบอ่านอย่างเดียว

## Dependency
Node 24+ (`"type": "module"`, รัน `.ts` โดยตรงในเทสต์), Next.js 16.4 (standalone), React 19.3, three 0.187, `@modelcontextprotocol/sdk` 1.32, marked 18.1, yaml 2.9, zod 4.6, TypeScript 7 · เซิร์ฟเวอร์: systemd + Caddy

## Usage example
```bash
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit       # ตรวจ TypeScript
npm test               # selftest: groups, isolation, ตัดคำไทย, BM25, กัน XSS, ตัวสแกนความลับ
npm run test:deep      # deep-test: 6 มิติ (ตัดคำ/คำพ้อง 25 ข้อ, ค้นหา 80 เคส, แยกโซน 313 โน้ต, กราฟ 3D/XSS/PNG, fuzz, throughput)
npm run check          # ตรวจโน้ตใน vault (ส่ง path ของ bcaiaccount และ --strict เพื่อตรวจเข้มงวด)
npm run check:drift    # ตรวจโน้ตแบบ --strict พร้อมรายงานโน้ตที่ไฟล์โค้ดใน D:/bcaiaccount แก้ใหม่กว่าโน้ต (--fail-on-drift เพื่อบังคับ exit 1)
npm run scan           # สแกนความลับใน vault และไฟล์ skill
node scripts/mcp-eval.mjs http://localhost:3000/mcp         # ประเมิน MCP 31 เคส (ทั้งโหมด user และ dev) บนเครื่อง
node scripts/mcp-eval.mjs https://brain.bcsmethai.com/mcp   # ประเมิน MCP 31 เคส บน Production จริง
BC_DEPLOY_HOST=root@<server> bash deploy/deploy.sh          # deploy ขึ้น brain.bcsmethai.com
```

เชื่อม AI ผ่าน MCP:
```bash
claude mcp add --transport http bcbrain https://brain.bcsmethai.com/mcp
```
Tools:
- `ask_brain(question, audience?)` — `audience`: `"all" | "user" | "dev"` (แนบกติกาตามโซน + เนื้อหาโน้ตหลัก + Connected Graph Context 1 ทอดท้ายคำตอบ)
- `search_brain(query, limit?, audience?)` — อินเด็กซ์กลับด้าน + BM25 + คำพ้องไทย-SQL + 1-hop graph boost
- `traverse_brain(slug, to_slug?, depth?, direction?, relation?, folder?, limit?, audience?)` — เดินกราฟ 1–3 ทอดหรือหาเส้นทางสั้นสุดระหว่าง 2 โน้ต
- `read_note(slug)` — อ่านโน้ตเต็มตาม `slug`
- `list_notes(folder?, tag?, audience?)` — แสดงรายชื่อโน้ตกรองตามโฟลเดอร์ แท็ก หรือ `audience`

ติดตั้งและใช้งาน Skill `/bcbrain`:
```bash
mkdir -p ~/.claude/skills/bcbrain && curl -fsSL https://brain.bcsmethai.com/skills/bcbrain/SKILL.md -o ~/.claude/skills/bcbrain/SKILL.md
```
- `/bcbrain <คำถามใช้งาน>` — โหมดผู้ใช้ทั่วไป / Call Center / ฝ่ายขาย (`audience: "user"`)
- `/bcbrain dev <โจทย์ SQL/Schema/API>` — โหมดนักพัฒนา (`audience: "dev"`)
- `/bcbrain setup` — แสดงวิธีผูก MCP `https://brain.bcsmethai.com/mcp` ตามเครื่องมือที่ใช้

## Limitation
- ค้นหาแบบอินเด็กซ์กลับด้าน + BM25 length normalization + คำพ้องไทย-SQL + 1-hop graph boost (ไม่ใช่ vector embedding) — หากคลังเกิน ~1,500 โน้ตควรพิจารณา hybrid/embedding เพิ่มเติม
- โน้ตเป็นภาพถ่ายโค้ด ณ วันที่สกัด หากโค้ดใน `d:\bcaiaccount` เดินหน้าไปแล้วให้รัน `npm run check:drift` เพื่อตรวจจุดที่ต้องอัปเดตโน้ตตาม และยึดโค้ดจริงเป็นหลักเสมอ
- ขอบเขตจำกัดเฉพาะระบบใน `d:\bcaiaccount` เท่านั้น ไม่อ้างอิงระบบภายนอก
- MCP เปิดสาธารณะแบบอ่านอย่างเดียว จำกัดขนาดคำขอ 32 KB และจำกัดอัตราเรียก 180 ครั้ง/นาทีต่อ IP ในหน่วยความจำของโปรเซส พร้อมรองรับ CORS
- โซนผู้ใช้ทั่วไปไม่มีราคา แพ็กเกจ หรือเงื่อนไขสัญญา AI ถูกสั่งให้ส่งต่อฝ่ายขายที่เป็นคน
- ชื่อไฟล์ (`slug`) ต้องเป็น ascii kebab-case ตัวเล็กและไม่ซ้ำกันทั้ง `vault/`

# สมอง BC (BC Brain)

## Objective
คลังความรู้ของระบบ **BC Ai Account** (`d:\bcaiaccount`, อ่านอย่างเดียว) ในรูปโน้ต markdown แบบ Obsidian
เปิดสาธารณะ 3 ทาง: หน้าแรกเป็นสมอง 3 มิติ (Three.js), หน้าอ่านโน้ต `/n`, และ MCP server `/mcp` ให้ AI ตัวอื่นถาม-ตอบ

## Workflow
1. สกัดความรู้จากโค้ด → เขียนโน้ตลง `vault/<กลุ่ม>/<slug>.md` (frontmatter `title/tags/aliases/sources` + `## ที่มาในโค้ด` อ้าง `path:line`)
2. `npm run build` → `prebuild` รัน `scripts/scan-secrets.mjs` ถ้าโน้ตไหนมี key/token/รหัสผ่าน/อีเมล/IP สาธารณะ build จะหยุดทันที (พิมพ์แค่ไฟล์:บรรทัด ไม่พิมพ์ค่า)
3. `bash deploy/deploy.sh` → build + แพ็ก standalone + vault → scp → `/opt/bcbrain` (เก็บรุ่นก่อนไว้ที่ `/opt/bcbrain.prev`) → restart `bcbrain.service`
4. Caddy (`brain.bcsmethai.com` → `127.0.0.1:3951`) ออก HTTPS ให้อัตโนมัติ

โครงโค้ด: `lib/vault.ts` (โหลดโน้ต, wikilink/backlink, ค้นไทยด้วย `Intl.Segmenter`, render markdown แบบปลอดภัย) · `app/mcp/route.ts` (MCP 4 tools) · `components/Brain3D.tsx` (สมอง 3D) · `lib/groups.ts` (ชื่อกลุ่ม + สี)

## Config
| ค่า | ที่ไหน | ความหมาย |
|---|---|---|
| `PORT=3951`, `HOSTNAME=127.0.0.1` | `deploy/bcbrain.service` | ฟังเฉพาะ localhost ให้ Caddy proxy |
| `BC_DEPLOY_HOST` (env), `APP` | `deploy/deploy.sh` | เซิร์ฟเวอร์ปลายทาง (SSH key) และโฟลเดอร์ติดตั้ง |
| กลุ่ม/สีโน้ต | `lib/groups.ts` | ชื่อโฟลเดอร์ใน `vault/` → ชื่อไทย + สีเซลล์ |
| บรรทัดที่ยืนยันแล้วว่าไม่ใช่ความลับ | ใส่ `secret-scan:allow` ในบรรทัดนั้น | ข้ามตัวสแกน (ใช้เมื่อตรวจแล้วเท่านั้น) |

ไม่มี env ลับ ไม่มี API key ทั้งเว็บและ MCP เป็น public อ่านอย่างเดียว

## Dependency
Node 24+, Next.js 16 (standalone), React 19, three 0.187, `@modelcontextprotocol/sdk` 1.32, marked 18, yaml, zod 4 · เซิร์ฟเวอร์: systemd + Caddy

## Usage example
```bash
npm install
npm run dev            # http://localhost:3000
npm test               # selftest: ตัดคำไทย, ค้นหา, กัน XSS, ตัวสแกนความลับ
npm run scan           # สแกนความลับใน vault อย่างเดียว
BC_DEPLOY_HOST=root@<server> bash deploy/deploy.sh  # deploy ขึ้น brain.bcsmethai.com
```
เชื่อม AI:
```bash
claude mcp add --transport http bcbrain https://brain.bcsmethai.com/mcp
```
Tools: `ask_brain(question)` · `search_brain(query, limit?)` · `read_note(slug)` · `list_notes(folder?, tag?)`

## Limitation
- ค้นหาแบบ keyword (ตัดคำไทย + ให้คะแนน title/alias/tag/body) ไม่ใช่ embedding — ถ้าโน้ตเกิน ~1000 ค่อยเปลี่ยน
- โน้ตเป็นภาพถ่ายโค้ด ณ วันที่สกัด ถ้าขัดกับโค้ดปัจจุบันให้เชื่อโค้ด; อัปเดตต้องสกัดใหม่แล้ว deploy
- ขอบเขตเฉพาะ `backend/`, `frontend/account/`, `docs/kms/`, `.agents/skills/` ระบบอื่น (pos, wms, tms, crm ฯลฯ) ยังไม่รวม
- MCP เปิดสาธารณะ ไม่มี rate limit ในแอป
- slug ต้องไม่ซ้ำทั้ง vault (ชื่อไฟล์ซ้ำคนละโฟลเดอร์ ตัวหลังจะถูกข้าม)
- โน้ตย้ายมาจาก SML (rebrand `SML→BC` แบบเดียวกับ `d:\bcaiaccount`): `sources` แบบ `git:<sha>` 171 จุดเป็น commit ของประวัติ SML เดิม ไม่มีใน repo BC (ประวัติเริ่มใหม่) · โน้ตเรื่องถอดจอจาก C# (`D:\bc\BCCM`) ยังเล่าตามกฎเดิม ส่วน `AGENTS.md` ของ BC เปลี่ยนเป็นไล่จาก `frontend/account/screenRegistry.tsx` แล้ว

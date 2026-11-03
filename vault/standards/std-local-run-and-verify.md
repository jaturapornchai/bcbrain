---
title: "รันระบบในเครื่องและตรวจงาน: พอร์ต ตัวแปร env โหมดสาธิต"
tags: [standards, local-run, dev-environment, bcdemo, frontend, backend]
aliases: ["รัน local", "bcaiaccount-local", "FORCE_BCDEMO", "SERVICE_BASE_URL", "x-no-demo-fallback", "พอร์ต 3001 18090 3050", "launch.json"]
sources: ["AGENTS.md:46", "AGENTS.md:47", "AGENTS.md:48", ".claude/launch.json:15-27", "frontend/src/lib/session.ts:87-101", "frontend/src/lib/session-name.ts:12-16", "frontend/src/lib/api-server.ts:17-23", "backend/internal/platform/config/config.go:19", "uat/openhands-swarm/runner/run.mjs:3"]
---

# รันระบบในเครื่องและตรวจงาน

สรุปว่าเปิดระบบ BC Ai Account ในเครื่องด้วยพอร์ตอะไร ตัวแปร env ตัวไหนมีผล และข้อห้ามเรื่องข้อมูลตอนทดสอบ ตรวจกับโค้ดและ `.claude/launch.json` 2026-11-03

## พอร์ตและฐานข้อมูลที่กฎเหล็กกำหนด (`AGENTS.md:46-47`)
| ส่วน | ที่อยู่ |
|---|---|
| Backend (Go) | `http://127.0.0.1:18090` (หรือ `:8081`) |
| Frontend (Next.js) | `http://localhost:3001` |
| PostgreSQL | `127.0.0.1:5432/bcdemo` |
| BC Ai Tester | `http://localhost:3050` |
- ห้าม deploy ไป Production จนกว่าลุงจืดสั่ง (`AGENTS.md:46`)
- ค่าเริ่มต้นของ backend ในโค้ดคือพอร์ต `8080` (`config.go:19`, env `HTTP_PORT`) ส่วน `18090` ที่กฎเหล็กใช้ต้องตั้ง `HTTP_PORT` เอง จึงอย่าเชื่อพอร์ตเริ่มต้นเวลาเรียก API จาก frontend

## เปิด frontend ด้วย `bcaiaccount-local` (`.claude/launch.json:15-27`)
- คำสั่ง: `node frontend/node_modules/next/dist/bin/next dev frontend -p 3001`
- env ที่ตั้งไว้ในคอนฟิก: `FORCE_BCDEMO=1` และ `SERVICE_BASE_URL=http://127.0.0.1:18090`
- คอนฟิก `bcaiaccount-dev` ในไฟล์เดียวกันเรียก `npm run dev` ที่พอร์ต 3100 โดยไม่ตั้ง env ทั้งสองตัว

## ตัวแปร env ที่มีผลกับ frontend
- `SERVICE_BASE_URL` — ปลายทาง backend ที่ route ฝั่ง server ส่งต่อ; ไม่ตั้งจะใช้ `http://127.0.0.1:8080` (`api-server.ts:22-23`)
- `USE_MOCK=1` — ใช้ข้อมูลจำลองใน `src/mocks` (ตอนพัฒนา offline); `USE_MOCK=0` ส่งต่อไป `SERVICE_BASE_URL` (`api-server.ts:17-21`)
- `FORCE_BCDEMO=1` — ให้ `isCurrentRequestBcDemo()` ตอบ true แม้คำขอไม่ได้มาจากโดเมนเดโม (`session.ts:98`, `:100`) ทำให้เปิด localhost แล้วเข้าโหมดสาธิตของฐาน `bcdemo` ได้
- ส่วนหัว `x-no-demo-fallback: 1` ในคำขอ — บังคับให้ `isCurrentRequestBcDemo()` ตอบ false ก่อนตรวจโดเมนและ env (`session.ts:91`)
- `TRUST_PROXY` — ถ้าไม่ใช่ `0` จะเชื่อ `x-forwarded-host` ตอนตรวจว่าเป็นโดเมนเดโม (`session.ts:95`; ตัวเทียบโดเมนอยู่ที่ `session-name.ts:12-16`)

## ข้อห้ามตอนทดสอบกับ `bcdemo` (`AGENTS.md:48`)
- ห้ามพิมพ์รหัส/token ลงสคริปต์ แชท log หรือ git
- ห้ามแก้ข้อมูลใน `bcdemo` ยกเว้นแถวที่ขึ้นต้นด้วย `UAT` — ดูวิธีตั้งชื่อข้อมูลทดสอบและลำดับตรวจที่ [[std-uat-swarm-dsl-and-tester-rules]]

## รันสคริปต์ทดสอบเดี่ยว
ตัวรันสคริปต์ของ BC Ai Tester ใช้รูปแบบ `node runner/run.mjs --script <ไฟล์> --out <โฟลเดอร์> --base <url ของ ERP>` (`uat/openhands-swarm/runner/run.mjs:3`) รายละเอียดคำสั่ง DSL อยู่ที่ [[std-uat-swarm-dsl-and-tester-rules]]

## ที่มา
- `AGENTS.md` ข้อ 7 (พอร์ตและข้อห้ามข้อมูล), `.claude/launch.json`
- อ่านโค้ดจริง: `frontend/src/lib/session.ts`, `session-name.ts`, `api-server.ts`, `backend/internal/platform/config/config.go`

## ดูเพิ่ม
[[standards-overview]] · [[std-repo-scope-rules]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-uat-issuemate-workflow]]

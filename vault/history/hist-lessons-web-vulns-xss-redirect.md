---
title: "บทเรียนช่องโหว่เว็บ XSS และ open redirect (Web Vulnerabilities)"
tags: [history, lesson, xss, redirect, web-security]
aliases: ["open redirect", "safeReturnPath", "escapePopupHtml", "safeMediaContentType", "nosniff", "LIKE wildcard escape"]
sources: ["frontend/src/lib/safe-return.ts:6", "frontend/src/lib/safe-return.test.ts:10", "frontend/src/app/login/page.tsx:168", "frontend/src/app/select-database/page.tsx:250", "frontend/shared/ui/BcMapPickerModal.tsx:185", "frontend/src/lib/api-server.ts:42", "frontend/src/app/api/crm/image/route.ts:62", "frontend/src/app/api/process/docpicture/image/route.ts:35", "frontend/src/app/api/process/itempicture/image/route.ts:35", "frontend/account/report/BuySaleInformationScreen.tsx:64", "frontend/src/lib/bc-query-builder.ts:17", "frontend/account/master/CustomerScreen.tsx:114"]
---

# ช่องโหว่เว็บฝั่ง Next.js: open redirect, XSS, ชนิดไฟล์อันตราย

ช่องโหว่ฝั่งเว็บส่วนใหญ่เกิดที่จุดที่ค่าจากผู้ใช้หรือฐานข้อมูลถูกนำไปเป็น URL ปลายทาง, HTML หรือ `Content-Type` โดยไม่ผ่านตัวตรวจกลาง ทั้งหมดอยู่นอกขอบ backend Go (`frontend/src`, `frontend/shared`, `frontend/account`) บันทึกนี้เก็บเฉพาะด่านที่ยังเห็นในโค้ดวันนี้

## อะไรพังได้
- **open redirect:** `/login?returnTo=...` และ `/select-database?returnTo=...` ถ้าเช็กแค่ขึ้นต้นด้วย `/` จะส่งผู้ใช้ไปเว็บภายนอกหลังล็อกอินได้ (เช่น ค่าขึ้นต้น `//` หรือ `/\`)
- **XSS ใน popup แผนที่:** ชื่อ/ที่อยู่ลูกค้าจากฐานข้อมูลถูกต่อเป็นสตริง HTML ให้ Leaflet `bindPopup` ซึ่งตีความเป็น HTML
- **ไฟล์ที่ผู้ใช้อัปโหลดรันบนโดเมนเรา:** proxy รูป/เอกสารที่ส่งต่อ `Content-Type` ของต้นทางทั้งหมด ถ้าเปิดลิงก์ตรงๆ อาจถูกเบราว์เซอร์ตีความเป็นหน้าเว็บ
- **wildcard ของ LIKE:** ผู้ใช้พิมพ์ `%`, `_`, `\` ในช่องค้นหา แล้วถูกตีเป็น wildcard ทำให้ผลค้นหาผิด
- **หน้าจอพังเมื่อเบราว์เซอร์บล็อก `localStorage`:** การอ่านค่า preference throw ทำจอ master ทั้งจอไม่ขึ้น (ไม่ใช่ช่องโหว่แต่เกิดในกลุ่มเดียวกัน)

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ตัวตรวจ `returnTo` ตัวเดียว | `frontend/src/lib/safe-return.ts:6` `safeReturnPath(raw, fallback="/home")` | ยอมเฉพาะ path ภายในที่ขึ้นต้น `/` และไม่ขึ้นต้น `//` หรือ `/\`; ปฏิเสธ `\` และ control character ทั้งหมด → ใช้ fallback |
| หน้าที่รับ `returnTo` | `frontend/src/app/login/page.tsx:168`, `frontend/src/app/select-database/page.tsx:250` | ทั้งสองหน้าเรียก `safeReturnPath` ก่อนใช้ |
| เทสต์ | `frontend/src/lib/safe-return.test.ts:5,10` | เคส `//evil.com`, `/\evil.com`, `https://...`, tab/control, ว่าง/null ต้องได้ `/home` |
| escape ก่อนใส่ popup | `frontend/shared/ui/BcMapPickerModal.tsx:185` `escapePopupHtml` (ใช้ที่ `:742-743`) | แทนที่ `& < > " '` กับรหัส/ชื่อ/ที่อยู่ก่อนต่อสตริง |
| Content-Type allow-list | `frontend/src/lib/api-server.ts:42-61` `safeMediaContentType` | ยอมเฉพาะรูป (png/jpeg/gif/webp/bmp/avif/ไอคอน ไม่รวม SVG), PDF, ไฟล์ Office, csv/text/json/zip; อย่างอื่นใช้ค่า fallback (ค่าเริ่มต้น `application/octet-stream`) |
| `nosniff` ที่ route รูป | `frontend/src/app/api/crm/image/route.ts:62,68`, `process/docpicture/image/route.ts:35-36`, `process/itempicture/image/route.ts:35-36` | ส่ง `X-Content-Type-Options: nosniff` คู่กับ allow-list |
| escape wildcard ของ LIKE | `frontend/account/report/BuySaleInformationScreen.tsx:64-67` | ใส่ `\` นำหน้า `\ % _` แล้วต่อ `ESCAPE '\'` กับ `ILIKE` |
| `localStorage` ปลอดภัย | `frontend/account/master/CustomerScreen.tsx:114-120` (รูปแบบเดียวกัน 6 ไฟล์ที่ใช้ key `bc_lock_for_edit_show_again`) | ครอบ `try/catch` แล้วใช้ค่าเริ่มต้น |

## กฎที่ต้องจำ
1. ค่าที่จะกลายเป็น URL ปลายทางต้องผ่าน `safeReturnPath` ตัวเดียว ห้ามเช็กเองทีละหน้า และเพิ่มเคสในเทสต์เมื่อเจอรูปแบบใหม่
2. ข้อมูลจากฐานข้อมูลที่ต่อเป็น HTML (popup, `innerHTML`) ต้อง escape ที่จุดต่อสตริงเสมอ
3. proxy ไฟล์ที่ผู้ใช้อัปโหลดต้อง allow-list `Content-Type` พร้อม `nosniff` ห้ามส่งต่อค่าของต้นทาง
4. escape ให้ตรงบริบท: `escapeSql` (`frontend/src/lib/bc-query-builder.ts:17`) escape เฉพาะเครื่องหมาย `'` ส่วน wildcard ของ `LIKE` ต้อง escape เองพร้อม `ESCAPE` (ทำไว้ที่ `BuySaleInformationScreen.tsx:64-67`)
5. ตัวช่วยความปลอดภัยต้องมีผู้เรียกจริง ตรวจด้วย grep ว่า helper ถูกใช้ครบทุกจุดที่รับค่าประเภทนั้น

## ที่มาในโค้ด
- `frontend/src/lib/safe-return.ts:6` + `safe-return.test.ts:5-20`; ผู้เรียก `src/app/login/page.tsx:168`, `src/app/select-database/page.tsx:250`
- `frontend/shared/ui/BcMapPickerModal.tsx:185,742-743`
- `frontend/src/lib/api-server.ts:42-61`; `src/app/api/crm/image/route.ts:62,68`; `src/app/api/process/docpicture/image/route.ts:35-36`; `src/app/api/process/itempicture/image/route.ts:35-36`
- `frontend/account/report/BuySaleInformationScreen.tsx:64-67`; `frontend/src/lib/bc-query-builder.ts:17`; `frontend/account/master/CustomerScreen.tsx:114-120`
- ดูเพิ่ม: [[std-security-authz-and-web-vulns]] · [[std-security-lessons-idor]] · [[hist-lessons-tenant-auth-sessions]] · [[fe-api-proxy-routes]] · [[fe-query-client-sql-builder]]

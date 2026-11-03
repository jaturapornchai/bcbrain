---
title: "บทเรียนช่องโหว่เว็บ XSS และ open redirect (Web Vulnerabilities)"
tags: [history, xss, redirect, web-security]
aliases: ["open redirect", "safeReturnPath", "escapePopupHtml", "safeMediaContentType", "nosniff"]
sources: ["git:6ba1a6d9", "git:faa6e6d0", "git:386e3baa", "git:6cb904f7", "frontend/src/lib/safe-return.ts:6", "frontend/shared/ui/BcMapPickerModal.tsx:185", "frontend/src/lib/api-server.ts:42", "frontend/account/report/BuySaleInformationScreen.tsx:64"]
---

## ภาพรวม
ช่องโหว่ฝั่งเว็บของ Next.js ชุด S3-S5 พบในรอบตรวจความปลอดภัย 2026-10-24 (faa6e6d0) เป็นช่องที่ฟีเจอร์ใหม่เปิดเอง: `returnTo` จาก 6ba1a6d9, popup แผนที่, proxy รูปที่ผู้ใช้อัปโหลด ทั้งหมดอยู่นอกขอบ backend (`frontend/src`, `frontend/shared`) แต่เก็บไว้เป็นบทเรียนของกลุ่มความปลอดภัย

## อาการ
- **W1 open redirect:** `/login?returnTo=...` และ `/select-database?returnTo=...` ส่งผู้ใช้ไปเว็บภายนอกหลังล็อกอินได้ (ลิงก์ฟิชชิงบนโดเมนจริง)
- **W2 XSS:** ชื่อ/ที่อยู่ลูกค้าจากฐานข้อมูลถูกใส่ popup แผนที่ที่ Leaflet ตีความเป็น HTML
- **W3 ชนิดไฟล์อันตราย:** เปิดลิงก์รูปที่ proxy ตรง ๆ แล้วไฟล์ที่ผู้ใช้อัปโหลดรันสคริปต์บนโดเมนของเรา (ตามคอมเมนต์ใน `safeMediaContentType`)
- **W4 wildcard ใน LIKE:** ผู้ใช้พิมพ์ `%`, `_`, `\` ในช่องค้นหาลูกค้า (BuySaleInformation) แล้วถูกตีเป็น wildcard ผลค้นหาผิด
- **W5 (ไม่ใช่ช่องโหว่):** `localStorage` ถูกบล็อก (Private/นโยบายเบราว์เซอร์) แล้ว throw ทำจอ master ทั้งจอพัง

## สาเหตุ (root cause)
- W1: 6ba1a6d9 รับ `returnTo` ตรวจแค่ `startsWith("/") && !startsWith("//")`
- W2: ข้อมูลจาก DB ต่อสตริง HTML ส่ง `bindPopup` โดยไม่ escape
- W3: proxy ส่งต่อ `Content-Type` ของต้นทางทั้งหมดและไม่ตั้ง `nosniff`
- W4: ไม่ได้ escape ตัวอักษรพิเศษของ LIKE
- W5: เรียก `localStorage` นอก try/catch

## วิธีแก้
- **W1:** helper `safeReturnPath(raw, fallback="/home")` ยอมเฉพาะ path ภายใน; มีเทสต์ `safe-return.test.ts`
- **W2:** `escapePopupHtml` แทน `& < > " '` ก่อนใส่ popup
- **W3:** `safeMediaContentType` ยอมเฉพาะ `image/(png|jpeg|gif|webp|bmp|avif|x-icon)` กับ `application/pdf` นอกนั้นเป็น `application/octet-stream` พร้อม `X-Content-Type-Options: nosniff` ที่ route รูป crm, docpicture, itempicture
- **W4:** 6cb904f7 ใส่ `\` นำหน้า `\ % _` แล้ว `ESCAPE '\'` ต่อท้าย `ILIKE`
- **W5:** ครอบ `try/catch` ในจอ master 6 จอ (ค่าเริ่มต้น true)

## commit ที่เกี่ยวข้อง
- `6ba1a6d9` — เพิ่ม `returnTo` (ต้นเหตุ W1; 2026-10-20)
- `faa6e6d0` — `safeReturnPath`, `escapePopupHtml`, `safeMediaContentType` (2026-10-24)
- `386e3baa` — นำ `safeReturnPath` มาใช้ในหน้า login/select-database แทนเช็กเดิม (2026-10-24)
- `6cb904f7` — escape LIKE และ `localStorage` ปลอดภัย (2026-10-24)

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/src/lib/safe-return.ts:6` `safeReturnPath`; ใช้ที่ `src/app/login/page.tsx:87`, `src/app/select-database/page.tsx:250`; เทสต์ `src/lib/safe-return.test.ts`
- `frontend/shared/ui/BcMapPickerModal.tsx:185` `escapePopupHtml` ใช้ที่ `:742-743`
- `frontend/src/lib/api-server.ts:42` `safeMediaContentType`; `src/app/api/crm/image/route.ts:62,68`; `process/docpicture/image/route.ts:35-36`; `process/itempicture/image/route.ts:35-36`
- `frontend/account/report/BuySaleInformationScreen.tsx:64-67`; `frontend/account/master/CustomerScreen.tsx:113-118` (try/catch)

## บทเรียน / กฎที่ได้
1. ค่าที่จะเป็น URL ปลายทางต้องผ่านตัวตรวจกลางตัวเดียว (allow-list ของ path ภายใน) ไม่เช็กเองทีละหน้า
2. ข้อมูลจาก DB ที่ใส่ HTML (popup, innerHTML) ต้อง escape ที่จุดต่อสตริงเสมอ
3. proxy ไฟล์ของผู้ใช้ต้อง allow-list `Content-Type` + `nosniff` ห้ามส่งต่อค่าต้นทาง
4. escape ให้ตรงบริบท: quote ของ SQL กับ wildcard ของ LIKE เป็นคนละเรื่อง
5. ตัวช่วยความปลอดภัยต้องมีทั้ง "ฟังก์ชัน" และ "การเรียกใช้" ในที่เดียวกัน ตรวจด้วย grep ว่ามีผู้เรียกจริง

## ดูเพิ่ม
[[std-security-authz-and-web-vulns]] · [[std-security-lessons-idor]] · [[hist-lessons-tenant-auth-sessions]] · [[fe-api-proxy-routes]] · [[fe-query-client-sql-builder]] · [[history-overview]]

## ที่มาในโค้ด
- git:6ba1a6d9, git:faa6e6d0, git:386e3baa, git:6cb904f7
- frontend/src/lib/safe-return.ts:6
- frontend/shared/ui/BcMapPickerModal.tsx:185
- frontend/src/lib/api-server.ts:42

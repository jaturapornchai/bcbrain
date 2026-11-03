---
title: "แอป Flutter สำหรับหน้างาน 4 บทบาทของ AutoCare (sys-autocare-flutter-app)"
tags: [systems, autocare, flutter, mobile]
aliases: ["autocare_flutter", "BC AutoCare Flutter App", "แอปมือถือ AutoCare", "AutoCareMobileShell"]
sources:
  - "frontend/autocare_flutter/pubspec.yaml:1-20"
  - "frontend/autocare_flutter/lib/main.dart:1-46"
  - "frontend/autocare_flutter/lib/main.dart:48-130"
  - "frontend/autocare_flutter/lib/main.dart:150-238"
  - "frontend/autocare_flutter/lib/main.dart:398-492"
  - "frontend/autocare_flutter/lib/main.dart:776-800"
  - "frontend/autocare_flutter/lib/main.dart:945-962"
  - "frontend/autocare_flutter/lib/main.dart:1005-1016"
  - "frontend/autocare_flutter/lib/main.dart:1155-1178"
  - "frontend/autocare_flutter/lib/main.dart:1415-1455"
  - "frontend/src/proxy.ts:37"
  - "frontend/src/proxy.ts:68"
  - "frontend/tsconfig.json:58"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:888-973"
---

# แอป Flutter ของ AutoCare

## ภาพรวม
- โค้ดทั้งหมดอยู่ใน `frontend/autocare_flutter/lib/main.dart` ไฟล์เดียว ใช้แพ็กเกจ `http` เพิ่มจาก Flutter SDK เท่านั้น (pubspec.yaml)
- ชื่อแอปคือ `BC AutoCare Flutter App` หน้าหลักเป็น `AutoCareMobileShell` (main.dart:29-55)
- แอปเรียก API ด้วย path แบบ relative (`/api/auth/session`, `/api/autocare/overview`, `/api/autocare/action`) จึงต้องเปิดจาก origin เดียวกับเว็บ Next.js (main.dart:150-238) ไฟล์ build ของแอปเสิร์ฟใต้ path `/autocare-flutter` ซึ่ง `proxy.ts` ข้ามไม่ตรวจ session (proxy.ts:37, :68) และ `tsconfig.json` ไม่รวมโฟลเดอร์นี้ (tsconfig.json:58)
- **การล็อกอิน**: แอปอ่าน `/api/auth/session` ก่อน ถ้ายังไม่มี session จะเรียก `POST /api/auth/demo` เพื่อขอ session เดโมเอง แล้วเก็บชื่อฐานข้อมูลไว้ (ค่าเริ่มต้น `bcdemo`) (main.dart:150-175) ดู [[fe-auth-session]]

## 4 บทบาท (`_roleIndex`, main.dart:56, :398-405)
| แท็บ | บทบาท | งานหลัก | action ที่เรียก |
|---|---|---|---|
| 1. SA รับรถ | พนักงานรับรถ | สแกนทะเบียน เลือกโหมดศูนย์บริการ ตรวจขอบล้อแม็ก 4 ล้อ เซ็นรับรถ | `create_intake_job` (main.dart:781) |
| 2. ช่าง & DVI | ช่างหน้าอู่ | ตรวจ 35 จุด เสนอซ่อมเพิ่ม และดูกระเป๋าเงินช่าง | `save_dvi_upsell` (:947), `approve_lineoa_upsell` (:979) |
| 3. คลังรับยาง | คลัง | รับของแบบไม่เห็นทุน และค้นไซส์หรือล็อต DOT | `create_blind_receiving` (:1161) |
| 4. เจ้าของร้าน | เจ้าของ | ดูสถานะ Accounting State Gate อนุมัติหรือขอส่วนลดพิเศษ | `approve_owner_discount` (:1427), `request_owner_discount` (:1442) |

ปุ่มส่วนลดของเจ้าของร้านแสดงเฉพาะใบที่ยังไม่ลงบัญชี ถ้าสถานะคำขอเป็น `REQUESTED` หรือ `PENDING` จะแสดงปุ่มอนุมัติ ถ้าไม่ใช่จะแสดงปุ่มขอส่วนลดพร้อมค่าตายตัว `'800'` (main.dart:1415-1455) ทุก action ส่ง `{action, ...payload}` ผ่าน `_postAction` แล้วโหลด Overview ใหม่ (main.dart:209-238) ขั้นตอนฝั่ง backend ดูที่ [[sys-autocare-job-flow]]

## ชื่อฟิลด์ไม่ตรงกับ backend
`autoCareActionRequest` ฝั่ง Go รับ JSON ตามชื่อที่กำหนดไว้เท่านั้น (handler.go:888-973) แต่แอปส่งบางฟิลด์ด้วยชื่ออื่น ฟิลด์เหล่านั้นจึงถูกทิ้ง และ backend ใช้ค่าเดโมแทน
- `create_intake_job` (main.dart:776-800)
  | แอปส่ง | backend รอ |
  |---|---|
  | `mileage_km` | `odometer_km` |
  | `customer_code` | `cust_code` |
  | `customer_name` | `cust_name` |
  | `customer_phone` | `cust_phone` |
  | `bay_no` | `bay_code` |
  | `mechanic_code` | `tech_code` |
  | `mechanic_name` | `tech_name` |
  | `rim_fl_status` … | `rim_fl` … |

  ฟิลด์ที่ตรงกันมีแค่ `plate_no`, `province`, `brand`, `model` และ `business_mode`
- `save_dvi_upsell` (main.dart:945-962) แอปส่ง `upsell_finding`, `upsell_amount` และ `dvi_*_count` ซึ่ง backend ไม่มีฟิลด์เหล่านี้เลย backend รอ `upsell_title` และ `unit_price` ยอด upsell จึงใช้ค่าเริ่มต้น 3190 เสมอ (handler.go:1121-1124)
- `create_blind_receiving` (main.dart:1155-1178) แอปส่ง `po_ref_no` และ `received_qty` แต่ backend รอ `delivery_note_no` และ `total_items_qty` จำนวนรับจึงใช้ค่าเริ่มต้น 16

## ตัวเลขเงินในแอป
แอปแปลงสตริงเงินจาก API เป็น `double` เพื่อแสดงผลและรวมยอดกระเป๋าช่าง (main.dart:1005-1016) และส่ง `upsell_amount` เป็น `double` (main.dart:956) ค่าเงินที่บันทึกลงบัญชีจริงคำนวณใหม่ใน backend ด้วย big.Rat ดู [[sys-autocare-billing-gl]] และ [[fe-numeric-money]]

## ที่มาในโค้ด
- `frontend/autocare_flutter/lib/main.dart:150-238`: session, overview, `_postAction`
- `frontend/autocare_flutter/lib/main.dart:398-492`: แถบเลือกบทบาทและการสลับหน้า
- `backend/internal/adapter/inbound/http/autocare/handler.go:888-973`: ฟิลด์ที่ backend รับ

ดูเพิ่ม: [[sys-autocare-overview]] · [[sys-autocare-blind-receiving]] · [[sys-autocare-screens-menus]]

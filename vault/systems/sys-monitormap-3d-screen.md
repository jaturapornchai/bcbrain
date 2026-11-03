---
title: "หน้าจอแผนที่ 3 มิติ: กล้อง แผง คีย์ลัด เสียง และแคชแผ่นแผนที่ (ThailandMonitorMapScreen)"
tags: [systems, monitormap, 3d, threejs, ui]
aliases: ["ThailandMonitorMapScreen", "กล้องอัตโนมัติ", "Auto Director", "ปล่อยรถด่วน", "bc-monitormap-tiles-v2", "threejs-monitormap-canvas", "คีย์ลัดแผนที่ 3 มิติ"]
sources: ["frontend/monitormap/ThailandMonitorMapScreen.tsx:63-80", "frontend/monitormap/ThailandMonitorMapScreen.tsx:137-150", "frontend/monitormap/ThailandMonitorMapScreen.tsx:187-215", "frontend/monitormap/ThailandMonitorMapScreen.tsx:340-380", "frontend/monitormap/ThailandMonitorMapScreen.tsx:411-437", "frontend/monitormap/ThailandMonitorMapScreen.tsx:596-620", "frontend/monitormap/ThailandMonitorMapScreen.tsx:652-668", "frontend/monitormap/ThailandMonitorMapScreen.tsx:696-738", "frontend/monitormap/ThailandMonitorMapScreen.tsx:995-1060", "frontend/monitormap/ThailandMonitorMapScreen.tsx:1206-1268", "frontend/monitormap/ThailandMonitorMapScreen.tsx:1301-1321", "frontend/monitormap/ThailandMonitorMapScreen.tsx:1344-1369", "frontend/monitormap/ThailandMonitorMapScreen.tsx:1387-1390", "frontend/monitormap/ThailandMonitorMapScreen.tsx:1921-1968", "frontend/monitormap/ThailandMonitorMapScreen.tsx:2020-2030", "frontend/monitormap/ThailandMonitorMapScreen.tsx:2314-2340", "frontend/monitormap/ThailandMonitorMapScreen.tsx:2361", "frontend/monitormap/ThailandMonitorMapScreen.tsx:2574", "frontend/monitormap/ThailandMonitorMapScreen.tsx:2672-2712", "frontend/monitormap/ThailandMonitorMapScreen.tsx:2954-3047", "backend/internal/adapter/inbound/http/monitormap/handler.go:183-194"]
---
# หน้าจอแผนที่ 3 มิติของ 3D Monitor TV

`ThailandMonitorMapScreen` (ไฟล์เดียว 3,400 กว่าบรรทัด) คือหน้าจอของ [[sys-monitormap-overview]] วาดฉากด้วย Three.js (`THREE.WebGLRenderer`) บนผืนผ้าใบ (`data-testid="threejs-monitormap-canvas"`) พื้นแผนที่เป็นภาพแผ่นแผนที่ที่ประกอบเป็นพื้นผิว มีรถบรรทุกวิ่งตามเส้นทาง คลังและจุดลูกค้าเป็นโมเดล 3 มิติ ข้อมูลที่แสดงมาจาก [[sys-monitormap-data-tables]]

## รูปแบบแผนที่และโหมดกล้อง
- **3 รูปแบบแผนที่** (`FreeMapStyleMode`) ปุ่มสลับวนตามลำดับ: `SATELLITE_HYBRID` (ดาวเทียม + ถนนทางหลวง + ชื่อสถานที่), `OSM_STREET` (แผนที่ถนน), `SATELLITE_PURE` (ดาวเทียม + ชื่อสถานที่) ในชั้น Go ชื่อเลเยอร์ `sat`, `trans`, `places` ชี้ไปบริการแผ่นแผนที่ดาวเทียมของ Esri ส่วนเลเยอร์ถนน (`osm` ในหน้าจอ) ตกไปที่กรณีเริ่มต้นของ `upstreamSpec` ซึ่งดึงแผนที่ถนนของ Esri เช่นกัน ไม่ได้ดึงจาก OpenStreetMap ตามชื่อโหมด
- **5 โหมดกล้อง** (`CameraDirectorMode`): `MACRO_THAILAND` (มองทั้งประเทศ), `CHASE_TRUCK` (ตามรถ), `ZOOM_WAREHOUSE` (ซูมคลัง), `ZOOM_CUSTOMER` (ซูมจุดลูกค้า), `RIVER_SATELLITE` (มุมแม่น้ำเหนือกรุงเทพฯ)
- **กล้องอัตโนมัติ (Auto Director)** เปิดเป็นค่าเริ่มต้น ทุก 8.5 วินาทีจะสุ่มตัดภาพ (`triggerRandomExcitingCut`): แจ้งเตือนที่ยังเปิดอยู่ 25%, รถ 25%, คลัง 20%, ลูกค้า 16%, มุมแม่น้ำ 8%, ภาพรวมประเทศ 6% ถ้าผู้ใช้เพิ่งควบคุมเอง (ลาก/ซูม/กดเลือก) ตัวนับจะรอและเริ่มรอบใหม่ ปุ่ม "วนชม ON/OFF" ปิดการสุ่มได้

## แผงลอยและการควบคุม
- 4 แผงลอย (`FloatingPanelId`): `director` (ข้อความผู้กำกับ), `leftControl` (รายการ), `inspector` (รายละเอียดสิ่งที่เลือก มีปุ่มก่อนหน้า/ถัดไป), `alerts` แต่ละแผงลากย้าย ย่อ และปิดได้
- แผงซ้าย: แท็บ "ทั้งหมด/ขนส่ง" แสดงรายการรถ, แท็บ "คลัง" แสดงรายการคลัง, แท็บ "การเงิน" แสดงรายการลูกค้า/จุดส่งพร้อมยอดบิลและจำนวนลัง คลิกรายการเพื่อให้กล้องเข้าไปดู
- แผงขวา: แท็บ "การแจ้งเตือน" (พร้อมปุ่มสั่งการแต่ละรายการและปุ่มอนุมัติทั้งหมด) และแท็บ "เหตุการณ์"
- แถบบน: ปุ่มกระโดดไป 5 ภูมิภาค (กทม./กลาง, ตะวันออก EEC, เหนือ, อีสาน, ใต้), ปุ่ม "ปล่อยรถด่วน", ปุ่มสลับรูปแบบแผนที่, ปุ่มกระดิ่งแจ้งเตือน, ปุ่มเปิด/ปิดเสียงบรรยาย, ความเร็วจำลอง 1x/3x/6x, ปุ่มเต็มจอ (`requestFullscreen`)
- เมาส์/สัมผัส: คลิกที่รถ/คลัง/ลูกค้าเพื่อเลือก (ถ้าลากเกิน 6 พิกเซลไม่นับเป็นคลิก), ดับเบิลคลิกบนพื้นแผนที่เพื่อซูมไปยังพิกัดนั้น (เฉพาะในกรอบประเทศไทยและพื้นที่ใกล้เคียงที่โค้ดกำหนด), มีปุ่มซูมเข้า/ออก เลื่อนแผนที่ และรีเซ็ตให้ทิศเหนืออยู่ด้านบน
- **คีย์ลัด** (ไม่ทำงานขณะพิมพ์ในช่องกรอก): 1 ภาพรวมประเทศ, 2 ตามรถคันแรก, 3 คลังแรก, 4 จุดลูกค้าแรก, 5 มุมแม่น้ำ, Space ตัดภาพสุ่ม, `+`/`-` ซูม, ลูกศรหรือ W A S D เลื่อนแผนที่, H ซ่อน/แสดงแผงทั้งหมด, M เปิด/ปิดเสียงบรรยาย

## ข้อควรรู้: อะไรจริง อะไรจำลอง
- **ตำแหน่งรถเป็นการจำลองบนหน้าจอ** ไม่ใช่ GPS: แต่ละคันมีค่า `progress` ที่เพิ่มตามเวลาด้วย `speed_factor` แล้ววนกลับ (หารเอาเศษด้วย 1) ตามจุดผ่านที่สร้างจากสูตร ปุ่มความเร็ว 1x/3x/6x คูณค่านี้
- **ปุ่ม "ปล่อยรถด่วน"** เป็นการสาธิตบนหน้าจอเท่านั้น: สุ่มคลัง ลูกค้า และรถ (ยอดบิลและจำนวนลังเป็นเลขสุ่ม) แล้วบวกยอดขาย เงินสด กำไรประมาณการ และจำนวนใบกำกับภาษีอิเล็กทรอนิกส์ของวันนี้ในชุดข้อมูลบนจอ เพิ่มเหตุการณ์ใหม่ เร่งความเร็วจำลองเป็น 3x และให้กล้องตามรถคันนั้น ข้อความและเสียงบนจอบอกว่า "บันทึกบัญชีเรียลไทม์" แต่โค้ดไม่เรียก API ใดและไม่บันทึกฐานข้อมูล จึงไม่เกิดใบสั่งขายหรือทริปขนส่งจริง และตัวเลขที่บวกจะหายไปเมื่อจอดึงข้อมูลใหม่ในรอบ 20 วินาทีถัดไป
- **ปุ่มสั่งการในแจ้งเตือน** เปลี่ยนสถานะบนจอทันที เสียงบรรยายผลลัพธ์ แล้วส่ง `POST /api/monitormap` เพื่อบันทึก `RESOLVED` ลงตาราง `monitormap_sme_alerts` เท่านั้น ถ้าเครือข่ายล้มเหลวโค้ดจะเงียบ (ไม่แสดงความผิดพลาด) รอบรีเฟรชถัดไปจะคงสถานะที่ผู้ใช้เพิ่งกดไว้ตามที่จอจำได้
- ดึงข้อมูลใหม่ (`GET /api/monitormap`) ทุก 20 วินาที ดึงสถิติแคชแผ่นแผนที่ทุก 6 วินาที และสั่งอุ่นแคชอัตโนมัติ (`AUTO_WARM`) ตอนเปิดจอ (รายละเอียดฝั่งเซิร์ฟเวอร์ที่ [[api-ops-health-monitormap]])

## เสียงบรรยายภาษาไทย
ใช้ Web Speech API (`SpeechSynthesisUtterance`) ตั้ง `lang = "th-TH"` และเลือกเสียงที่เป็นภาษาไทยในเครื่องถ้ามี ข้อความที่พูดมาจากคอลัมน์ `voice_narration`, `voice_alert`, `voice_resolved` ของตาราง และข้อความที่หน้าจอสร้างเองเมื่อกล้องเปลี่ยนจุดสนใจหรือมีคำสั่งด่วน เบราว์เซอร์มักไม่ให้เล่นเสียงก่อนผู้ใช้โต้ตอบ โค้ดจึงรอการแตะ/กดแป้นครั้งแรกแล้วค่อยเล่นบทล่าสุด ถ้าเครื่องไม่มีเสียงไทยหรือผู้ใช้ปิดเสียง จะไม่มีเสียงแต่จอทำงานปกติ

## แคชแผ่นแผนที่ฝั่งเบราว์เซอร์
ฝั่งเบราว์เซอร์ดึงแผ่นแผนที่เป็น 2 ชั้น: (1) Cache Storage ของเบราว์เซอร์ ชื่อ `bc-monitormap-tiles-v2` (โค้ดลบชื่อรุ่นเก่า `-v1` ทิ้ง) (2) ถ้าไม่พบ เรียกพร็อกซี `/api/monitormap/tile` (ลองใหม่สูงสุด 3 ครั้ง) ซึ่งต่อไปยังแคชของ Go (RAM, ดิสก์, PostgreSQL) แล้วค่อยไปต้นทางภายนอก ตามที่อธิบายใน [[api-ops-health-monitormap]] ถ้าได้คำตอบ `FALLBACK` จะไม่เก็บลงแคชเบราว์เซอร์ จำกัดการดึงพร้อมกันฝั่งเบราว์เซอร์ไม่เกิน 18 รายการ และเก็บพื้นผิวไว้ในหน่วยความจำของหน้า (`GLOBAL_TILE_TEXTURE_CACHE`) ป้ายสถานะแคชบนจอคือ `tile-cache-status-badge`

## เรื่องเทคนิค
จอนี้ใช้ WebGL (`THREE.WebGLRenderer`) จึงต้องเปิดบนเบราว์เซอร์ที่รองรับ WebGL ข้อกำหนดเรื่องแอนิเมชันของโปรเจกต์ดู [[std-motion-animation-rules]] และ [[std-motion-ui]] ข้อมูลภูมิศาสตร์ที่ใช้วาดอยู่ใน `thailandGeoData.ts` ดู [[std-thai-geo-map-bank-logos]]

## ที่มาในโค้ด
- `frontend/monitormap/ThailandMonitorMapScreen.tsx:63-80` ชนิดโหมดกล้อง รูปแบบแผนที่ และแผงลอย; `:137-150` ชื่อแคชเบราว์เซอร์และเพดาน 18 รายการ; `:187-215` ลำดับชั้นการดึงแผ่นแผนที่; `:340-380` ประกอบพื้นผิวตามรูปแบบแผนที่
- `frontend/monitormap/ThailandMonitorMapScreen.tsx:411-437` สถานะค่าเริ่มต้น (กล้องอัตโนมัติ แท็บ ความเร็ว); `:596-620` เสียงไทย; `:652-668` ปลดล็อกเสียงเมื่อแตะครั้งแรก; `:696-738` ดึงข้อมูลทุก 20 วินาที สถิติแคชทุก 6 วินาที และ `AUTO_WARM`
- `frontend/monitormap/ThailandMonitorMapScreen.tsx:995-1060` ปล่อยรถด่วน (จำลองในเบราว์เซอร์ ไม่เรียก API); `:1206-1268` สั่งการ/รีเซ็ต/อนุมัติทั้งหมดแล้ว `POST /api/monitormap`; `:1301-1321` ตัดภาพสุ่ม; `:1344-1369` ตัวจับเวลากล้องอัตโนมัติ 8.5 วินาที
- `frontend/monitormap/ThailandMonitorMapScreen.tsx:1387-1390` สร้าง `WebGLRenderer`; `:1921-1968` คลิก/ดับเบิลคลิกบนผืนผ้าใบ; `:2020-2030` ความคืบหน้าของรถวนซ้ำ; `:2314-2340` คีย์ลัด; `:2361` เต็มจอ; `:2574` ผืนผ้าใบ; `:2672-2712` ปุ่มภูมิภาคและปล่อยรถด่วน; `:2954-3047` รายการในแผงซ้าย
- `backend/internal/adapter/inbound/http/monitormap/handler.go:183-194` ต้นทางแผ่นแผนที่ตามชื่อเลเยอร์
- ดูเพิ่ม: [[sys-monitormap-overview]] · [[sys-monitormap-data-tables]] · [[api-ops-health-monitormap]] · [[std-motion-animation-rules]]

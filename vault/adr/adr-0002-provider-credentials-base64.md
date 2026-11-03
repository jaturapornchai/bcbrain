---
title: "ADR-0002 การเก็บข้อมูลเชื่อมต่อฐานข้อมูลของผู้เช่า"
tags: [backend, adr, tenant, security]
aliases: ["ADR 0002", "CredentialCodec", "provider credential"]
sources: []
---

# ADR-0002 การเก็บข้อมูลเชื่อมต่อฐานข้อมูลของผู้เช่า

สถานะ: **accepted** (ตรงกับโค้ด). รหัสผ่านฐานข้อมูลของผู้เช่าในไฟล์ `BCConfig<CODE>.json` ถูกแปลงผ่าน port `CredentialCodec`.

## ทำงานอย่างไร

1. ตอนสร้าง/แก้ Provider ผ่าน API admin, service เรียก `CredentialCodec.Encode` แล้วเขียนผลลง JSON.
2. ตอนต่อ DB ของผู้เช่า `Decode(encoded)` คืนค่าเดิม.
3. เพราะเป็น port จึงสลับได้ภายหลังโดยไม่แก้ผู้เรียก.

## ตัวเลือกที่ไม่เลือก

มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ผลที่ตามมา / ข้อควรระวัง

- ห้ามคัดลอกไฟล์ `configs/` ลง git หรือแชท — ดู [[be-config-env]].
- ผลต่อการ deploy: ไฟล์ใน `CONFIG_DIR` ต้องเก็บเป็น volume/Secret ที่จำกัดสิทธิ์ ([[be-deployment]]).

## ที่มาในโค้ด

มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ดูเพิ่ม

[[be-provider-registry]] · [[adr-0001-provider-config-json-files]] · [[adr-index]]

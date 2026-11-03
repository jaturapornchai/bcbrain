---
title: "ระบบคำนวณโปรโมชั่นในแอป POS 10 ประเภท (sys-pos-promotion-engine)"
tags: [systems, pos, promotion, discount, member]
aliases: ["PromotionEngine", "PosPromotionRule", "โปรโมชั่น POS", "ซื้อครบแถม", "ราคาพิเศษ", "ลดท้ายบิล", "House Brand", "promo_type", "customer_only", "day_filter", "[PROMO]"]
sources: ["frontend/pos/lib/services/promotion_engine.dart:8", "frontend/pos/lib/services/promotion_engine.dart:142", "frontend/pos/lib/services/promotion_engine.dart:255", "frontend/pos/lib/services/promotion_engine.dart:385", "frontend/pos/lib/services/promotion_engine.dart:522", "frontend/pos/lib/services/promotion_engine.dart:537", "frontend/pos/lib/services/promotion_engine.dart:561", "frontend/pos/lib/services/promotion_engine.dart:704", "frontend/pos/lib/providers/pos_provider.dart:341", "frontend/pos/lib/providers/pos_provider.dart:603", "frontend/pos/lib/providers/pos_provider.dart:1169", "frontend/pos/lib/ui/widgets/cart_panel.dart:602", "frontend/pos/lib/models/customer.dart:45"]
---
# ระบบคำนวณโปรโมชั่นในแอป POS

โปรโมชั่นถูกตั้งที่ BC Ai Account แล้วซิงก์ลงเครื่อง ([[sys-pos-sync-client]]) แอปคำนวณเองในเครื่องทุกครั้งที่ตะกร้าเปลี่ยน จึงใช้ได้ตอนออฟไลน์ โค้ดอยู่ใน `PromotionEngine` (`promotion_engine.dart`) ขั้นตอนขายทั้งหมดดู [[sys-pos-sale-flow]] ภาพรวม: [[sys-pos-overview]]

## ข้อมูลเข้า
- แอปอ่านโปรโมชั่นที่เก็บในเครื่องมาแปลงเป็นกฎด้วย `PosPromotionRule.fromJson` ทุกครั้งที่โหลดแค็ตตาล็อกใหม่ (`pos_provider.dart:341-343`, `promotion_engine.dart:255`)
- รูปแบบคอลัมน์ที่กฎรู้จัก: รหัส/ชื่อ, ชนิด (`promo_type_code` หรือ `promo_type`), ช่วงวันที่ `date_begin`-`date_end`, ช่วงเวลา `time_start`-`time_end`, `day_filter`, `customer_only`, `limit_qty` (เงื่อนไขจำนวน), `limit_amount` (เงื่อนไขยอดเงิน), `promotion_qty` (จำนวนของแถม), `discount_text` (เช่น `10%` หรือ `50`), `discount_amount` / `discount_pct`, `max_qty_per_bill` (0 = ไม่จำกัด), `allow_mix_match`, `target_barcode`, `reward_item_code/name`, `items_include` และ `is_active` (`promotion_engine.dart:255-359`)
- ถ้าไม่ได้ระบุชนิดเป็นตัวเลข รับชื่อชนิดแบบข้อความ เช่น `BUY_X_GET_Y`, `BUNDLE_QTY`, `MIX_MATCH_FREE`, `SPECIAL_PRICE`, `STEP_QTY`, `SPEND_GET_ITEM`, `MEMBER_TIER`, `HOUSE_BRAND_COUPON`, `TIER_REDEMPTION` ถ้าอ่านไม่ได้ ใช้ชนิด 8 เมื่อมี `discount_pct` มากกว่าศูนย์ มิฉะนั้นชนิด 7 (`promotion_engine.dart:277-312`)
- ค่าที่ไม่ได้ส่งมา: วันเริ่ม 2020 วันสิ้นสุด 31 ธ.ค. 2030, `strict_unit_ratio` เปิดเองเฉพาะชนิด 1 และ 4, `allow_mix_match` เปิดเป็นค่าตั้งต้น (`promotion_engine.dart:327-358`)

## กฎคัดกรองก่อนคำนวณ (`promotion_engine.dart:522-562`)
| เงื่อนไข | พฤติกรรม |
|---|---|
| `is_active` | ปิด = ข้าม |
| ช่วงวันที่ | วันนี้ต้องอยู่ในช่วงเริ่ม-สิ้นสุด (นับสิ้นสุดถึงสิ้นวัน) |
| `day_filter` | `WEEKEND` เฉพาะเสาร์-อาทิตย์; `LOTTERY_1_16` / `LOTTERY_DAY` เฉพาะวันที่ 1 และ 16; `PAYDAY_25_5` / `PAYDAY` เฉพาะวันที่ 25 ถึงสิ้นเดือนและ 1-5; ค่าอื่นหรือ `ALL` = ทุกวัน |
| `customer_only` | 1 = ต้องเป็นสมาชิก (ไม่ใช่ลูกค้าเงินสดทั่วไป); 2 = สมาชิกที่มีกลุ่ม หรือระดับ VIP / GOLD / PLATINUM |

**ช่วงเวลาของวัน (Happy Hour) ยังไม่ถูกตรวจ**: `time_start` / `time_end` ถูกอ่านเก็บไว้ในกฎ แต่ไม่มีโค้ดตรวจเวลาปัจจุบัน ตัวคัดกรองใช้เฉพาะวันที่และ `day_filter` (`promotion_engine.dart:522-535`, ค้นทั้ง `lib/`) ([[sys-pos-known-limits]])

สินค้าที่เข้าเงื่อนไข (`isProductEligible`): ถ้าระบุ `target_barcode` เป็นรหัส/บาร์โค้ดสินค้าต้องตรงรายการนั้น; ถ้ามี `items_include` ใช้ขอบเขต `ALL`, `CATEGORY` (ตามรหัสหรือชื่อหมวด) หรือ `SPECIFIC` (ตามรหัส/บาร์โค้ด); ชนิด 101 ใช้เฉพาะสินค้าที่รหัสแพตเทิร์นเป็น `HB` (House Brand); เมื่อเปิด `strict_unit_ratio` ต้องตรงอัตราส่วนหน่วยนับ `unit_stand : unit_divide` ด้วย (`promotion_engine.dart:116-198`)

## ผลของแต่ละชนิด
| ชนิด | ความหมาย | ผลที่ได้ |
|---|---|---|
| 1 | ซื้อครบจำนวน แถมสินค้า | ข้อความแจ้งของแถม จำนวน = (จำนวนที่ซื้อ หาร `limit_qty` ปัดลง) คูณ `promotion_qty` ไม่เกิน `max_qty_per_bill` |
| 3 | คละสินค้าในกลุ่ม ซื้อครบแถมฟรี | เหมือนชนิด 1 แต่รวมจำนวนข้ามสินค้าในกลุ่มเสมอ |
| 2, 5 | ซื้อครบจำนวน ลดเป็นบาทหรือ % | ลดสะสมเข้า "ส่วนลดโปรโมชั่น" (คิดจากยอดรวมของสินค้าที่เข้าเงื่อนไข ถ้าเป็น `%`) |
| 4 | ราคาพิเศษต่อหน่วยเมื่อครบจำนวน | ส่วนลด = (ราคาปกติ − ราคาพิเศษ) × จำนวน (จำกัดด้วย `max_qty_per_bill`) ใช้เมื่อราคาพิเศษต่ำกว่าราคาปกติ |
| 6 | ซื้อครบยอดเงิน แถมสินค้า | ข้อความแจ้งรับของฟรี |
| 7 | ซื้อครบยอดเงิน ลดเงินสดท้ายบิล | ลดเป็นบาท |
| 8 | ซื้อครบยอดเงิน ลด % ท้ายบิล | ลดเป็นเปอร์เซ็นต์ของยอดสินค้าที่เข้าเงื่อนไข |
| 101 | สะสมยอดสินค้า House Brand แจกคูปองท้ายบิล | ข้อความแจ้งว่าจะได้คูปองท้ายใบเสร็จ |
| 102 | สะสมยอดแลกของพรีเมียมตามระดับ | ข้อความแจ้งสิทธิ์แลกของพรีเมียม |

(`promotion_engine.dart:561-785`) นอกจากนี้เมื่อลูกค้าเกือบถึงเงื่อนไข (ขาดอีกไม่เกินเกณฑ์ เช่น 2 ชิ้น หรือ 150-300 บาท แล้วแต่ชนิด) ระบบสร้าง "ข้อความแนะนำลูกค้า" หนึ่งข้อความ เช่น ซื้อเพิ่มอีกกี่ชิ้นเพื่อรับของแถม

## ผลลัพธ์ถูกนำไปใช้อย่างไร
- แอปรวม "ส่วนลดโปรโมชั่น" ทั้งหมดเป็นส่วนลดท้ายบิลก้อนเดียว (ตัวเลขเท่าทศนิยม 2 ตำแหน่ง) และเติมหมายเหตุบิลขึ้นต้นด้วย `[PROMO]` ตามด้วยชื่อโปรโมชั่นที่ใช้ (`pos_provider.dart:603-619`) ถ้าแคชเชียร์ใส่ส่วนลดท้ายบิลเองไว้แล้ว (ไม่มี `[PROMO]` ในหมายเหตุ) ส่วนลดโปรโมชั่นจะไม่เขียนทับ
- ส่วนลดนี้ไปกับบิลในช่อง `bill_discount` และชื่อโปรโมชั่นไปกับ `remark` ([[sys-pos-sale-flow]]) (`pos_provider.dart:1157-1169`) เซิร์ฟเวอร์รับยอดตามที่แอปส่ง ดู [[proc-pos-bill]]
- **ของแถมไม่ถูกเพิ่มเข้าตะกร้าเอง** ชนิดที่แถมสินค้า/คูปอง (1, 3, 6, 101, 102) แสดงเป็นข้อความแจ้งแคชเชียร์เท่านั้น ค่า `auto_add_free_item` ถูกอ่านเก็บไว้แต่ไม่มีโค้ดใดนำไปตัดสินใจ (ค้นทั้ง `lib/`)
- ที่จอ: แถบโปรโมชั่นในตะกร้าย่อ/ขยายได้ แสดงชื่อโปรโมชั่นที่ได้ ส่วนลดรวม ข้อความของแถมและข้อความแนะนำ (`cart_panel.dart:602-700`) ทุกครั้งที่สินค้าเพิ่ม-ลดจนได้โปรโมชั่นใหม่ ระบบเล่นเสียงและพูดแจ้งส่วนลดบนเว็บ ([[sys-pos-app-structure]])
- การคำนวณใช้ตัวเลขทศนิยม (`double`) ในเครื่อง แล้วปัดเป็นสตริง 2 ตำแหน่งตอนส่งขึ้นเซิร์ฟเวอร์ ([[sys-pos-known-limits]])

## ฝั่งตั้งค่า
โปรโมชั่นถูกสร้างและแก้ที่ BC Ai Account เท่านั้น แอป POS ไม่มีหน้าจอสร้างโปรโมชั่น ฟังก์ชัน `initDefaultPromotions` ที่ใส่โปรโมชั่นตัวอย่างถูกเรียกเฉพาะในชุดทดสอบของแอป ไม่ได้เรียกตอนใช้งานจริง (`promotion_engine.dart:390`, ค้นใน `lib/`) ดูหน้าจอตั้งค่าที่ [[scr-pos-setup-control]]

## ที่มาในโค้ด
- `frontend/pos/lib/services/promotion_engine.dart:8-560` กฎ การแปลง JSON การกรอง
- `frontend/pos/lib/services/promotion_engine.dart:537-785` การคำนวณแต่ละชนิด
- `frontend/pos/lib/providers/pos_provider.dart:341-343,603-619` โหลดกฎและนำผลลงบิล
- `frontend/pos/lib/ui/widgets/cart_panel.dart:602-700` แถบโปรโมชั่น
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-sale-flow]] · [[sys-pos-sync-client]] · [[sys-pos-known-limits]] · [[proc-pos-bill]] · [[scr-pos-setup-control]]

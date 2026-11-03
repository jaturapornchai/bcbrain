---
title: "ข้อมูลหลักแบบหัว-รายการ รหัสอัตโนมัติ และเลย์เอาต์รายการ (Master-detail, code auto-run, DataList)"
tags: [process, master-data, master-detail, autorun, datalist, whitelist]
aliases: ["master-detail/save", "master-detail/delete", "MasterDetailSave", "mdSpecs", "mdSpec", "master/nextcode", "master/codeleave", "MasterNextCode", "MasterCodeLeave", "master/datalistget", "erp_user_datalist_config", "runRightToLeft", "รหัสลูกหนี้อัตโนมัติ"]
sources: ["backend/internal/application/process/master_detail.go:24", "backend/internal/application/process/master_detail.go:36", "backend/internal/application/process/master_detail.go:135", "backend/internal/application/process/master_detail.go:177", "backend/internal/application/process/master_detail.go:256", "backend/internal/application/process/master_detail.go:416", "backend/internal/application/process/master_detail.go:512", "backend/internal/application/process/master_detail_specs.go:144", "backend/internal/application/process/master_autorun.go:64", "backend/internal/application/process/master_autorun.go:83", "backend/internal/application/process/master_autorun.go:147", "backend/internal/application/process/master_datalist.go:50", "backend/internal/application/process/master_datalist.go:132", "backend/internal/adapter/inbound/http/process/master_handler.go:20", "backend/internal/adapter/inbound/http/process/master_detail_handler.go:13"]
---

# ข้อมูลหลักแบบหัว-รายการ รหัสอัตโนมัติ และเลย์เอาต์รายการ (Master-detail, code auto-run, DataList)

หน้าข้อมูลหลักหลายหน้า (ราคา ส่วนลด ชุดสินค้า สินทรัพย์ ผังบัญชี กลุ่มผู้ใช้ ฯลฯ) บันทึก "หัว + ตารางย่อยหลายแท็บ" ในคำขอเดียวแบบ atomic ผ่าน `master-detail/save` โดยเว็บไม่เคยเลือกชื่อตารางหรือคอลัมน์เอง ทุก `menuKey` ผูกกับ spec ที่ whitelist ไว้ใน Go นอกจากนี้ไฟล์กลุ่ม `master_*` ยังมี route รันรหัสลูกหนี้/เจ้าหนี้อัตโนมัติ และเก็บเลย์เอาต์ DataList รายผู้ใช้

## ทำงานอย่างไร

### 1. Master-detail (`POST /process/master-detail/{save|delete}`)
- Input `MasterDetailInput` (ฟิลด์ scope ของบริษัทมาจาก JWT): `menuKey`, `key`, `scope` (ครึ่งหลังของ key ประกอบ เช่น `wh_code`; เฉพาะ spec ที่มี `scopeCol`), `mode` (`new`|`edit`, เฉพาะ spec ที่มีตารางหัว), `header` (map คอลัมน์->ค่า), `grids` (map id ตาราง -> แถว)
- Output `{key, saved: {gridId: จำนวนแถว}}`; สิทธิ์ route: `save` = `write`, `delete` = `del`
- `menuKey` ที่ไม่อยู่ใน `mdSpecs` -> error "ไม่รู้จักเมนู"; `key` แปลงเป็นตัวพิมพ์ใหญ่ ไม่เกิน 25 ตัวอักษร (`mdMaxKeyLen`); ต้องมี `scope` ถ้า spec มี `scopeCol`
- spec (`mdSpec`) ประกอบด้วย: ตารางหัว (`hdrTable`, `keyCol`), คอลัมน์ที่อนุญาต (`hdrCols`), `hdrRefs` (ค่าต้องมีอยู่ในตารางอื่น), `hdrRanges`, ตารางย่อย (`grids`: คอลัมน์ที่อนุญาต, ค่าคงที่ `fixed`/`fixedStr`, `lineCol` เลขบรรทัด 1..n, `upper`, `required`, `ranges`, `skip`), `clear` (ลบก่อนแทรกใหม่), `delChildren`, `uses` (กันลบ), `itemKeyed`/`itemType`/`gate`, และ `prep` (ตรวจ/คำนวณเฉพาะเมนู)
- ลำดับ `MasterDetailSave` (หมดเวลา 30 วินาที, transaction เดียว):
  1. `prepare`: ฟิลด์/ตารางที่ไม่อยู่ใน whitelist -> "ฟิลด์ไม่ถูกต้อง"/"ไม่รู้จักตาราง"; ตรวจสินค้าถ้า `itemKeyed`; `prepareHeader` (โหมด `new` แต่รหัสมีอยู่ -> "รหัส ... มีอยู่แล้ว", โหมด `edit` แต่ไม่พบ -> "ไม่พบรายการ"); `prepareGrid` (เกิน 500 แถว หรือเกิน `maxRows` ของ grid -> "จำนวนแถวเกินกำหนด"); `prep` ของ spec; `checkRefs`
  2. `write`: เขียนหัว -> `clear` -> แต่ละ grid (`insertRow` หรือ `updateRow` เมื่อ `updatePK` ตั้งไว้) นับจำนวนแถวที่บันทึก
- ชนิดข้อมูลของทุกค่าอ่านจาก `information_schema.columns` ของตารางนั้น (`col`, cache ต่อคำขอ) แล้ว `mdNormalize`: ตัวเลขผ่าน `normDecimal`, จำนวนเต็ม (ว่าง = 0, ช่วง int32), วันที่ `YYYY-MM-DD` (ตัดเหลือ 10 ตัว), ข้อความตรวจความยาวคอลัมน์; ค่าผูกเป็น parameter ทั้งหมด
- ตัวตรวจสินค้า (`checkItem`): สินค้าต้องมี, `item_type` ตรงกับ spec (ชุดสินค้าใช้ 3), และคอลัมน์ gate (`update_price` หรือ `update_detail` ใน `ic_inventory`) ต้องเป็น 1 มิฉะนั้น "สินค้า ... ไม่อนุญาตให้แก้ไขข้อมูลนี้ (ตั้งค่าที่ข้อมูลสินค้า)" (`master_detail.go:511-529`)
- `MasterDetailDelete`: ตรวจ `uses` (ถ้า `table.col` ยังชี้รหัสนี้ -> "ไม่อนุญาตให้ลบ ...: <ข้อความ>") แล้วลบ `clear` + `delChildren` + หัว; หน้าที่ผูกกับสินค้า (price, discount, set) ลบเฉพาะแถวของสินค้านั้น ไม่ลบสินค้า

#### เมนูที่ลงทะเบียนใน `mdSpecs` (`master_detail_specs.go:144-559`)
| menuKey | ตารางหลัก (อ่านจากโค้ด) |
|---|---|
| `menu_ic_item_set` | `ic_inventory_set_detail` (ชุดสินค้า) |
| `menu_ic_purchase_price` | `ic_inventory_purchase_price` |
| `menu_ic_item_saleprice`, `menu_ic_all_price` | `ic_inventory_price` (แท็บ ปกติ/กลุ่ม/ลูกค้า) |
| `menu_ic_discount` | `ic_inventory_discount` |
| `menu_ic_item_formula_template`, `menu_ic_item_saleprice_formula` | `ic_inventory_price_formula` |
| `menu_asset_lists`, `menu_asset_maintenance` | `as_asset*`, `as_asset_maintenance*` |
| `menu_chart_of_account`, `menu_chart_of_account_fast` | `gl_chart_of_account` และตารางเชื่อม |
| `ic_warehouse_and_location_group`, `menu_ic_warehouse_locaton` | `ic_warehouse_location_group*`, `ic_wh_shelf` |
| `menu_ic_report_sort` | `ic_report_sort_item` (ตารางถูกสร้างเองถ้ายังไม่มี ที่ `master_detail.go` ฟังก์ชัน `col`) |
| `menu_ic_purchase_premium` | `ic_purchase_permium*` |
| `menu_setup_user_group`, `menu_setup_user_group_warehouse_shelf` | `erp_user_group*`, `erp_user_group_wh_shelf` (ดู [[proc-wh-shelf-permission]]) |
| `menu_sale_plan` | `erp_sale_plan*` |
| `menu_account_period` | `erp_account_period` (ตารางงวดบัญชี ล้างแล้วเขียนใหม่ทั้งชุด, :473-482) |
| `menu_view_manager_custom` | `erp_view_table_custom` + `erp_view_column_custom` (รูปแบบการค้นหาข้อมูล, :484-495) |
| `pos_promotion_formula` | `ic_promotion_formula` + ตาราง `ic_promotion_formula_condition`/`_group_qty`/`_price_discount`/`_action` (:497-525) |
| `menu_setup_pos_slip_campaign` | `pos_slip_campaign` + `pos_slip_campaign_items` (:527-) |
| `menu_account_period`, `menu_view_manager_custom` | (ยังไม่ได้อ่านรายละเอียด; `erp_view_table_custom`/`erp_view_column_custom` สำหรับเมนูหลัง) |
| `pos_promotion_formula`, `menu_setup_pos_slip_campaign` | (ยังไม่ได้อ่านรายละเอียด) |

### 2. รหัสลูกหนี้/เจ้าหนี้อัตโนมัติ (`master/nextcode`, `master/codeleave`)
- `kind` เลือกตารางจาก map คงที่ `masterCodeTables`: `customer` -> `ar_customer`, `supplier` -> `ap_supplier` (ไม่รับชื่อตารางจาก body); รหัสยาวสุด 25 (`masterCodeMaxLen`); วันที่ใช้เขตเวลา UTC+7 (`thaiToday`)
- `MasterNextCode` (`master_autorun.go:64`; ใช้ตอนเพิ่มใหม่ / F2 / รหัสที่พิมพ์ซ้ำตอนบันทึก): เอารหัสมากสุด (`ORDER BY code DESC LIMIT 1`) แล้ว `runRightToLeft` เพิ่มตัวเลขท้ายรหัส 1 และเติมศูนย์ให้ความกว้างเดิม; (ยาวขึ้นได้ถ้าเลขล้น เช่น 99 -> 100); ถ้ารหัสสุดท้ายมีเลขท้ายน้อยกว่า 2 หลัก (หรือไม่มี) ผลเป็นค่าว่าง (`runRightToLeft`, `master_autorun.go:147-160`)
- `MasterCodeLeave` (ตอนออกจากช่องรหัส): รหัสที่พิมพ์ตรงกับ `erp_doc_format.code` -> รันตามรูปแบบนั้นผ่าน `autoRunPattern` + `autoRunNext` ([[proc-doc-flow-numbering]]) โดยไม่กรองวันที่; ถ้ารูปแบบไม่มี `#` -> error "รูปแบบรหัส ... ไม่มี # สำหรับเลขรัน"; ถ้าไม่ตรงรูปแบบใด ๆ ถือเป็นคำนำหน้าแล้วหารหัสถัดไปด้วย `typedPrefixNext` (`stock_tools.go:739`) -- เฉพาะลูกค้า ถ้า `erp_option.disable_ar_autorun = 1` ไม่ทำอะไร (เจ้าหนี้ไม่มีตัวเลือกนี้); ถ้าผลเท่ารหัสที่พิมพ์ จะไม่เปลี่ยนช่อง
- ตัวนี้ไม่จองรหัส: การบันทึกจริงยังทำจากเบราว์เซอร์ และคีย์หลักของ `ar_customer`/`ap_supplier` กันรหัสซ้ำ (คอมเมนต์หัวไฟล์)
- มี route `master/assetdepdefaults` (อัตราค่าเสื่อมและวันหยุดตั้งต้นของหน้าสินทรัพย์ `AssetDepDefaults`, `asset_depreciation.go:40`) -- ไม่ได้อ่านลงรายละเอียด (ยังไม่ยืนยัน)

### 3. เลย์เอาต์ DataList รายผู้ใช้ (`master/datalistget`, `master/datalistsave`)
- เก็บในตาราง `erp_user_datalist_config` (`user_code`, `list_key`, `config_json` jsonb, `updated_at`; PK `(user_code, list_key)`) ที่ **สร้างเองเมื่อใช้ครั้งแรก** (`datalistDDL`, `CREATE TABLE IF NOT EXISTS`)
- `listKey` ไม่เกิน 150, ผู้ใช้ไม่เกิน 100 ตัวอักษร (แปลงพิมพ์ใหญ่); ผู้ใช้ว่าง = ตัวเอง
- `config` ต้องเป็น JSON object ที่มี `columns` เป็น array (ไม่เกิน 500 รายการ) และขนาดรวมไม่เกิน 256 KB; ส่ง `null`/ว่าง = ลบเลย์เอาต์ (กลับค่าเริ่มต้น); บันทึกแบบ upsert
- `datalistget` คืน `config: null` ถ้าไม่เคยบันทึก
- สิทธิ์: อ่าน/บันทึกของตัวเอง = `read`; ระบุผู้ใช้อื่น = `admin` (`RequiredRight` ที่ `permission.go:87`, ดู [[proc-permission-rights]])

## จุดที่ต้องระวัง
- เพิ่มเมนูใหม่ต้องเพิ่ม spec ใน `mdSpecs`; เมนูที่ไม่มีใน map จะบันทึกไม่ได้
- `ranges` ตรวจเป็นจำนวนเต็มเท่านั้น; ค่านอกช่วง -> "ค่า <col> ไม่ถูกต้อง"
- เมื่อ grid เป็นแบบ `updatePK` (แก้เฉพาะแถว) คอลัมน์ที่ไม่ส่งมาจะคงค่าเดิมใน DB แต่ grid ปกติ คอลัมน์ที่ไม่ส่งมาจะถูกถือเป็นค่าว่าง/ศูนย์
- ผังบัญชี (`gl_chart_of_account`): ถ้า `UPDATE` ไม่โดนแถว โค้ดจะ `INSERT` แทน (`master_detail.go` ฟังก์ชัน `updateRow`)

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail.go:14-22` - คอมเมนต์หลักและหลักการ whitelist
- `backend/internal/application/process/master_detail.go:24-115` - ค่าคงที่ ชนิด `MasterDetailInput`, `mdSpec`, `mdGrid`, `mdEnv`
- `backend/internal/application/process/master_detail.go:135` - `MasterDetailSave`; `:177` `MasterDetailDelete`
- `backend/internal/application/process/master_detail.go:237` - `mdKey`; `:256` `prepare`; `:298` `prepareHeader`; `:338` `prepareGrid`
- `backend/internal/application/process/master_detail.go:416` - `mdNormalize`; `:449` `col`; `:512` `checkItem`; `:535` `checkRefs`
- `backend/internal/application/process/master_detail.go:675` - `write`; `:807` `updateRow`
- `backend/internal/application/process/master_detail_specs.go:144-559` - `mdSpecs`
- `backend/internal/application/process/master_autorun.go:23-62` - `masterCodeTables`, ตัวช่วยตรวจ
- `backend/internal/application/process/master_autorun.go:64` - `MasterNextCode`; `:83` `MasterCodeLeave`; `:147` `runRightToLeft`
- `backend/internal/application/process/master_datalist.go:50` - `datalistDDL`; `:90` `checkDatalistConfig`; `:109` `DatalistGet`; `:132` `DatalistSave`
- `backend/internal/adapter/inbound/http/process/master_handler.go:20-37` - route `master/*`; `master_detail_handler.go:13` - route `master-detail`
- `backend/internal/adapter/inbound/http/process/permission.go:37-47` - สิทธิ์ของ route กลุ่มนี้

## ดูเพิ่ม
- [[proc-item-master-detail]]
- [[proc-price-engine]]
- [[proc-wh-shelf-permission]]
- [[proc-doc-flow-numbering]]
- [[proc-dispatcher]]
- [[process-overview]]

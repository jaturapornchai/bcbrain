// vault top-level folder → Thai label + pastel neuron colour (shared by server pages and the 3D client)
export const GROUPS: Record<string, { label: string; color: string }> = {
  root: { label: "แกนกลาง", color: "#ffffff" },
  backend: { label: "หลังบ้าน Go", color: "#7cc8ff" },
  adr: { label: "การตัดสินใจ (ADR)", color: "#ffe27a" },
  accounting: { label: "ตรรกะบัญชี", color: "#ff8fc7" },
  process: { label: "Process Engine", color: "#b9a2ff" },
  frontend: { label: "หน้าจอ Next.js", color: "#7ef0c8" },
  standards: { label: "มาตรฐาน & กฎ", color: "#ffb68a" },
  doctypes: { label: "ชนิดเอกสาร", color: "#ff6f91" },
  flows: { label: "เส้นทางงานธุรกิจ", color: "#c4f27a" },
  tables: { label: "ตารางข้อมูล", color: "#5ee0f0" },
  api: { label: "API & Process actions", color: "#9aa8ff" },
  screens: { label: "หน้าจอทีละจอ", color: "#a6f5e0" },
  glossary: { label: "คำศัพท์ไทย ↔ โค้ด", color: "#f7c6ff" },
  history: { label: "ประวัติ & บทเรียน", color: "#ffd9a8" },
  faq: { label: "ถาม-ตอบ", color: "#fff3a0" },
};

export const groupOf = (folder: string) => GROUPS[folder] ?? { label: folder, color: "#c9d1ff" };

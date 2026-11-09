// vault top-level folder → Thai label + pastel neuron colour (shared by server pages and the 3D client)
export const GROUPS: Record<string, { label: string; color: string }> = {
  root: { label: "แกนกลาง", color: "#ffffff" },
  playbook: { label: "คู่มือ AI ผู้ช่วยตอบลูกค้า", color: "#ffe27a" },
  start: { label: "เริ่มต้นใช้งาน", color: "#7cc8ff" },
  howto: { label: "วิธีทำทีละขั้น", color: "#7ef0c8" },
  troubleshoot: { label: "แก้ปัญหา", color: "#ff6f91" },
  faq: { label: "ถาม-ตอบ", color: "#fff3a0" },
  reports: { label: "รายงาน", color: "#5ee0f0" },
  systems: { label: "ระบบงานในชุด BC", color: "#6ee77a" },
  glossary: { label: "คำศัพท์", color: "#f7c6ff" },
  sales: { label: "ข้อมูลการขาย", color: "#ffb68a" },
};

export const groupOf = (folder: string) => GROUPS[folder] ?? { label: folder, color: "#c9d1ff" };

import Link from "next/link";
import Brain3D, { CountUp } from "@/components/Brain3D";
import { graph } from "@/lib/vault";

const MCP_URL = "https://brain.bcsmethai.com/mcp";
const TOOLS = [
  ["ask_brain", "ถามเป็นภาษาคน ได้โน้ตที่เกี่ยวข้องเต็มๆ ไปตอบพร้อมอ้างอิง"],
  ["search_brain", "ค้นคำ (ตัดคำไทยให้เอง) ได้รายการโน้ต + ข้อความตัวอย่าง"],
  ["read_note", "อ่านโน้ตเต็มตาม slug พร้อมลิงก์ไป-กลับ"],
  ["list_notes", "สารบัญโน้ตทั้งหมด กรองตามกลุ่มหรือ tag ได้"],
];

export default function Home() {
  const g = graph();

  return (
    <>
      <main className="home">
        <Brain3D nodes={g.nodes} links={g.links}>
          <p className="eyebrow">BC Ai Account · Second Brain</p>
          <h1>สมอง BC</h1>
          <p className="lead">
            คลังความรู้ที่สกัดจากซอร์สโค้ดจริง — <CountUp to={g.nodes.length} /> เซลล์ความรู้ · <CountUp to={g.links.length} delay={800} /> ไซแนปส์
          </p>
          <div className="actions">
            <Link className="btn primary" href="/n">
              เปิดคลังความรู้
            </Link>
            <a className="btn" href="#mcp">
              เชื่อม AI ผ่าน MCP
            </a>
          </div>
        </Brain3D>
      </main>

      <section className="mcp" id="mcp">
        <h2>ให้ AI ตัวอื่นมาใช้สมองนี้ (MCP)</h2>
        <p className="lead">
          Endpoint <code>{MCP_URL}</code> (Streamable HTTP) — เปิดสาธารณะ อ่านอย่างเดียว ไม่ต้องใช้ key
        </p>
        <div className="cards">
          {TOOLS.map(([name, desc]) => (
            <div className="card" key={name}>
              <h3>
                <code>{name}</code>
              </h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
        <h3>Claude Code</h3>
        <pre>{`claude mcp add --transport http bcbrain ${MCP_URL}`}</pre>
        <h3>Gemini CLI — settings.json</h3>
        <pre>{`{
  "mcpServers": {
    "bcbrain": {
      "httpUrl": "${MCP_URL}"
    }
  }
}`}</pre>
        <h3>Codex — config.toml</h3>
        <pre>{`[mcp_servers.bcbrain]
url = "${MCP_URL}"`}</pre>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "สมอง BC (BC Brain)",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Web",
            url: "https://brain.bcsmethai.com",
            description: "คลังความรู้ BC Ai Account แบบ Obsidian พร้อม MCP server ให้ AI ถาม-ตอบ",
            publisher: { "@type": "Organization", name: "บริษัท บ้านเชียงซอฟท์ จำกัด", url: "https://www.bcsmethai.com" },
          }),
        }}
      />
    </>
  );
}

const fs = require("fs");
const rec = fs.readFileSync("C:/Users/Lenovo/wa-aida-token-recovery.txt", "utf8");
const tok = (rec.match(/[A-Za-z0-9_-]{20,}/) || [])[0] || "";
const ref = fs.readFileSync("C:/Users/Lenovo/.zcode/workspace/default/wa-aida-crm/reference/v19-app.html", "utf8");
const base = (ref.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/) || [])[0] || "";
async function call(action, params) {
  const u = new URL(base);
  u.searchParams.set("action", action);
  u.searchParams.set("token", tok);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u.toString(), { redirect: "follow" });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { raw: text.slice(0, 300) }; }
}
async function main() {
  const j = await call("wa_send", { phone: "9999999999", text: "pipe check" });
  console.log("wa_send ok:", j.ok);
  console.log("wa_send error:", j.error || "(none)");
  console.log("messages returned:", Array.isArray(j.messages) ? j.messages.length : "n/a");
}
main().catch(e => console.log("FATAL:", e.message));

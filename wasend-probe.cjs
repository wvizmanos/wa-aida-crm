const fs = require("fs");
const rec = fs.readFileSync("C:/Users/Lenovo/wa-aida-token-recovery.txt", "utf8");
const tok = (rec.match(/[A-Za-z0-9_-]{20,}/) || [])[0] || "";
const ref = fs.readFileSync("C:/Users/Lenovo/.zcode/workspace/default/wa-aida-crm/reference/v19-app.html", "utf8");
const url = (ref.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/) || [])[0] || "";
async function main() {
  const q = "action=wa_send&phone=9999999999&text=" + encodeURIComponent("pipe test") + "&token=" + encodeURIComponent(tok);
  const res = await fetch(url + "?" + q, { redirect: "follow" });
  const text = await res.text();
  console.log("HTTP", res.status);
  console.log(text.slice(0, 400));
}
main().catch(e => console.log("FATAL:", e.message));

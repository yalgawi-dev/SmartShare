const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

const newSection = `<h4 style={{ margin: "0 0 0.2rem 0", fontSize: "1rem", color: "var(--text-primary)" }}>מע"מ (%)</h4>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.2" }}>
                יופעל אוטומטית על כל ההוצאות.
              </p>`;

let startIndex = content.indexOf("<h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>");
let endIndex = content.indexOf("</p>", startIndex);
if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + newSection + content.substring(endIndex + 4);
    fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
    console.log("VAT UI updated");
} else {
    console.log("Not found!");
}

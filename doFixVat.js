const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

const simpleStart = content.indexOf('הגדרת מע"מ ברירת מחדל (%)');
console.log("Simple start:", simpleStart);
if (simpleStart !== -1) {
    const h4Start = content.lastIndexOf("<h4", simpleStart);
    const endIdx = content.indexOf("</p>", simpleStart);
    const goodVat = `              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>מע"מ (%)</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                יופעל אוטומטית על כל ההוצאות.
              `;
    content = content.substring(0, h4Start) + goodVat + content.substring(endIdx);
    fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
    console.log("VAT Fixed via fallback.");
} else {
    console.log("Not found.");
}

const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf-8");

// Restore Central Wall
const badWall = `<h4 style={{ margin: "0 0 0.2rem 0", fontSize: "1rem", color: "var(--text-primary)" }}>מע"מ (%)</h4>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.2" }}>
                יופעל אוטומטית על כל ההוצאות.
              </p>`;
const goodWall = `<h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>עריכת ה-Wall המרכזי</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>האם שותפים למרחב מורשים להוסיף או להסיר כלים (Widgets) מהקיר?</p>`;

content = content.replace(badWall, goodWall);

// Now correctly replace VAT setting
const vatRegex = /<h4[^>]*>הגדרת מע"מ ברירת מחדל \(%\)<\/h4>\s*<p[^>]*>[\s\S]*?<\/p>/;
const goodVat = `<h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>מע"מ (%)</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                יופעל אוטומטית על כל ההוצאות.
              </p>`;

content = content.replace(vatRegex, goodVat);

fs.writeFileSync("src/app/space/[id]/settings/page.tsx", content, "utf-8");
console.log("Restored Wall and fixed VAT correctly.");

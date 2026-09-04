const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

// Fix 2: Add onFocus
text = text.replace(/<input\s+type="number"\s+value=\{myShare\}\s+onChange/g, 
                    "<input type=\"number\" value={myShare} onFocus={e => e.target.select()} onChange");
text = text.replace(/<input\s+type="number"\s+min="0"\s+max="100"\s+value=\{Number\(partnerShares\[m.userId\]/g, 
                    "<input type=\"number\" min=\"0\" max=\"100\" onFocus={e => e.target.select()} value={Number(partnerShares[m.userId]");
text = text.replace(/<input\s+type="number"\s+min="0\.01"\s+max="72"\s+step="0\.01"\s+value=\{expHours\}/g, 
                    "<input type=\"number\" min=\"0.01\" max=\"72\" step=\"0.01\" onFocus={e => e.target.select()} value={expHours}");

// Fix 4: Scroll and margin
text = text.replace(/maxHeight: '90vh'/g, "maxHeight: 'calc(100vh - 120px)', marginBottom: '60px'");

fs.writeFileSync(file, text, "utf8");
console.log("FIXED MODAL BASIC");


const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

text = text.replace("import { useState }", "import { useState, useEffect }");

text = text.replace(/<input\s+type="number"\s+min="0"\s+max="100"\s+value=\{Number\(myShare\)\.toFixed\(1\)\}\s+onChange=\{e => setMyShare\(Number\(e\.target\.value\)\)\}/, 
                    "<input type=\"number\" min=\"0\" max=\"100\" value={Number(myShare).toFixed(1)} onChange={e => setMyShare(Number(e.target.value))} onFocus={e => e.target.select()}");

text = text.replace(/<input\s+type="number"\s+min="0"\s+max="100"\s+value=\{Number\(partnerShares\[m\.userId\] \|\| 0\)\.toFixed\(1\)\}\s+onChange=\{e => setPartnerShares\(\{ \.\.\.partnerShares, \[m\.userId\]: Number\(e\.target\.value\) \}\)\}/g, 
                    "<input type=\"number\" min=\"0\" max=\"100\" value={Number(partnerShares[m.userId] || 0).toFixed(1)} onChange={e => setPartnerShares({ ...partnerShares, [m.userId]: Number(e.target.value) })} onFocus={e => e.target.select()}");

text = text.replace(/<input\s+type="number"\s+min="0\.01"\s+max="72"\s+step="0\.01"\s+value=\{expHours\}\s+onChange=\{e => setExpHours\(Number\(e\.target\.value\)\)\}/, 
                    "<input type=\"number\" min=\"0.01\" max=\"72\" step=\"0.01\" value={expHours} onChange={e => setExpHours(Number(e.target.value))} onFocus={e => e.target.select()}");

text = text.replace(/<div className="bottom-sheet" style=\{\{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var\(--bg-card\)', borderRadius: '24px', padding: '1\.5rem', boxShadow: '0 10px 40px rgba\(0,0,0,0\.2\)' \}\}>/, 
                    "<div className=\"bottom-sheet\" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', marginBottom: '80px' }}>");

fs.writeFileSync(file, text, "utf8");
console.log("FIXED UI AND FOCUS");


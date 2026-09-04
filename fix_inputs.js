const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

text = text.replace(/<input\s+type="number"\s+value=\{myShare\}\s+onChange=\{e => setMyShare\(Number\(e\.target\.value\)\)\}/g, 
                    "<input \n                type=\"number\" \n                value={myShare} \n                onChange={e => setMyShare(Number(e.target.value))}\n                onFocus={e => e.target.select()}");

text = text.replace(/<input \n                  type="number" \n                  min="0" max="100" \n                  value=\{Number\(partnerShares\[m\.userId\] \|\| 0\)\.toFixed\(1\)\} \n                  onChange=\{e => setPartnerShares\(\{ \.\.\.partnerShares, \[m\.userId\]: Number\(e\.target\.value\) \}\)\}/g, 
                    "<input \n                  type=\"number\" \n                  min=\"0\" max=\"100\" \n                  value={Number(partnerShares[m.userId] || 0).toFixed(1)} \n                  onChange={e => setPartnerShares({ ...partnerShares, [m.userId]: Number(e.target.value) })}\n                  onFocus={e => e.target.select()}");

fs.writeFileSync(file, text, "utf8");
console.log("FIXED INPUTS");


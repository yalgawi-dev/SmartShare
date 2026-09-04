const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
const idx1 = b.indexOf("getRemainingTimeText");
const idx2 = b.indexOf("getRemainingTimeText", idx1 + 1);
console.log(b.substring(idx2 - 100, idx2 + 10));


const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
const idx1 = b.indexOf("isExpired ?");
console.log(b.substring(idx1, idx1 + 100));


const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
console.log(b.substring(0, 500));


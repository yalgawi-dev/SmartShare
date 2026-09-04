const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
console.log(b.substring(b.indexOf("getRemainingTimeText") - 200, b.indexOf("getRemainingTimeText")));


const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
const lines = b.split("\n");
console.log(lines.slice(90, 110).join("\n"));


const fs = require("fs");
const lines = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8").split("\n");
console.log(lines.slice(95, 110).join("\n"));


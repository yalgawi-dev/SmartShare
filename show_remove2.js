const fs = require("fs");
const b = fs.readFileSync("src/components/widgets/Partners/SharesEditorModal.tsx", "utf8");
const lines = b.split("\n");
lines.forEach((l, i) => { if (l.includes("removeMember")) console.log(l.trim()); });


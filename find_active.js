const fs = require("fs");
const b = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf8");
const lines = b.split("\n");
lines.forEach((l, i) => { if (l.includes("m.isActive === false")) console.log(i + ": " + l.trim()); });


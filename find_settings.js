const fs = require("fs");
const b = fs.readFileSync("src/app/space/[id]/page.tsx", "utf8");
const lines = b.split("\n");
lines.forEach((l, i) => { if (l.includes("/settings")) console.log(i + ": " + l.trim()); });

